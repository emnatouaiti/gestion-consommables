<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\ConsumableRequest;
use App\Models\Product;
use App\Models\User;
use App\Models\StockMovement;
use App\Models\StockMovementLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Barryvdh\DomPDF\Facade\Pdf;

class ConsumableRequestController extends Controller
{
    // Afficher les demandes selon le profil
    public function index(Request $request)
    {
        $user = Auth::user();

        $query = ConsumableRequest::with('user.role', 'product', 'depot')->latest();

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->input('end_date'));
        }

        if ($request->boolean('own')) {
            $query->where('user_id', $user->id);
        } elseif ($this->isDirectorUser($user) || $this->isStockManager($user)) {
            if ($this->isDirectorUser($user)) {
                $query->whereHas('user', function ($q) use ($user) {
                    $q->where('service', $user->service)
                      ->where('siege', $user->siege);
                });
            } elseif ($this->isStockManager($user)) {
                if ($user->depot_id) {
                    $query->where('depot_id', $user->depot_id);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }
        } else {
            $query->where('user_id', $user->id);
        }

        $requests = $query->get()
            ->map(function (ConsumableRequest $request) {
                $availableStock = $this->getAvailableStock($request);
                $suggestion     = $this->computeSuggestedQuantity($request, $availableStock);
                $productThreshold = optional($request->product)->seuil_min ?? null;

                $request->setAttribute('requester_name',    $this->getRequesterName($request->user));
                $request->setAttribute('requester_service', $this->getRequesterService($request->user));
                $request->setAttribute('requester_poste',   $this->getRequesterPoste($request->user));
                $request->setAttribute('available_stock',   $availableStock);
                $request->setAttribute('suggested_approved_quantity', $suggestion['quantity']);
                $request->setAttribute('suggestion_reason', $suggestion['reason']);
                $request->setAttribute('product_threshold', $productThreshold);
                $request->setAttribute('requester_siege',   $request->user?->siege);
                $request->setAttribute('stock_alert',       $this->isStockBelowThreshold($availableStock, $productThreshold, $request->requested_quantity));

                return $request;
            })
            ->groupBy(fn($req) => $req->batch_code ?: $req->id)
            ->map(function ($group) {
                $first  = $group->first();
                $items  = $group->values();

                return [
                    'id'               => $first->id,
                    'batch_code'       => $first->batch_code,
                    'item_name'        => count($items) > 1 ? count($items) . ' produits' : $first->item_name,
                    'requested_quantity' => $group->sum('requested_quantity'),
                    'approved_quantity'  => $group->sum('approved_quantity') ?: null,
                    'status'           => $this->computeGroupStatus($group),
                    'created_at'       => $first->created_at,
                    'user'             => $first->user,
                    'requester_name'   => $first->getAttribute('requester_name'),
                    'requester_service'=> $first->getAttribute('requester_service'),
                    'requester_poste'  => $first->getAttribute('requester_poste'),
                    'available_stock'  => $first->getAttribute('available_stock'),
                    'suggested_approved_quantity' => $first->getAttribute('suggested_approved_quantity'),
                    'suggestion_reason'=> $first->getAttribute('suggestion_reason'),
                    'product_threshold'=> $first->getAttribute('product_threshold'),
                    'requester_siege'  => $first->getAttribute('requester_siege'),
                    'stock_alert'      => $first->getAttribute('stock_alert'),
                    'pdf_path'         => $first->pdf_path,
                    'pdf_path_approved' => $group->first(fn($r) => $r->pdf_path && str_contains((string)$r->pdf_path, '_approved'))?->pdf_path,
                    'pdf_path_rejected' => $group->first(fn($r) => $r->pdf_path && str_contains((string)$r->pdf_path, '_rejected'))?->pdf_path,
                    'items'            => $items,
                ];
            })
            ->values();

        return response()->json($requests);
    }

    // Creer une nouvelle demande
    public function store(Request $request)
    {
        $user = Auth::user();

        if (!$this->userHasAnyRole($user, ['utilisateur', 'responsable', 'agent', 'gestionnaire', 'employee', 'employé', 'directeur', 'pdg'])) {
            return response()->json(['message' => 'Seuls les utilisateurs metier peuvent creer une demande.'], 403);
        }

        $payloads     = $this->buildCreateRequestPayloads($request);
        $createdRequests = [];
        $incomingBatch = $request->input('batch_code');
        $batchCode     = $incomingBatch ?: (count($payloads) > 1 ? (string) Str::uuid() : null);

        DB::transaction(function () use ($payloads, $user, $batchCode, $incomingBatch, &$createdRequests) {
            if ($incomingBatch) {
                ConsumableRequest::where('batch_code', $incomingBatch)
                    ->whereIn('status', ['draft', 'pending'])
                    ->delete();
            }

            $isDirector = ($user->role?->name ?? '') === 'Directeur' || Str::lower($user->role?->name ?? '') === 'directeur';

            foreach ($payloads as $payload) {
                $initialStatus = isset($payload['status']) ? $payload['status'] : 'draft';
                if (!in_array($initialStatus, ['draft', 'pending', 'approved', 'rejected'], true)) {
                    $initialStatus = 'draft';
                }

                if ($this->isStockManager($user) && $initialStatus === 'pending') {
                    $initialStatus = 'approved_pending_exit';
                    $payload['approved_quantity'] = $payload['requested_quantity'];
                } elseif ($isDirector && $initialStatus === 'pending') {
                    $initialStatus = 'approved_pending_exit';
                    $payload['approved_quantity'] = $payload['requested_quantity'];
                }

                $req = ConsumableRequest::create(array_merge($payload, [
                    'user_id'    => $user->id,
                    'batch_code' => $batchCode,
                    'status'     => $initialStatus,
                ]));

                if ($initialStatus === 'approved_pending_exit') {
                    $productId = $this->resolveProductId($req->product_id, $req->item_name);
                    if ($productId && $req->approved_quantity > 0) {
                        $stockByDepot = $this->getStockByDepot($productId, $req->approved_quantity);
                        if (!empty($stockByDepot)) {
                            $eligibleDepots = collect($stockByDepot)
                                ->filter(fn($depotInfo) => (int) ($depotInfo['total_quantity'] ?? 0) >= (int) $req->approved_quantity)
                                ->sortByDesc(fn($depotInfo) => (int) ($depotInfo['total_quantity'] ?? 0));
                            
                            $assignedDepot = $eligibleDepots->isNotEmpty() 
                                ? (int) $eligibleDepots->keys()->first()
                                : (int) collect($stockByDepot)->sortByDesc('total_quantity')->keys()->first();
                            
                            if ($assignedDepot) {
                                $req->depot_id = $assignedDepot;
                                $req->save();
                            }
                        }
                    }
                }
                
                $createdRequests[] = $req;
            }
        });

        // 1. Generate PDF first so it's available for notifications
        try {
            $pdfPath = $this->generateAndSavePdf($user, $createdRequests, $batchCode);
            if ($pdfPath) {
                foreach ($createdRequests as $req) {
                    $req->update(['pdf_path' => $pdfPath]);
                }
            }
        } catch (\Throwable $e) {
            Log::error('PDF Generation failed for consumable request', ['error' => $e->getMessage()]);
        }

        // 2. Then notify
        $firstStatus = collect($createdRequests)->first()?->status ?? null;
        if ($firstStatus === 'pending' && count($createdRequests) > 0) {
            $this->notifyDirectors(collect($createdRequests));
        } elseif ($firstStatus === 'approved_pending_exit' && count($createdRequests) > 0) {
            $this->notifyStockManagers(collect($createdRequests));
        }

        return response()->json(['requests' => $createdRequests], 201);
    }

    // Modifier une demande
    public function update($id, Request $request)
    {
        $editor = Auth::user();
        $consumableRequest = ConsumableRequest::findOrFail($id);

        if (!$this->canRequesterEditOrDelete($editor, $consumableRequest)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $currentStatus = Str::lower((string) $consumableRequest->status);
        if (!in_array($currentStatus, ['pending', 'draft'], true)) {
            return response()->json(['message' => 'Only pending or draft requests can be modified.'], 422);
        }

        $hasPayloadFields = $request->has('requested_quantity') || $request->has('item_name') || $request->has('product_id') || $request->has('items');
        if ($request->has('status') && !$hasPayloadFields) {
            $requestedStatus = Str::lower((string) $request->input('status'));
            if (!in_array($requestedStatus, ['draft', 'pending'], true)) {
                return response()->json(['message' => 'Invalid status change.'], 422);
            }

            $oldStatus = $consumableRequest->status;
            $newStatus = $requestedStatus;
            $isDirector = ($editor->role?->name ?? '') === 'Directeur' || Str::lower($editor->role?->name ?? '') === 'directeur';
            
            if ($newStatus === 'pending') {
                if ($this->isStockManager($editor) || $isDirector) {
                    $newStatus = 'approved_pending_exit';
                    // For single item update, we might need to set approved_quantity
                    if (!$consumableRequest->approved_quantity) {
                        $consumableRequest->approved_quantity = $consumableRequest->requested_quantity;
                    }
                }
            }

            $consumableRequest->update(['status' => $newStatus]);

            if ($consumableRequest->batch_code) {
                ConsumableRequest::where('batch_code', $consumableRequest->batch_code)
                    ->update([
                        'status' => $newStatus,
                        'approved_quantity' => DB::raw('requested_quantity')
                    ]);
            }

            // Regenerate PDF if status changed to pending or approved
            if ($newStatus === 'approved_pending_exit' || $newStatus === 'pending') {
                try {
                    $batch = $consumableRequest->batch_code
                        ? ConsumableRequest::where('batch_code', $consumableRequest->batch_code)->get()
                        : collect([$consumableRequest]);
                    
                    $pdfPath = $this->generateAndSavePdf($consumableRequest->user, $batch->all(), $consumableRequest->batch_code);
                    if ($pdfPath) {
                        if ($consumableRequest->batch_code) {
                            ConsumableRequest::where('batch_code', $consumableRequest->batch_code)->update(['pdf_path' => $pdfPath]);
                        } else {
                            $consumableRequest->update(['pdf_path' => $pdfPath]);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::error('PDF Regeneration failed in update', ['error' => $e->getMessage()]);
                }
            }

            if (Str::lower($oldStatus) !== 'pending' && $requestedStatus === 'pending') {
                $batch = $consumableRequest->batch_code
                    ? ConsumableRequest::where('batch_code', $consumableRequest->batch_code)->get()
                    : collect([$consumableRequest]);
                
                if ($newStatus === 'approved_pending_exit') {
                    $this->notifyStockManagers($batch);
                } else {
                    $this->notifyDirectors($batch);
                }
            }

            return response()->json([
                'message' => 'Request updated successfully.',
                'request' => $consumableRequest->fresh(['user.role', 'product']),
            ]);
        }

        $payload = $this->buildRequestPayload($request);

        if ($request->has('status')) {
            $requestedStatus = Str::lower((string) $request->input('status'));
            if (in_array($requestedStatus, ['draft', 'pending'], true)) {
                $payload['status'] = $requestedStatus;
            }
        }

        $consumableRequest->update($payload);

        if ($consumableRequest->batch_code) {
            ConsumableRequest::where('batch_code', $consumableRequest->batch_code)
                ->where('id', '!=', $consumableRequest->id)
                ->update($payload);
        }

        return response()->json([
            'message' => 'Request updated successfully.',
            'request' => $consumableRequest->fresh(['user.role', 'product']),
        ]);
    }

    // Supprimer une demande
    public function destroy($id)
    {
        $editor = Auth::user();
        $consumableRequest = ConsumableRequest::findOrFail($id);

        if (!$this->canRequesterEditOrDelete($editor, $consumableRequest)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $currentStatus = Str::lower((string) $consumableRequest->status);
        if (!in_array($currentStatus, ['pending', 'draft'], true)) {
            return response()->json(['message' => 'Only pending or draft requests can be deleted.'], 422);
        }

        $consumableRequest->delete();
        return response()->json(['message' => 'Request deleted successfully.']);
    }

    // Approuver une demande (directeur / manager)
    public function approve($id, Request $request)
    {
        $consumableRequest = ConsumableRequest::with('user')->findOrFail($id);
        $approver  = Auth::user();
        $isDirector = $this->isDirectorUser($approver);
        $isManager  = $this->isStockManager($approver);

        if (!$isDirector && !$isManager) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $currentStatus = Str::lower((string) $consumableRequest->status);
        $nextStatus    = null;

        // Check if director is using new status workflow
        $directorAction = $request->input('action'); // 'accept', 'reject', 'partial'

        if ($isManager && $currentStatus === 'pending') {
            $nextStatus = 'validated_by_manager';
        } elseif ($isDirector && in_array($currentStatus, ['pending', 'validated_by_manager', 'partiellement_accepte', 'approved_pending_exit', 'rejected'])) {
            // Director can choose: 'accepte' (approved_pending_exit), 'approved_pending_exit', or 'rejected'
            if ($directorAction === 'reject') {
                $nextStatus = 'rejected';
            } elseif ($directorAction === 'partial') {
                $nextStatus = 'approved_pending_exit'; // After partial approval, status becomes approved_pending_exit
            } else {
                // Default: 'approved_pending_exit' - director approves, waiting for stock manager to confirm exit
                $nextStatus = 'approved_pending_exit';
            }
        } else {
            $role = $isManager ? 'gestionnaire' : 'utilisateur';
            $validStatuses = $isManager ? 'pending' : 'pending, validated_by_manager, partiellement_accepte';
            return response()->json([
                'message' => "Cannot approve request with status '{$currentStatus}'. Valid statuses for your role ({$role}): {$validStatuses}.",
                'current_status' => $currentStatus,
                'valid_statuses' => $isManager ? ['pending'] : ['pending', 'validated_by_manager', 'partiellement_accepte', 'approved_pending_exit'],
                'your_role' => $role,
            ], 422);
        }

        $request->validate([
            'approved_quantity'    => 'nullable|integer|min:0',
            'approved_quantities'  => 'nullable|array',
            'approved_quantities.*'=> 'nullable|integer|min:0',
            'rejections'           => 'nullable|array',
            'rejections.*'         => 'nullable|string',
        ], [
            'approved_quantities.*' => 'Each approved quantity must be a valid integer.',
            'rejections.*' => 'Each rejection reason must be a string.'
        ]);

        $batchCode         = $consumableRequest->batch_code;
        $requestsToApprove = $batchCode
            ? ConsumableRequest::where('batch_code', $batchCode)->get()
            : collect([$consumableRequest]);

        // Variables for use after transaction
        $finalStatus       = $nextStatus;
        $approvedRequests  = collect();
        $rejectedRequests  = collect();
        $depotWarnings     = [];
        $insufficientWarnings = [];
        $splitRequests     = []; // Track if requests were split across depots

        DB::transaction(function () use (
            $requestsToApprove, $request, $nextStatus, $isDirector,
            &$finalStatus, &$approvedRequests, &$rejectedRequests, &$depotWarnings, &$insufficientWarnings, &$splitRequests
        ) {
            $approvedQuantitiesMap = collect($request->input('approved_quantities', []))
                ->mapWithKeys(fn($qty, $key) => [(int) $key => (int) $qty]);
            $rejectionMap          = collect($request->input('rejections', []))
                ->mapWithKeys(fn($reason, $key) => [(int) $key => (string) $reason]);

            // Check stock by depot for all requests
            $requestsByDepot = [];

            foreach ($requestsToApprove as $req) {
                $availableStock = $this->getAvailableStock($req);
                $suggestion     = $this->computeSuggestedQuantity($req, $availableStock);

                $mapQty = $approvedQuantitiesMap->has((string) $req->id)
                    ? (int) $approvedQuantitiesMap->get((string) $req->id)
                    : null;

                $isRejected = $rejectionMap->has((string) $req->id);

                $approvedQty = $mapQty;
                if ($approvedQty === null && !$isRejected) {
                    $approvedQty = $request->has('approved_quantity')
                        ? (int) $request->input('approved_quantity')
                        : (int) ($suggestion['quantity'] ?? $req->requested_quantity ?? 0);
                }

                if ($isRejected) {
                    $req->approved_quantity = 0;
                    $req->status            = 'rejected';
                    $req->reject_reason     = (string) $rejectionMap->get((string) $req->id);
                } else {
                    $req->approved_quantity = max(0, $approvedQty);
                    $req->status            = $nextStatus;

                    // Check which depot has the stock for this product
                    $productId = $this->resolveProductId($req->product_id, $req->item_name);

                    if ($productId && $approvedQty > 0) {
                        $stockByDepot = $this->getStockByDepot($productId, $approvedQty);
                        if (!empty($stockByDepot)) {
                            // Find the depot with enough stock
                            $assignedDepot = null;
                            $eligibleDepots = collect($stockByDepot)
                                ->filter(fn($depotInfo) => (int) ($depotInfo['total_quantity'] ?? 0) >= (int) $approvedQty)
                                ->sortByDesc(fn($depotInfo) => (int) ($depotInfo['total_quantity'] ?? 0));

                            if ($eligibleDepots->isNotEmpty()) {
                                $assignedDepot = (int) $eligibleDepots->keys()->first();
                            }

                            if ($assignedDepot) {
                                // Single depot has enough stock
                                $req->depot_id = $assignedDepot;
                                $requestsByDepot[$assignedDepot][] = $req;
                                $req->save();
                            } else {
                                // Stock is spread across multiple depots - SPLIT the request
                                $remainingQty = $approvedQty;
                                $firstSplit = true;
                                $splitInfo = [
                                    'product' => $req->item_name,
                                    'requested' => $approvedQty,
                                    'splits' => []
                                ];

                                // Sort depots by quantity descending
                                $sortedDepots = collect($stockByDepot)->sortByDesc('total_quantity');

                                foreach ($sortedDepots as $depotId => $depotInfo) {
                                    if ($remainingQty <= 0) break;

                                    $qtyFromThisDepot = min($depotInfo['total_quantity'], $remainingQty);

                                    if ($firstSplit) {
                                        // Update the original request with first depot
                                        $req->depot_id = $depotId;
                                        $req->approved_quantity = $qtyFromThisDepot;
                                        $req->save();
                                        $requestsByDepot[$depotId][] = $req;
                                        $firstSplit = false;
                                    } else {
                                        // Create a new split request for additional depots
                                        $splitRequest = $req->replicate();
                                        $splitRequest->depot_id = $depotId;
                                        $splitRequest->approved_quantity = $qtyFromThisDepot;
                                        $splitRequest->status = $nextStatus;
                                        // Keep the same batch_code to maintain grouping
                                        $splitRequest->save();
                                        $requestsByDepot[$depotId][] = $splitRequest;
                                        $splitRequests[] = $splitRequest;
                                    }

                                    $splitInfo['splits'][] = [
                                        'depot_id' => $depotId,
                                        'depot_name' => $depotInfo['depot_name'],
                                        'quantity' => $qtyFromThisDepot
                                    ];
                                    $remainingQty -= $qtyFromThisDepot;
                                }

                                if ($remainingQty > 0) {
                                    $insufficientWarnings[] = [
                                        'product' => $req->item_name,
                                        'requested' => $approvedQty,
                                        'allocated' => max(0, $approvedQty - $remainingQty),
                                        'missing' => $remainingQty,
                                    ];
                                }

                                if (count($splitInfo['splits']) > 1) {
                                    $depotWarnings[] = $splitInfo;
                                }

                                // Update the original approved_quantity to reflect the split
                                if (!$firstSplit) {
                                    $req->refresh();
                                }
                            }
                        }
                    }
                }

                if ($req->isDirty()) {
                    $req->save();
                }
            }

            // Get all requests (including splits) for notification
            $allApprovedRequests = collect();
            foreach ($requestsByDepot as $depotRequests) {
                foreach ($depotRequests as $r) {
                    $allApprovedRequests->push($r);
                }
            }

            // Séparer approuvés et rejetés après la première passe
            $approvedRequests = $requestsToApprove->filter(
                fn($r) => in_array($r->status, ['approved_pending_exit', 'validated_by_manager', 'approved'])
            );
            if (!empty($splitRequests)) {
                $approvedRequests = $approvedRequests->concat(collect($splitRequests));
            }
            $rejectedRequests = $requestsToApprove->filter(fn($r) => $r->status === 'rejected');

            // Approbation partielle : certains approuvés, certains rejetés
            if ($approvedRequests->count() > 0 && $rejectedRequests->count() > 0) {
                $finalStatus = 'partiellement_accepte';
            }

            $batchUser = $requestsToApprove->first()?->user;
            $bc        = $requestsToApprove->first()?->batch_code;

            // --- Générer PDF pour les items APPROUVÉS ---
            $approvedPdfPath = null;
            if ($approvedRequests->count() > 0 && $batchUser) {
                try {
                    $approvedPdfPath = $this->generateAndSavePdf(
                        $batchUser,
                        $approvedRequests->values()->all(),
                        $bc,
                        '_approved'
                    );
                    if ($approvedPdfPath) {
                        foreach ($approvedRequests as $req) {
                            $req->update(['pdf_path' => $approvedPdfPath]);
                        }
                    }

                } catch (\Throwable $e) {
                    Log::error('PDF generation error for approved items', ['error' => $e->getMessage()]);
                }
            }

            // --- Générer PDF pour les items REJETÉS ---
            $rejectedPdfPath = null;
            if ($rejectedRequests->count() > 0 && $batchUser) {
                try {
                    $rejectedPdfPath = $this->generateAndSavePdf(
                        $batchUser,
                        $rejectedRequests->values()->all(),
                        $bc,
                        '_rejected'
                    );
                    if ($rejectedPdfPath) {
                        foreach ($rejectedRequests as $req) {
                            $req->update(['pdf_path' => $rejectedPdfPath]);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::error('PDF generation error for rejected items', ['error' => $e->getMessage()]);
                }
            }
        });

        // --- Notifications (hors transaction) ---
        Log::info('Triggering notifications for approve', [
            'nextStatus' => $nextStatus,
            'approvedCount' => $approvedRequests->count(),
            'rejectedCount' => $rejectedRequests->count(),
            'isPartial' => ($approvedRequests->count() > 0 && $rejectedRequests->count() > 0)
        ]);

        if ($nextStatus === 'validated_by_manager') {
            $this->notifyDirectors($requestsToApprove);
        } elseif (in_array($nextStatus, ['approved_pending_exit', 'rejected'])) {
            // Case for Director approval (Full or Partial)
            if ($approvedRequests->count() > 0 && $rejectedRequests->count() > 0) {
                 $this->notifyRequesterPartial($approvedRequests, $rejectedRequests);
            } else {
                 $this->notifyRequester($requestsToApprove);
            }
            
            if ($approvedRequests->count() > 0) {
                $this->notifyStockManagersByDepot($approvedRequests);
            }
        }

        $responseData = [
            'message' => 'Demande passee au statut : ' . $finalStatus,
            'status'  => $finalStatus,
        ];

        // Add depot warnings if products are in multiple depots (request was split)
        if (!empty($depotWarnings)) {
            $responseData['depot_warnings'] = $depotWarnings;
            $responseData['warning_message'] = 'Certains produits sont disponibles dans plusieurs dépôts. La demande a été divisée selon la disponibilité dans chaque dépôt.';
            $responseData['split_info'] = 'La demande a été automatiquement divisée et chaque responsable de dépôt recevra uniquement les quantités disponibles dans son dépôt.';
        }

        if (!empty($insufficientWarnings)) {
            $responseData['insufficient_warnings'] = $insufficientWarnings;
        }

        return response()->json($responseData);
    }

    // Confirmer la sortie physique (responsable stock)
    public function confirmExit($id, Request $request)
    {
        $consumableRequest = ConsumableRequest::findOrFail($id);
        $user = Auth::user();

        if (!$this->isStockManager($user)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!in_array($consumableRequest->status, ['approved', 'approved_pending_exit'])) {
            return response()->json(['message' => 'Cette demande n\'est pas en attente de sortie.'], 422);
        }

        $request->validate([
            'items'                        => 'nullable|array',
            'items.*.id'                   => 'required_with:items|exists:consumable_requests,id',
            'items.*.source_warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'items.*.source_cabinet_id'            => 'nullable|exists:warehouse_cabinets,id',
            'source_warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'source_cabinet_id'            => 'nullable|exists:warehouse_cabinets,id',
            'destination_text'             => 'nullable|string|max:255',
            'motif'                        => 'nullable|string|max:500',
        ]);

        $batchRequests = $consumableRequest->batch_code
            ? ConsumableRequest::where('batch_code', $consumableRequest->batch_code)->whereIn('status', ['approved', 'approved_pending_exit'])->get()
            : collect([$consumableRequest]);

        if ($user->depot_id) {
            $batchRequests = $batchRequests->filter(fn($r) => !$r->depot_id || (int) $r->depot_id === (int) $user->depot_id);
            if ($batchRequests->isEmpty()) {
                return response()->json(['message' => 'Cette demande est assignée à un autre dépôt.'], 403);
            }
        }

        $itemsPayload = $request->input('items', []);
        $itemsMap = collect($itemsPayload)->keyBy('id');

        Log::info('confirmExit payload', $request->all());

        DB::transaction(function () use ($batchRequests, $itemsMap, $user, $request) {
            $motif = $request->input('motif', 'Sortie confirmee suite validation Direction');
            $destinationText = $request->input('destination_text') ?: $this->getRequesterName($batchRequests->first()->user);

            // 1. Create a single StockMovement for all items
            $movement = StockMovement::create([
                'movement_type'               => 'out',
                'reference'                   => 'REQ-' . $batchRequests->first()->id,
                'created_by'                  => $user->id,
                'related_request_id'          => $batchRequests->first()->id,
                'motif'                       => $motif,
                'destination_text'            => $destinationText,
                'status'                      => 'executed',
                'executed_at'                 => now(),
                'validated_by'                => $user->id,
            ]);

            foreach ($batchRequests as $req) {
                // Determine locations
                $sourceLocationId = null;
                $sourceCabinetId = null;

                if ($itemsMap->has($req->id)) {
                    $itemData = $itemsMap->get($req->id);
                    $sourceLocationId = $itemData['source_warehouse_location_id'] ?? null;
                    $sourceCabinetId  = $itemData['source_cabinet_id'] ?? null;
                } else {
                    $sourceLocationId = $request->input('source_warehouse_location_id');
                    $sourceCabinetId  = $request->input('source_cabinet_id');
                }

                // Responsable/agent: sortie strictement dans leur depot
                if ($user->depot_id) {
                    if ($sourceLocationId) {
                        $loc = \App\Models\WarehouseLocation::with('room')->find($sourceLocationId);
                        if (!$loc || !$loc->room || (int) $loc->room->warehouse_id !== (int) $user->depot_id) {
                            throw ValidationException::withMessages(['message' => 'Emplacement source hors de votre dépôt pour le produit ' . $req->item_name]);
                        }
                    }
                    if ($sourceCabinetId) {
                        $cab = \App\Models\WarehouseCabinet::with('room')->find($sourceCabinetId);
                        if (!$cab || !$cab->room || (int) $cab->room->warehouse_id !== (int) $user->depot_id) {
                            throw ValidationException::withMessages(['message' => 'Armoire source hors de votre dépôt pour le produit ' . $req->item_name]);
                        }
                    }
                }

                $productId = $req->product_id;
                if (!$productId) {
                    $name = trim((string) $req->item_name);
                    $productId = \App\Models\Product::where('title', 'like', $name)
                        ->orWhereRaw('LOWER(title) = ?', [mb_strtolower($name, 'UTF-8')])
                        ->value('id');
                }

                $approvedQuantity = (int) ($req->approved_quantity ?: $req->requested_quantity);

                if ($productId && $approvedQuantity > 0 && Schema::hasColumn('consumable_requests', 'product_id') && !$req->product_id) {
                    $req->update(['product_id' => $productId]);
                }

                $req->status = 'approved';
                $req->save();

                if ($productId && $approvedQuantity > 0) {
                    StockMovementLine::create([
                        'stock_movement_id' => $movement->id,
                        'product_id'        => $productId,
                        'quantity'          => $approvedQuantity,
                        'warehouse_location_id' => $sourceLocationId,
                        'cabinet_id'            => $sourceCabinetId,
                    ]);

                    // Deduct from ProductStock
                    try {
                        $stockQuery = \App\Models\ProductStock::where('product_id', $productId);
                        if ($sourceLocationId) {
                            $stockQuery->where('warehouse_location_id', $sourceLocationId);
                        } elseif ($sourceCabinetId) {
                            $stockQuery->where('cabinet_id', $sourceCabinetId);
                        }

                        $sourceStock = $stockQuery->lockForUpdate()->first();
                        
                        if ($sourceStock && $sourceStock->quantity >= $approvedQuantity) {
                            $sourceStock->decrement('quantity', $approvedQuantity);
                            $sourceStock->update(['last_updated' => now()]);
                        }
                    } catch (\Throwable $e) {
                        Log::error('Failed to decrement ProductStock on confirmExit', ['err' => $e->getMessage()]);
                    }

                    // Deduct from global Product stock
                    try {
                        $prod = \App\Models\Product::find($productId);
                        if ($prod) {
                            $prod->decrement('stock_quantity', $approvedQuantity);
                        }
                    } catch (\Throwable $e) {
                        Log::error('Failed to decrement global product stock', ['err' => $e->getMessage()]);
                    }
                }
            }

            // Regenerate PDF and notify
            try {
                $first = $batchRequests->first();
                // Get all requests in the batch to generate PDFs
                $allBatchReqs = $first->batch_code ? ConsumableRequest::where('batch_code', $first->batch_code)->get() : collect([$first]);
                $allBatchReqs->each->refresh();

                $batchUser = $first->user;
                $bc = $first->batch_code;

                // Separate approved and rejected items
                $approvedReqs = $allBatchReqs->filter(fn($r) => strtolower($r->status) === 'approved');
                $rejectedReqs = $allBatchReqs->filter(fn($r) => strtolower($r->status) === 'rejected');
                $hasPartial = $approvedReqs->count() > 0 && $rejectedReqs->count() > 0;

                if ($hasPartial) {
                    // --- PDF séparé pour les items LIVRÉS (bon de sortie) ---
                    $approvedPdfPath = $this->generateAndSavePdf(
                        $batchUser,
                        $approvedReqs->values()->all(),
                        $bc,
                        '_approved'
                    );
                    if ($approvedPdfPath) {
                        foreach ($approvedReqs as $r) {
                            $r->update(['pdf_path' => $approvedPdfPath]);
                        }
                        $movement->update(['response_pdf_path' => $approvedPdfPath]);
                    }

                    // --- PDF séparé pour les items REJETÉS (bon de refus) ---
                    $rejectedPdfPath = $this->generateAndSavePdf(
                        $batchUser,
                        $rejectedReqs->values()->all(),
                        $bc,
                        '_rejected'
                    );
                    if ($rejectedPdfPath) {
                        foreach ($rejectedReqs as $r) {
                            $r->update(['pdf_path' => $rejectedPdfPath]);
                        }
                    }
                } else {
                    // All same status: generate a single PDF
                    $pdfPath = $this->generateAndSavePdf(
                        $batchUser,
                        $allBatchReqs->all(),
                        $bc,
                        null
                    );
                    if ($pdfPath) {
                        foreach ($allBatchReqs as $r) {
                            $r->update(['pdf_path' => $pdfPath]);
                        }
                        $movement->update(['response_pdf_path' => $pdfPath]);
                    }
                }

                $batchUser->notify(new \App\Notifications\ConsumableRequestNotification($allBatchReqs));
            } catch (\Throwable $e) {
                Log::error('Failed to regenerate PDF or notify on confirmExit', ['err' => $e->getMessage()]);
            }
        });

        return response()->json([
            'message' => 'Sortie confirmée. Stock mis à jour.',
            'request' => $consumableRequest->fresh(['user', 'product', 'depot']),
            'depot_name' => $consumableRequest->depot?->name,
        ]);
    }

    // Rejeter une demande
    public function reject($id, Request $request)
    {
        $consumableRequest = ConsumableRequest::findOrFail($id);
        $approver = Auth::user();

        if (!$this->isDirectorUser($approver) && !$this->isStockManager($approver)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate(['reason' => 'nullable|string|max:1000']);

        $batchCode = $consumableRequest->batch_code;

        $requestsToReject = $batchCode
            ? ConsumableRequest::where('batch_code', $batchCode)
                ->whereIn('status', ['pending', 'validated_by_manager', 'draft'])
                ->get()
            : collect([$consumableRequest]);

        if ($requestsToReject->isEmpty()) {
            $requestsToReject = collect([$consumableRequest]);
        }

        DB::transaction(function () use ($requestsToReject, $request) {
            $reason = $request->input('reason');

            foreach ($requestsToReject as $req) {
                $req->status = 'rejected';
                if (Schema::hasColumn('consumable_requests', 'reject_reason')) {
                    $req->reject_reason = $reason;
                }
                $req->save();
            }

            try {
                $first   = $requestsToReject->first();
                $pdfPath = $this->generateAndSavePdf(
                    $first->user,
                    $requestsToReject->all(),
                    $first->batch_code,
                    null
                );

                if ($pdfPath) {
                    foreach ($requestsToReject as $req) {
                        $req->update(['pdf_path' => $pdfPath]);
                    }
                }
            } catch (\Throwable $e) {
                Log::error('Failed to generate PDF on reject', ['err' => $e->getMessage()]);
            }

            try {
                $this->notifyRequester($requestsToReject);
            } catch (\Throwable $e) {
                Log::error('Failed to notify requester on reject', ['err' => $e->getMessage()]);
            }
        });

        return response()->json(['message' => 'Demande(s) rejetee(s) avec succes.']);
    }

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------

    private function getAvailableStock(ConsumableRequest $consumableRequest): ?int
    {
        $hasProductIdColumn = Schema::hasColumn('consumable_requests', 'product_id');
        $productId = $hasProductIdColumn ? $consumableRequest->product_id : null;

        $product = null;
        if ($productId) {
            $product = Product::find($productId);
        }

        if (!$product) {
            $itemName = trim((string) $consumableRequest->item_name);
            if ($itemName !== '') {
                $product = Product::query()
                    ->whereRaw('LOWER(title) = ?', [mb_strtolower($itemName, 'UTF-8')])
                    ->orWhere('reference', $itemName)
                    ->first();
            }
        }

        if (!$product) return null;

        $stocksSum = (int) $product->stocks()->sum('quantity');
        return $stocksSum > 0 ? $stocksSum : (int) ($product->stock_quantity ?? 0);
    }

    /**
     * Get stock availability by depot for a product
     */
    private function getStockByDepot($productId, $requestedQuantity): array
    {
        $stockRows = $this->aggregateActiveStockByDepot((int) $productId);
        $stockInDepots = $stockRows->keyBy('depot_id')->toArray();

        // Also check product's own warehouse_location_id (stock_quantity field)
        $product = \App\Models\Product::find($productId);
        if ($product && $product->warehouse_location_id && $product->stock_quantity > 0) {
            $location = \App\Models\WarehouseLocation::with('room.warehouse')->find($product->warehouse_location_id);
            if ($location && $location->room && $location->room->warehouse) {
                $depotId = $location->room->warehouse->id;
                $depotName = $location->room->warehouse->name;

                if (isset($stockInDepots[$depotId])) {
                    $stockInDepots[$depotId]['total_quantity'] += $product->stock_quantity;
                } else {
                    $stockInDepots[$depotId] = [
                        'depot_id' => $depotId,
                        'depot_name' => $depotName,
                        'total_quantity' => $product->stock_quantity
                    ];
                }
            }
        }

        return $stockInDepots;
    }

    private function aggregateActiveStockByDepot(int $productId): \Illuminate\Support\Collection
    {
        $stocks = \App\Models\ProductStock::query()
            ->with(['warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse'])
            ->where('product_id', $productId)
            ->where('quantity', '>', 0)
            ->where(function ($q) {
                $q->whereNull('batch_status')
                  ->orWhere('batch_status', 'active');
            })
            ->get();

        $byDepot = [];
        foreach ($stocks as $s) {
            $warehouse = $s->warehouseLocation?->room?->warehouse ?: $s->warehouseCabinet?->room?->warehouse;
            if (!$warehouse) {
                continue;
            }

            $depotId = (int) $warehouse->id;
            if (!isset($byDepot[$depotId])) {
                $byDepot[$depotId] = [
                    'depot_id' => $depotId,
                    'depot_name' => (string) ($warehouse->name ?? ('Depot ' . $depotId)),
                    'total_quantity' => 0,
                ];
            }
            $byDepot[$depotId]['total_quantity'] += (int) $s->quantity;
        }

        return collect(array_values($byDepot));
    }

    /**
     * Resolve product id from explicit product_id or from free-text item name.
     */
    private function resolveProductId($productId, $itemName): ?int
    {
        if ($productId) {
            return (int) $productId;
        }

        $itemName = trim((string) $itemName);
        if ($itemName === '') {
            return null;
        }

        $nameLower = mb_strtolower($itemName, 'UTF-8');

        $product = \App\Models\Product::query()
            ->whereRaw('LOWER(title) = ?', [$nameLower])
            ->orWhereRaw('LOWER(reference) = ?', [$nameLower])
            ->first();

        if (!$product) {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $nameLower) . '%';
            $product = \App\Models\Product::query()
                ->whereRaw('LOWER(title) LIKE ?', [$like])
                ->orWhereRaw('LOWER(reference) LIKE ?', [$like])
                ->first();
        }

        return $product?->id ? (int) $product->id : null;
    }

    private function buildRequestPayload(Request $request): array
    {
        $hasProductIdColumn = Schema::hasColumn('consumable_requests', 'product_id');

        $rules = [
            'item_name'          => 'nullable|string|max:255',
            'requested_quantity' => 'required|integer|min:1',
        ];
        if ($hasProductIdColumn) {
            $rules['product_id'] = 'nullable|exists:products,id';
        }

        $validated = $request->validate($rules);

        $itemName  = trim((string) ($validated['item_name'] ?? ''));
        $productId = $hasProductIdColumn ? ($validated['product_id'] ?? null) : null;

        if ($productId) {
            $product = Product::query()->select(['id', 'title', 'status'])->find($productId);
            if ($product && Str::lower((string) $product->status) !== 'active') {
                throw ValidationException::withMessages([
                    'product_id' => ["Le produit \"{$product->title}\" est inactif."],
                ]);
            }
        }

        if (!$productId && $itemName !== '') {
            $matched = Product::query()
                ->select(['id', 'title', 'reference', 'status'])
                ->whereRaw('LOWER(title) = ?', [mb_strtolower($itemName, 'UTF-8')])
                ->orWhereRaw('LOWER(reference) = ?', [mb_strtolower($itemName, 'UTF-8')])
                ->first();

            if ($matched) {
                if (Str::lower((string) $matched->status) !== 'active') {
                    throw ValidationException::withMessages([
                        'item_name' => ["Le produit \"{$matched->title}\" est inactif."],
                    ]);
                }
                $productId = $matched->id;
            }
        }

        if ($productId && $itemName === '') {
            $itemName = (string) (Product::query()->whereKey($productId)->value('title') ?? '');
        }

        if ($itemName === '') {
            throw ValidationException::withMessages([
                'item_name' => 'Veuillez selectionner un produit ou saisir un article.'
            ]);
        }

        $payload = ['item_name' => $itemName, 'requested_quantity' => $validated['requested_quantity']];
        if ($hasProductIdColumn) {
            $payload['product_id'] = $productId;
        }

        return $payload;
    }

    private function buildCreateRequestPayloads(Request $request): array
    {
        $items = $request->input('items');
        if (is_array($items) && count($items) > 0) {
            $request->validate([
                'items'                      => 'required|array|min:1',
                'items.*.product_id'         => 'required|exists:products,id',
                'items.*.requested_quantity' => 'required|integer|min:1',
            ]);

            $productIds = collect($items)->pluck('product_id')->map(fn($v) => (int) $v)->unique()->values()->all();
            $inactive   = Product::query()
                ->whereIn('id', $productIds)
                ->where('status', '!=', 'active')
                ->pluck('title')
                ->values()
                ->all();

            if (count($inactive) > 0) {
                throw ValidationException::withMessages([
                    'items' => ['Produits inactifs: ' . implode(', ', $inactive)],
                ]);
            }

            $hasProductIdColumn = Schema::hasColumn('consumable_requests', 'product_id');
            $payloads = [];

            foreach ($items as $item) {
                $productId    = (int) ($item['product_id'] ?? 0);
                $qty          = (int) ($item['requested_quantity'] ?? 0);
                $productTitle = (string) (Product::query()->whereKey($productId)->value('title') ?? '');

                if ($productTitle === '') continue;

                $payload = [
                    'item_name' => $productTitle, 
                    'requested_quantity' => $qty,
                    'status' => $item['status'] ?? $request->input('status', 'draft')
                ];
                if ($hasProductIdColumn) {
                    $payload['product_id'] = $productId;
                }
                $payloads[] = $payload;
            }

            if (count($payloads) === 0) {
                throw ValidationException::withMessages(['items' => 'Aucun produit valide dans la demande.']);
            }

            return $payloads;
        }

        return [$this->buildRequestPayload($request)];
    }

    private function getMaxAllowedApproval(ConsumableRequest $consumableRequest, ?int $availableStock): int
    {
        $requested = (int) $consumableRequest->requested_quantity;
        if ($availableStock === null) return $requested;
        if ($availableStock <= 0) return 0;
        return min($requested, $availableStock);
    }

    private function computeSuggestedQuantity(ConsumableRequest $consumableRequest, ?int $availableStock): array
    {
        $requested   = (int) $consumableRequest->requested_quantity;
        $poste       = $this->getRequesterPoste($consumableRequest->user);
        $maxAllowed  = $this->getMaxAllowedApproval($consumableRequest, $availableStock);

        if ($availableStock === null) {
            if (Str::lower($poste) !== 'pdg') {
                return ['quantity' => min($requested, max(1, (int) floor($requested * 0.70))), 'reason' => 'Stock non lie: 70% de la demande.'];
            }
            return ['quantity' => $requested, 'reason' => 'Pas de stock lie, suggestion = demande.'];
        }

        if ($availableStock <= 0) return ['quantity' => 0, 'reason' => 'Stock indisponible.'];

        if (Str::lower($poste) === 'pdg') {
            return ['quantity' => min($requested, $availableStock), 'reason' => 'PDG: quantite complete selon stock.'];
        }

        if ($requested <= (int) floor($availableStock * 0.20)) {
            return ['quantity' => $maxAllowed, 'reason' => 'Demande <= 20% du stock: quantite complete.'];
        }

        return ['quantity' => min($maxAllowed, max(1, (int) floor($maxAllowed * 0.70))), 'reason' => 'Demande > 20% du stock: 70% approuvable.'];
    }

    private function getRequesterPoste(?User $user): string
    {
        $poste = trim((string) ($user?->poste ?? ''));
        return $poste !== '' ? $poste : (trim((string) ($user?->role ?? '')) ?: 'Non defini');
    }

    private function getRequesterName(?User $user): string
    {
        $name = trim((string) ($user?->nomprenom ?? $user?->name ?? ''));
        return $name !== '' ? $name : 'Utilisateur';
    }

    private function getRequesterService(?User $user): string
    {
        $service = trim((string) ($user?->service ?? ''));
        return $service !== '' ? $service : 'Non defini';
    }

    private function deductStock(Product $product, int $approvedQuantity): void
    {
        $remaining = $approvedQuantity;
        $stocks    = $product->stocks()->where('quantity', '>', 0)->orderBy('id')->lockForUpdate()->get();

        foreach ($stocks as $stock) {
            if ($remaining <= 0) break;
            $take = min((int) $stock->quantity, $remaining);
            $stock->quantity   = ((int) $stock->quantity) - $take;
            $stock->last_updated = now();
            $stock->save();
            $remaining -= $take;
        }
    }

    private function isPdgUser(?User $user): bool
    {
        return Str::lower((string) ($user?->poste ?? '')) === 'pdg'
            || $this->userHasAnyRole($user, ['pdg']);
    }

    private function isDirectorUser(?User $user): bool
    {
        // Only check the role - the 'poste' field is a job description and should NOT determine access level
        return $this->userHasAnyRole($user, ['directeur', 'durecteur', 'director']);
    }

    private function isStockManager(?User $user): bool
    {
        return $this->userHasAnyRole($user, ['responsable de stock', 'responsable', 'agent de stock', 'agent']);
    }

    private function isStockBelowThreshold(?int $availableStock, ?int $threshold, int $requested): bool
    {
        if ($availableStock === null) return false;
        if ($threshold !== null && $threshold > 0 && $availableStock < $threshold) return true;
        return $availableStock < $requested;
    }

    private function computeGroupStatus($group): string
    {
        $statuses = collect($group)->pluck('status')->map(fn($s) => Str::lower((string) $s));

        if ($statuses->contains('pending'))               return 'pending';
        if ($statuses->contains('validated_by_manager'))  return 'validated_by_manager';
        // Cas mixte: au moins un accepté (en attente ou livré) et au moins un refusé => toujours partiellement_accepte
        if (($statuses->contains('approved_pending_exit') || $statuses->contains('approved')) && $statuses->contains('rejected')) {
            return 'partiellement_accepte';
        }
        if ($statuses->contains('partiellement_accepte')) return 'partiellement_accepte';
        if ($statuses->contains('approved_pending_exit')) return 'approved_pending_exit';
        if ($statuses->every(fn($s) => $s === 'approved')) return 'approved';
        if ($statuses->contains('rejected'))              return 'rejected';

        return $statuses->first() ?? 'pending';
    }

    private function canRequesterEditOrDelete(?User $user, ConsumableRequest $consumableRequest): bool
    {
        if (!$user) return false;

        $isBusinessRequester = $this->userHasAnyRole($user, [
            'utilisateur', 'responsable', 'agent', 'gestionnaire', 'employee', 'employé', 'directeur', 'pdg',
        ]);

        return $isBusinessRequester && (int) $consumableRequest->user_id === (int) $user->id;
    }

    private function userHasAnyRole(?User $user, array $expectedRoles): bool
    {
        if (!$user) return false;

        // Ensure role relationship is loaded
        if (!$user->relationLoaded('role')) {
            $user->loadMissing('role');
        }

        $roleName = strtolower(trim($user->role?->name ?? ''));
        foreach ($expectedRoles as $expected) {
            if ($roleName === strtolower(trim($expected))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generer et sauvegarder le PDF.
     * $suffix : '_approved', '_rejected', ou null (cas général).
     */
    private function generateAndSavePdf(User $user, array $requests, ?string $batchCode, ?string $suffix = null): ?string
    {
        try {
            $data = [
                'user'       => $user,
                'requests'   => collect($requests),
                'batch_code' => $batchCode,
                'forceTitle' => null,
            ];

            $pdf = Pdf::loadView('pdf.consumable_request', $data);

            $firstRequest = collect($requests)->first();
            $status       = strtolower($firstRequest->status ?? 'pending');

            $statusPrefix = match (true) {
                $status === 'rejected'              => 'refus',
                $status === 'approved'              => 'sortie',
                $status === 'approved_pending_exit' => 'approuve',
                $status === 'validated_by_manager'  => 'validee',
                default                             => 'demande',
            };

            $suffixStr = $suffix ?? '';
            $fileName  = $statusPrefix . $suffixStr . '_' . ($batchCode ?: 'REQ-' . $firstRequest->id) . '_' . uniqid() . '_' . time() . '.pdf';
            $filePath  = 'requests/' . $fileName;

            \Illuminate\Support\Facades\Storage::disk('public')->put($filePath, $pdf->output());

            foreach ($requests as $req) {
                if (!$req->product_id) continue;

                $indStatus   = strtolower((string) $req->status);
                $docType     = match ($indStatus) {
                    'approved'              => 'bon_sortie',
                    'rejected'              => 'refus',
                    'approved_pending_exit' => 'demande_approuvee',
                    default                 => 'demande',
                };
                $titlePrefix = match ($indStatus) {
                    'approved'              => 'Bon de sortie',
                    'rejected'              => 'Refus de demande',
                    'approved_pending_exit' => 'Bon de demande approuvee',
                    default                 => 'Demande de consommables',
                };

                Document::create([
                    'user_id'    => $user->id,
                    'product_id' => $req->product_id,
                    'title'      => $titlePrefix . ' - ' . ($req->item_name ?: 'Produit') . ' (' . ($batchCode ?: 'REQ-' . $req->id) . ')',
                    'type'       => $docType,
                    'direction'  => 'out',
                    'status'     => 'applied',
                    'path'       => $filePath,
                ]);
            }

            return $filePath;
        } catch (\Throwable $e) {
            Log::error('PDF generation error', ['msg' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Méthode dédiée pour générer et stocker un PDF (alias avec nom explicite).
     */
    private function generateAndStorePdf($requests, User $user, ?string $batchCode, string $suffix): ?string
    {
        return $this->generateAndSavePdf($user, collect($requests)->all(), $batchCode, $suffix);
    }

    private function notifyDirectors($requests): int
    {
        $requests = collect($requests);
        $first    = $requests->first();
        if (!$first) return 0;

        $directors = User::query()
            ->where(function ($q) {
                $q->whereHas('role', function($rq) {
                    $rq->whereIn('name', ['Administrateur', 'Directeur', 'directeur', 'durecteur', 'director', 'Administrateur']);
                })
                  ->orWhereRaw('LOWER(poste) IN (?, ?, ?)', ['directeur', 'durecteur', 'director']);
            })
            ->where('id', '!=', Auth::id())
            ->where('service', $first->user?->service)
            ->where('siege',   $first->user?->siege)
            ->get();

        $count = 0;
        foreach ($directors as $director) {
            try {
                $director->notify(new \App\Notifications\ConsumableRequestNotification($requests));
                $count++;
            } catch (\Throwable $e) {
                Log::error('Notification director error', ['err' => $e->getMessage()]);
            }
        }
        return $count;
    }

    private function notifyStockManagers($requests): int
    {
        $requests = collect($requests);
        $first    = $requests->first();
        if (!$first) return 0;

        // Find the responsable who has the quantities in their depot
        // First, get the product from the request
        $productId = $this->resolveProductId($first->product_id, $first->item_name);

        if (!$productId) {
            // If no product found, notify all managers as fallback
            return $this->notifyAllStockManagers($requests);
        }

        // Find which depot has stock for this product
        // Hierarchy: ProductStock -> WarehouseLocation -> WarehouseRoom -> Warehouse
        $stockInDepots = $this->aggregateActiveStockByDepot((int) $productId);

        if ($stockInDepots->isEmpty()) {
            // No stock found in any depot, notify all managers
            return $this->notifyAllStockManagers($requests);
        }

        // Find responsables assigned to these depots
        $depotIds = $stockInDepots->pluck('depot_id')->unique()->toArray();
        $responsables = User::query()
            ->whereIn('depot_id', $depotIds)
            ->whereHas('role', function($rq) {
                $rq->whereIn('name', ['Responsable de stock', 'Responsable', 'Agent de stock', 'Agent', 'responsable de stock', 'responsable', 'agent de stock', 'agent']);
            })
            ->where('id', '!=', Auth::id())
            ->get();

        if ($responsables->isEmpty()) {
            // No responsables found for these depots, notify all managers
            return $this->notifyAllStockManagers($requests);
        }

        // Notify only the responsables who have stock for this product
        $count = 0;
        foreach ($responsables as $manager) {
            try {
                $manager->notify(new \App\Notifications\ConsumableRequestNotification($requests));
                $count++;
            } catch (\Throwable $e) {
                Log::error('Notification manager error', ['err' => $e->getMessage()]);
            }
        }

        return $count;
    }

    /**
     * Notify stock managers grouped by depot
     * Only notifies responsables who actually have the product stock in their depot
     */
    private function notifyStockManagersByDepot($requests): int
    {
        $requests = collect($requests);
        if ($requests->isEmpty()) return 0;

        // Check if any request has depot_id assigned
        $requestsWithDepot = $requests->filter(fn($r) => $r->depot_id);

        if ($requestsWithDepot->isEmpty()) {
            // No depot assigné: ne pas diffuser globalement
            return 0;
        }

        // Group requests by depot_id
        $requestsByDepot = $requestsWithDepot->groupBy('depot_id');
        $totalNotified = 0;

        foreach ($requestsByDepot as $depotId => $depotRequests) {
            // For each request, check if the product actually has stock in this depot
            $validRequests = collect();
            foreach ($depotRequests as $req) {
                $productId = $this->resolveProductId($req->product_id, $req->item_name);

                if ($productId) {
                    // Check if this product has stock in this specific depot
                    $hasStockInDepot = $this->aggregateActiveStockByDepot((int) $productId)
                        ->contains(fn($row) => (int) ($row['depot_id'] ?? 0) === (int) $depotId);

                    if ($hasStockInDepot) {
                        $validRequests->push($req);
                    }
                } else {
                    // If no product found, include the request anyway
                    $validRequests->push($req);
                }
            }

            if ($validRequests->isEmpty()) {
                // No valid requests with stock in this depot, skip notification
                continue;
            }

            // Find responsables assigned to this depot
            $responsables = User::query()
                ->where('depot_id', $depotId)
                ->whereHas('role', function($rq) {
                    $rq->whereIn('name', ['Responsable de stock', 'Responsable', 'Agent de stock', 'Agent', 'responsable de stock', 'responsable', 'agent de stock', 'agent']);
                })
                ->where('id', '!=', Auth::id())
                ->get();

            // Generate a depot-specific PDF for responsible notifications only.
            $depotPdfPath = null;
            try {
                $firstReq = $validRequests->first();
                if ($firstReq && $firstReq->user) {
                    $depotPdfPath = $this->generateAndSavePdf(
                        $firstReq->user,
                        $validRequests->values()->all(),
                        $firstReq->batch_code,
                        '_approved_depot_' . (int) $depotId
                    );
                }
            } catch (\Throwable $e) {
                Log::error('Depot PDF generation error', ['err' => $e->getMessage(), 'depot_id' => $depotId]);
            }

            $requestsForNotification = $validRequests->map(function ($req) use ($depotPdfPath) {
                $clone = clone $req;
                if ($depotPdfPath) {
                    $clone->pdf_path = $depotPdfPath;
                }
                return $clone;
            });

            foreach ($responsables as $manager) {
                try {
                    $manager->notify(new \App\Notifications\ConsumableRequestNotification($requestsForNotification));
                    $totalNotified++;
                } catch (\Throwable $e) {
                    Log::error('Notification manager by depot error', ['err' => $e->getMessage()]);
                }
            }
        }

        return $totalNotified;
    }

    /**
     * Notify all stock managers (fallback method)
     */
    private function notifyAllStockManagers($requests): int
    {
        $requests = collect($requests);
        $first    = $requests->first();
        if (!$first) return 0;

        $managers = User::query()
            ->whereHas('role', function($rq) {
                $rq->whereIn('name', ['Responsable de stock', 'Responsable', 'Agent de stock', 'Agent', 'responsable de stock', 'responsable', 'agent de stock', 'agent']);
            })
            ->where('id', '!=', Auth::id())
            ->get();

        $count = 0;
        foreach ($managers as $manager) {
            try {
                $manager->notify(new \App\Notifications\ConsumableRequestNotification($requests));
                $count++;
            } catch (\Throwable $e) {
                Log::error('Notification manager error', ['err' => $e->getMessage()]);
            }
        }
        return $count;
    }

    private function notifyRequester($requests): int
    {
        $requests = collect($requests);
        $first    = $requests->first();
        if (!$first || !$first->user) return 0;

        try {
            $first->user->notify(new \App\Notifications\ConsumableRequestNotification($requests));
            return 1;
        } catch (\Throwable $e) {
            Log::error('Notification requester error', ['err' => $e->getMessage()]);
            return 0;
        }
    }

    /**
     * Notification dédiée pour l'approbation partielle :
     * envoie UN seul mail avec les 2 collections (approuvés + rejetés)
     * afin que la notification puisse attacher les 2 PDFs.
     */
    private function notifyRequesterPartial($approvedRequests, $rejectedRequests): int
    {
        $approvedRequests = collect($approvedRequests);
        $rejectedRequests = collect($rejectedRequests);

        // Fusionner pour que la notification reçoive tous les items du lot
        $allRequests = $approvedRequests->merge($rejectedRequests);
        $first       = $allRequests->first();
        if (!$first || !$first->user) return 0;

        try {
            Log::info('Sending partial notification to user', ['email' => $first->user->email, 'items' => $allRequests->count()]);
            $first->user->notify(new \App\Notifications\ConsumableRequestNotification($allRequests));
            return 1;
        } catch (\Throwable $e) {
            Log::error('Notification requester partial error', ['err' => $e->getMessage()]);
            return 0;
        }
    }
}
