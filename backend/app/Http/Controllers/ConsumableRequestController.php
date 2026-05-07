<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\ConsumableRequest;
use App\Models\Product;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\StockMovement;
use App\Models\StockMovementLine;
use App\Notifications\StockMovementNotification;
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

        $query = ConsumableRequest::with('user.roles', 'product')->latest();

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->input('end_date'));
        }

        if ($this->isDirectorUser($user) || $this->isStockManager($user)) {
            if ($this->isDirectorUser($user)) {
                $query->whereHas('user', function ($q) use ($user) {
                    $q->where('service', $user->service)
                      ->where('siege', $user->siege);
                });
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
                        'items'            => $items,
                    ];
                })
                ->values();
        } else {
            $requests = $query->where('user_id', $user->id)
                ->get()
                ->groupBy(fn($req) => $req->batch_code ?: $req->id)
                ->map(function ($group) {
                    $first = $group->first();
                    $items = $group->values();

                    return [
                        'id'               => $first->id,
                        'batch_code'       => $first->batch_code,
                        'item_name'        => count($items) > 1 ? count($items) . ' produits' : $first->item_name,
                        'requested_quantity' => $group->sum('requested_quantity'),
                        'approved_quantity'  => $group->sum('approved_quantity') ?: null,
                        'status'           => $this->computeGroupStatus($group),
                        'created_at'       => $first->created_at,
                        'user'             => $first->user,
                        'requester_name'   => $this->getRequesterName($first->user),
                        'requester_service'=> $this->getRequesterService($first->user),
                        'requester_poste'  => $this->getRequesterPoste($first->user),
                        'pdf_path'         => $first->pdf_path,
                        'items'            => $items,
                    ];
                })
                ->values();
        }

        return response()->json($requests);
    }

    // Creer une nouvelle demande
    public function store(Request $request)
    {
        $user = Auth::user();

        if (!$this->userHasAnyRole($user, ['utilisateur', 'responsable', 'agent', 'gestionnaire', 'employee', 'pdg'])) {
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

            foreach ($payloads as $payload) {
                $initialStatus = isset($payload['status']) ? $payload['status'] : 'draft';
                if (!in_array($initialStatus, ['draft', 'pending', 'approved', 'rejected'], true)) {
                    $initialStatus = 'draft';
                }

                if ($this->isStockManager($user) && $initialStatus === 'pending') {
                    $initialStatus = 'approved_pending_exit';
                    $payload['approved_quantity'] = $payload['requested_quantity'];
                }

                $createdRequests[] = ConsumableRequest::create(array_merge($payload, [
                    'user_id'    => $user->id,
                    'batch_code' => $batchCode,
                    'status'     => $initialStatus,
                ]));
            }
        });

        $firstStatus = collect($createdRequests)->first()?->status ?? null;
        if ($firstStatus === 'pending' && count($createdRequests) > 0) {
            $this->notifyDirectors(collect($createdRequests));
        } elseif ($firstStatus === 'approved_pending_exit' && count($createdRequests) > 0) {
            $this->notifyStockManagers(collect($createdRequests));
        }

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
            $consumableRequest->update(['status' => $requestedStatus]);

            if ($consumableRequest->batch_code) {
                ConsumableRequest::where('batch_code', $consumableRequest->batch_code)
                    ->update(['status' => $requestedStatus]);
            }

            if (Str::lower($oldStatus) !== 'pending' && $requestedStatus === 'pending') {
                $batch = $consumableRequest->batch_code
                    ? ConsumableRequest::where('batch_code', $consumableRequest->batch_code)->get()
                    : collect([$consumableRequest]);
                $this->notifyDirectors($batch);
            }

            return response()->json([
                'message' => 'Request updated successfully.',
                'request' => $consumableRequest->fresh(['user.roles', 'product']),
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
            'request' => $consumableRequest->fresh(['user.roles', 'product']),
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
        $consumableRequest = ConsumableRequest::with('user.roles')->findOrFail($id);
        $approver  = Auth::user();
        $isDirector = $this->isDirectorUser($approver);
        $isManager  = $this->isStockManager($approver);

        if (!$isDirector && !$isManager) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $currentStatus = Str::lower((string) $consumableRequest->status);
        $nextStatus    = null;

        if ($isManager && $currentStatus === 'pending') {
            $nextStatus = 'validated_by_manager';
        } elseif ($isDirector && in_array($currentStatus, ['pending', 'validated_by_manager'], true)) {
            $nextStatus = 'approved_pending_exit';
        } else {
            return response()->json(['message' => 'Workflow step not applicable for your role or current status.'], 422);
        }

        $request->validate([
            'approved_quantity'    => 'nullable|integer|min:0',
            'approved_quantities'  => 'nullable|array',
            'approved_quantities.*'=> 'nullable|integer|min:0',
        ]);

        $batchCode         = $consumableRequest->batch_code;
        $requestsToApprove = $batchCode
            ? ConsumableRequest::where('batch_code', $batchCode)->where('status', $consumableRequest->status)->get()
            : collect([$consumableRequest]);

        DB::transaction(function () use ($requestsToApprove, $request, $nextStatus) {
            $approvedQuantitiesMap = collect($request->input('approved_quantities', []));

            foreach ($requestsToApprove as $req) {
                $availableStock = $this->getAvailableStock($req);
                $suggestion     = $this->computeSuggestedQuantity($req, $availableStock);

                $mapQty = $approvedQuantitiesMap->has((string) $req->id)
                    ? (int) $approvedQuantitiesMap->get((string) $req->id)
                    : null;

                $approvedQty = $mapQty;
                if ($approvedQty === null) {
                    $approvedQty = $request->has('approved_quantity')
                        ? (int) $request->input('approved_quantity')
                        : (int) ($suggestion['quantity'] ?? $req->requested_quantity ?? 0);
                }

                $req->approved_quantity = max(0, $approvedQty);
                $req->status            = $nextStatus;
                $req->save();
            }

            // Regenerer le PDF uniquement pour les demandes de ce lot
            try {
                $batchUser = $requestsToApprove->first()?->user;
                $bc        = $requestsToApprove->first()?->batch_code;
                if ($batchUser) {
                    $pdfPath = $this->generateAndSavePdf(
                        $batchUser,
                        $requestsToApprove->all(),
                        $bc,
                        null   // laisser la vue Blade determiner le titre selon les statuts reels
                    );
                    if ($pdfPath) {
                        foreach ($requestsToApprove as $req) {
                            $req->update(['pdf_path' => $pdfPath]);
                        }
                    }
                }
            } catch (\Throwable $e) {
                Log::error('PDF Regeneration on Approve failed', ['error' => $e->getMessage()]);
            }

            if ($nextStatus === 'validated_by_manager') {
                $this->notifyDirectors($requestsToApprove);
            } elseif ($nextStatus === 'approved_pending_exit') {
                $this->notifyRequester($requestsToApprove);
                $this->notifyStockManagers($requestsToApprove);
            }
        });

        return response()->json([
            'message' => 'Demande passee au statut : ' . $nextStatus,
            'status'  => $nextStatus,
        ]);
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
            'source_warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'source_cabinet_id'            => 'nullable|exists:warehouse_cabinets,id',
            'destination_text'             => 'nullable|string|max:255',
            'motif'                        => 'nullable|string|max:500',
        ]);

        Log::info('confirmExit payload', $request->all());

        DB::transaction(function () use ($consumableRequest, $user, $request) {
            $sourceLocationId = $request->input('source_warehouse_location_id');
            $sourceCabinetId  = $request->input('source_cabinet_id');
            $destinationText  = $request->input('destination_text') ?: $this->getRequesterName($consumableRequest->user);
            $motif            = $request->input('motif', 'Sortie confirmee suite validation Direction');

            $productId = $consumableRequest->product_id;
            if (!$productId) {
                $name = trim((string) $consumableRequest->item_name);
                $productId = \App\Models\Product::where('title', 'like', $name)
                    ->orWhereRaw('LOWER(title) = ?', [mb_strtolower($name, 'UTF-8')])
                    ->value('id');
            }

            $approvedQuantity = (int) ($consumableRequest->approved_quantity ?: $consumableRequest->requested_quantity);

            if ($productId && $approvedQuantity > 0 && Schema::hasColumn('consumable_requests', 'product_id') && !$consumableRequest->product_id) {
                $consumableRequest->update(['product_id' => $productId]);
            }

            $consumableRequest->status = 'approved';
            $consumableRequest->save();

            // Regenerer le PDF de sortie uniquement pour les demandes du lot
            try {
                $batchRequests = $consumableRequest->batch_code
                    ? ConsumableRequest::where('batch_code', $consumableRequest->batch_code)->get()
                    : collect([$consumableRequest]);

                $batchRequests->each->refresh();

                $pdfPath = $this->generateAndSavePdf(
                    $consumableRequest->user,
                    $batchRequests->all(),
                    $consumableRequest->batch_code,
                    null   // la vue Blade detecte que tout est "approved" => "BON DE SORTIE"
                );
                if ($pdfPath) {
                    foreach ($batchRequests as $req) {
                        $req->update(['pdf_path' => $pdfPath]);
                    }
                }
            } catch (\Throwable $e) {
                Log::error('Failed to regenerate PDF on confirmExit', ['err' => $e->getMessage()]);
            }

            if ($approvedQuantity > 0) {
                $movement = StockMovement::create([
                    'movement_type'               => 'out',
                    'reference'                   => 'REQ-' . $consumableRequest->id,
                    'created_by'                  => $user->id,
                    'related_request_id'          => $consumableRequest->id,
                    'source_warehouse_location_id'=> $sourceLocationId,
                    'source_cabinet_id'           => $sourceCabinetId,
                    'motif'                       => $motif,
                    'destination_text'            => $destinationText,
                    'status'                      => 'validated',
                ]);

                StockMovementLine::create([
                    'stock_movement_id' => $movement->id,
                    'product_id'        => $productId,
                    'quantity'          => $approvedQuantity,
                ]);

                try {
                    AuditLog::create([
                        'user_id'     => $user->id,
                        'action'      => 'stock_movement.create',
                        'description' => "Sortie confirmee. Mouvement {$movement->id} pour demande {$consumableRequest->id}. Destination: {$destinationText}",
                        'ip_address'  => request()->ip(),
                        'user_agent'  => request()->userAgent(),
                    ]);
                } catch (\Throwable $e) {
                    Log::error('Failed to create audit log for confirmExit', ['err' => $e->getMessage()]);
                }

                try {
                    $consumableRequest->refresh();
                    $batchRequests = $consumableRequest->batch_code
                        ? ConsumableRequest::where('batch_code', $consumableRequest->batch_code)->get()
                        : collect([$consumableRequest]);

                    $consumableRequest->user->notify(new \App\Notifications\ConsumableRequestNotification($batchRequests));
                    $consumableRequest->user->notify(new \App\Notifications\StockMovementNotification($movement));
                } catch (\Throwable $e) {
                    Log::error('Failed to notify owner on confirmExit', ['err' => $e->getMessage()]);
                }

                try {
                    $prod = \App\Models\Product::find($productId);
                    if ($prod) {
                        $prod->decrement('stock_quantity', $approvedQuantity);
                    }
                } catch (\Throwable $e) {
                    Log::error('Failed to decrement global product stock', ['err' => $e->getMessage()]);
                }
            }
        });

        return response()->json([
            'message' => 'Sortie confirmee. Stock mis a jour.',
            'request' => $consumableRequest->fresh(['user.roles', 'product']),
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

        // ----------------------------------------------------------------
        // CORRECTION : on ne recupere QUE les demandes de ce lot/id
        // et on ne rejette que celles qui sont en attente ou validees
        // ----------------------------------------------------------------
        $requestsToReject = $batchCode
            ? ConsumableRequest::where('batch_code', $batchCode)
                ->whereIn('status', ['pending', 'validated_by_manager', 'draft'])
                ->get()
            : collect([$consumableRequest]);

        // Si aucune demande a rejeter via batch, on prend uniquement celle-ci
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

            // ----------------------------------------------------------------
            // CORRECTION PRINCIPALE : generer le PDF UNIQUEMENT avec les
            // demandes rejetees de ce lot, pas toutes les demandes du user
            // ----------------------------------------------------------------
            try {
                $first   = $requestsToReject->first();
                $pdfPath = $this->generateAndSavePdf(
                    $first->user,
                    $requestsToReject->all(),   // <-- uniquement CE lot
                    $first->batch_code,
                    null    // la vue Blade detecte que tout est rejected => "BON DE REFUS"
                );

                // CORRECTION : sauvegarder le pdf_path sur chaque demande rejetee
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

                $payload = ['item_name' => $productTitle, 'requested_quantity' => $qty];
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
            || $this->userHasAnyRole($user, ['pdg'])
            || Str::lower((string) ($user?->role ?? '')) === 'pdg';
    }

    private function isDirectorUser(?User $user): bool
    {
        return $this->userHasAnyRole($user, ['directeur', 'durecteur', 'director'])
            || in_array(Str::lower((string) ($user?->poste ?? '')), ['directeur', 'durecteur', 'director'], true)
            || in_array(Str::lower((string) ($user?->role ?? '')), ['directeur', 'durecteur', 'director'], true);
    }

    private function isStockManager(?User $user): bool
    {
        return $this->userHasAnyRole($user, ['responsable de stock', 'responsable', 'agent de stock', 'agent'])
            || in_array(Str::lower((string) ($user?->role ?? '')), ['responsable de stock', 'responsable', 'agent de stock', 'agent'], true);
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

        if ($statuses->contains('pending'))              return 'pending';
        if ($statuses->contains('validated_by_manager')) return 'validated_by_manager';
        if ($statuses->contains('rejected'))             return 'rejected';
        if ($statuses->contains('approved_pending_exit'))return 'approved_pending_exit';
        if ($statuses->every(fn($s) => $s === 'approved')) return 'approved';

        return $statuses->first() ?? 'pending';
    }

    private function canRequesterEditOrDelete(?User $user, ConsumableRequest $consumableRequest): bool
    {
        if (!$user || $this->isDirectorUser($user)) return false;

        $isBusinessRequester = $this->userHasAnyRole($user, [
            'utilisateur', 'responsable', 'agent', 'gestionnaire', 'employee', 'pdg',
        ]);

        return $isBusinessRequester && (int) $consumableRequest->user_id === (int) $user->id;
    }

    private function userHasAnyRole(?User $user, array $expectedRoles): bool
    {
        if (!$user) return false;

        $normalizedExpected = collect($expectedRoles)
            ->map(fn($r) => Str::lower((string) $r))
            ->filter()->unique()->values();

        $currentRoles = $user->getRoleNames()->map(fn($r) => Str::lower((string) $r));

        $fallbackRole = Str::lower((string) ($user->role ?? ''));
        if ($fallbackRole !== '') $currentRoles->push($fallbackRole);

        return $currentRoles->unique()->intersect($normalizedExpected)->isNotEmpty();
    }

    /**
     * Generer et sauvegarder le PDF.
     *
     * IMPORTANT : $requests doit contenir UNIQUEMENT les articles
     * du lot concerne, pas toutes les demandes du user.
     * Le titre est determine automatiquement par la vue Blade
     * selon les statuts reels (forceTitle = null recommande).
     */
    private function generateAndSavePdf(User $user, array $requests, ?string $batchCode, ?string $forceTitle = null): ?string
    {
        try {
            $data = [
                'user'       => $user,
                'requests'   => collect($requests),
                'batch_code' => $batchCode,
                'forceTitle' => $forceTitle,
            ];

            $pdf = Pdf::loadView('pdf.consumable_request', $data);

            $firstRequest  = collect($requests)->first();
            $status        = strtolower($firstRequest->status ?? 'pending');

            $statusPrefix  = match (true) {
                $status === 'rejected'              => 'refus',
                $status === 'approved'              => 'sortie',
                $status === 'approved_pending_exit' => 'approuve',
                $status === 'validated_by_manager'  => 'validee',
                default                             => 'demande',
            };

            $fileName = $statusPrefix . '_' . ($batchCode ?: 'REQ-' . $firstRequest->id) . '_' . uniqid() . '_' . time() . '.pdf';
            $filePath = 'requests/' . $fileName;

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
                    'approved_pending_exit' => 'Demande approuvee',
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

    private function notifyDirectors($requests): int
    {
        $requests = collect($requests);
        $first    = $requests->first();
        if (!$first) return 0;

        $directors = User::query()
            ->where(function ($q) {
                $q->whereHas('roles', fn($r) => $r->whereRaw('LOWER(name) IN (?, ?, ?)', ['directeur', 'durecteur', 'director']))
                  ->orWhereRaw('LOWER(poste) IN (?, ?, ?)', ['directeur', 'durecteur', 'director'])
                  ->orWhereRaw('LOWER(role) IN (?, ?, ?)',  ['directeur', 'durecteur', 'director']);
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

        $managers = User::query()
            ->where(function ($q) {
                $q->whereHas('roles', fn($r) => $r->whereRaw('LOWER(name) IN (?, ?, ?, ?)', ['responsable de stock', 'responsable', 'agent de stock', 'agent']))
                  ->orWhereRaw('LOWER(role) IN (?, ?, ?, ?)', ['responsable de stock', 'responsable', 'agent de stock', 'agent']);
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
}
