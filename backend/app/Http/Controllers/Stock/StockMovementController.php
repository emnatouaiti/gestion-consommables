<?php

namespace App\Http\Controllers\Stock;

use App\Http\Controllers\Controller;

use App\Models\StockMovement;
use App\Models\StockMovementLine;
use App\Models\User;
use App\Models\Document;
use App\Notifications\StockMovementResponseNotification;
use App\Notifications\StockMovementNotification;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use App\Models\ProductStock;
use App\Models\Product;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockMovementController extends Controller
{
    public function index(Request $request)
    {
        $query = StockMovement::query()
            ->with([
                'lines.product',
                'lines.location',
                'lines.cabinet',
                'creator',
                'validator',
                'destinationUser',
            'supplier',
            'document',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
            'sourceCabinet',
            'destinationCabinet',
            ])
            ->latest();

        // By default, hide legacy static movements without lines, but keep OCR/document/image movements.
        if (!$request->boolean('include_legacy')) {
            $query->where(function ($q) {
                $q->whereHas('lines')
                  ->orWhereNotNull('document_id')
                  ->orWhereNotNull('in_image_path')
                  ->orWhereNotNull('out_image_path')
                  ->orWhereNotNull('supplier_id')
                  ->orWhereNotNull('related_request_id');
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $user = Auth::user();
        if ($user && $user->depot_id && !$this->userHasAnyRole($user, ['Administrateur'])) {
            $depotId = (int) $user->depot_id;
            $query->where(function ($q) use ($user, $depotId) {
                // Primary: Fast index-based lookup
                $q->where('depot_id', $depotId)
                  ->orWhere(function ($q2) use ($user, $depotId) {
                      // Fallback ONLY for legacy records missing the depot_id
                      $q2->whereNull('depot_id')
                         ->where(function ($q3) use ($user, $depotId) {
                             $q3->where('created_by', $user->id)
                                ->orWhereHas('sourceWarehouseLocation.room', fn($sq) => $sq->where('warehouse_id', $depotId))
                                ->orWhereHas('destinationWarehouseLocation.room', fn($sq) => $sq->where('warehouse_id', $depotId))
                                ->orWhereHas('lines.location.room', fn($sq) => $sq->where('warehouse_id', $depotId))
                                ->orWhereHas('sourceCabinet.room', fn($sq) => $sq->where('warehouse_id', $depotId))
                                ->orWhereHas('destinationCabinet.room', fn($sq) => $sq->where('warehouse_id', $depotId))
                                ->orWhereHas('lines.cabinet.room', fn($sq) => $sq->where('warehouse_id', $depotId));
                         });
                  });
            });
        }
        if ($request->filled('movement_type')) {
            $query->where('movement_type', $request->input('movement_type'));
        }
        if ($request->filled('reference')) {
            $query->where('reference', 'like', '%' . $request->input('reference') . '%');
        }
        if ($request->filled('created_by')) {
            $query->where('created_by', $request->input('created_by'));
        }
        if ($request->filled('related_request_id')) {
            $query->where('related_request_id', $request->input('related_request_id'));
        }
        if ($request->filled('product_id')) {
            $productId = (int) $request->input('product_id');
            $query->whereHas('lines', fn ($q) => $q->where('product_id', $productId));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $perPage = (int) $request->input('per_page', 20);
        $perPage = max(5, min(100, $perPage));

        return response()->json($query->paginate($perPage));
    }

    public function show($id)
    {
        $movement = StockMovement::with([
            'lines.product',
            'lines.location',
            'lines.cabinet',
            'creator',
            'validator',
            'supplier',
            'document',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
            'sourceCabinet',
            'destinationCabinet',
        ])->findOrFail($id);
        return response()->json($movement);
    }

    /**
     * Final step: Execute the movement (update stock)
     */
    public function validateMovement(Request $request, $id)
    {
        $user = Auth::user();
        $movement = StockMovement::with('lines.product')->findOrFail($id);

        if ($movement->status === 'executed') {
            return response()->json(['message' => 'Ce mouvement est dÃjÃ  exÃcutÃ.'], 400);
        }

        // If it's pending_validation, only managers can execute directly
        if ($movement->status === 'pending_validation') {
            if (!$this->userHasAnyRole($user, ['Responsable de stock', 'Responsable', 'Administrateur'])) {
                return response()->json(['message' => 'Ce mouvement doit d\'abord Ãªtre approuvÃ par un responsable.'], 403);
            }
        } elseif ($movement->status !== 'approved') {
             return response()->json(['message' => 'Ce mouvement doit Ãªtre approuvÃ avant d\'Ãªtre exÃcutÃ.'], 400);
        }

        if ($movement->lines->count() === 0) {
            return response()->json(['message' => 'Mouvement vide.'], 422);
        }

        DB::transaction(function () use ($movement, $user, $request) {
            $this->executeMovementInternal($movement, $user);

            // Update associated document if exists
            if ($movement->document_id) {
                Document::where('id', $movement->document_id)->update(['status' => 'applied']);
            }

            // Generate/Update PDF if needed (optional here since approved already did it)
            if (!$movement->response_pdf_path) {
                $this->generateResponsePdf($movement, $request->input('notes'));
            }
        });

        return response()->json($movement->fresh([
            'lines.product',
            'creator',
            'validator',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
            'sourceCabinet',
            'destinationCabinet',
        ]));
    }

    /**
     * Intermediate step: Approve without updating stock
     */
    public function approve(Request $request, $id)
    {
        $user = Auth::user();
        if (!$this->userHasAnyRole($user, ['Responsable de stock', 'Responsable', 'Administrateur'])) {
            return response()->json(['message' => 'Non autorisÃ.'], 403);
        }

        $movement = StockMovement::findOrFail($id);
        if ($movement->status !== 'pending_validation') {
            return response()->json(['message' => 'Ce mouvement n\'est pas en attente de validation.'], 400);
        }

        DB::transaction(function() use ($movement, $request, $user) {
            $movement->update([
                'response_notes' => $request->input('notes'),
                'validated_by' => $user->id
            ]);

            // Execute the movement directly
            $this->executeMovementInternal($movement, $user);

            // Generate PDF and notify agent
            $this->generateResponsePdf($movement, $request->input('notes'));

            if ($movement->creator) {
                $movement->creator->notify(new StockMovementResponseNotification($movement));
            }

        });

        return response()->json($movement->fresh([
            'lines.product',
            'creator',
            'validator',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
            'sourceCabinet',
            'destinationCabinet',
        ]));
    }

    /**
     * Reject a pending movement
     */
    public function reject(Request $request, $id)
    {
        $user = Auth::user();
        if (!$this->userHasAnyRole($user, ['Responsable de stock', 'Responsable', 'Administrateur'])) {
            return response()->json(['message' => 'Non autorisÃ.'], 403);
        }

        $movement = StockMovement::findOrFail($id);
        if ($movement->status !== 'pending_validation') {
            return response()->json(['message' => 'Ce mouvement n\'est pas en attente.'], 400);
        }

        DB::transaction(function() use ($movement, $request, $user) {
            $movement->update([
                'status' => 'cancelled',
                'rejected_at' => now(),
                'validated_by' => $user->id,
                'response_notes' => $request->input('notes')
            ]);

            if ($movement->document_id) {
                Document::where('id', $movement->document_id)->update(['status' => 'rejected']);
            }

            // Generate PDF and notify agent
            $this->generateResponsePdf($movement, $request->input('notes'));

            if ($movement->creator) {
                $movement->creator->notify(new StockMovementResponseNotification($movement));
            }

        });

        return response()->json($movement->fresh([
            'lines.product',
            'creator',
            'validator',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
            'sourceCabinet',
            'destinationCabinet',
        ]));
    }

    /**
     * Generate a PDF for the response
     */
    private function generateResponsePdf(StockMovement $movement, $notes = null)
    {
        $movement->load(['lines.product', 'creator', 'validator']);
        $movement->response_notes = $notes; // Temporary set if not saved yet

        $pdf = Pdf::loadView('pdf.movement_response', ['movement' => $movement]);

        $filename = 'responses/decision_' . $movement->id . '_' . time() . '.pdf';
        Storage::disk('public')->put($filename, $pdf->output());

        $movement->update(['response_pdf_path' => $filename]);
    }

    /**
     * Helper to check user roles robustly
     */
    private function userHasAnyRole($user, array $roles): bool
    {
        if (!$user) return false;
        $roleName = strtolower(trim($user->role?->name ?? ''));
        foreach ($roles as $expected) {
            if ($roleName === strtolower(trim($expected))) {
                return true;
            }
        }
        return false;
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        $request->validate([
            'movement_type' => 'required_without:type|in:in,out,transfer',
            'type'          => 'nullable|in:in,out,transfer',
            'reference'     => 'nullable|string',
            'notes'         => 'nullable|string',
            'motif'         => 'nullable|string|max:500',
            'destination_text' => 'nullable|string|max:500',
            'supplier_id'   => 'nullable|exists:suppliers,id',
            'supplier_contact_id' => 'nullable|integer',
            'source_warehouse_location_id'      => 'nullable|exists:warehouse_locations,id',
            'source_cabinet_id'                 => 'nullable|exists:warehouse_cabinets,id',
            'destination_warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'destination_cabinet_id'            => 'nullable|exists:warehouse_cabinets,id',
            'destination_siege'                 => 'nullable|string',
            'destination_user_id'               => 'nullable|exists:users,id',
            'document_id'   => 'nullable|exists:documents,id',
            'in_image'      => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'out_image'     => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'lines'         => 'required|array|min:1',
            'lines.*.product_id' => 'required|exists:products,id',
            'lines.*.quantity'   => 'required|integer|min:1',
        ]);

        $movementType = $request->input('movement_type', $request->input('type'));

        // Pour les agents et responsables, assigner automatiquement leur dÃpÃ´t
        $isStockManager = $this->userHasAnyRole($user, ['responsable de stock', 'responsable', 'agent de stock', 'agent']);
        $autoAssignDepot = $isStockManager && $user->depot_id;

        // 1. Inactive products check
        $productIds = collect($request->input('lines'))->pluck('product_id')->all();
        $inactive = Product::whereIn('id', $productIds)->where('status', '!=', 'active')->pluck('title')->all();
        if (count($inactive) > 0) {
            throw ValidationException::withMessages(['lines' => ["Produits inactifs dÃtectÃs : " . implode(', ', $inactive)]]);
        }

        // 2. Logic validations
        if ($movementType === 'in' && !$request->filled('supplier_id')) {
            throw ValidationException::withMessages(['supplier_id' => ['Le fournisseur est requis pour une entrÃe.']]);
        }
        if (in_array($movementType, ['out', 'transfer'])) {
            $lines = $request->input('lines', []);
            foreach ($lines as $i => $line) {
                $hasSource = !empty($line['source_warehouse_location_id']) || !empty($line['source_cabinet_id']) || $request->filled('source_warehouse_location_id') || $request->filled('source_cabinet_id');
                if (!$hasSource) {
                    throw ValidationException::withMessages(["lines.$i.source" => ["L'emplacement source est requis pour chaque produit."]]);
                }
            }
        }
        if (in_array($movementType, ['in', 'transfer']) && !$request->filled('destination_warehouse_location_id') && !$request->filled('destination_cabinet_id')) {
            throw ValidationException::withMessages(['destination_warehouse_location_id' => ['L\'emplacement destination est requis.']]);
        }

        $reference = $request->input('reference') ?: 'SMV-' . now()->format('Ymd-His') . '-' . Str::upper(Str::random(4));

        $movement = DB::transaction(function () use ($request, $user, $movementType, $reference, $autoAssignDepot) {
            $isManager = $this->userHasAnyRole($user, ['administrateur', 'responsable', 'responsable de stock', 'gestionnaire', 'validateur']);
            $status = $isManager ? 'executed' : 'pending_validation';

            // Pour les agents/responsables, valider que les emplacements appartiennent a leur depot
            if ($autoAssignDepot) {
                $destLocationId = $request->input('destination_warehouse_location_id');
                $destCabinetId = $request->input('destination_cabinet_id');

                $sourceLocsToCheck = array_filter(array_merge(
                    [$request->input('source_warehouse_location_id')],
                    collect($request->input('lines', []))->pluck('source_warehouse_location_id')->all()
                ));
                $sourceCabsToCheck = array_filter(array_merge(
                    [$request->input('source_cabinet_id')],
                    collect($request->input('lines', []))->pluck('source_cabinet_id')->all()
                ));

                foreach ($sourceLocsToCheck as $sLocId) {
                    $loc = \App\Models\WarehouseLocation::with('room.warehouse')->find($sLocId);
                    if (!$loc || $loc->room->warehouse_id != $user->depot_id) {
                        throw ValidationException::withMessages(['source_warehouse_location_id' => ['Un emplacement source n\'appartient pas a votre depot.']]);
                    }
                }
                foreach ($sourceCabsToCheck as $sCabId) {
                    $cab = \App\Models\WarehouseCabinet::with('room.warehouse')->find($sCabId);
                    if (!$cab || $cab->room->warehouse_id != $user->depot_id) {
                        throw ValidationException::withMessages(['source_cabinet_id' => ['Une armoire source n\'appartient pas a votre depot.']]);
                    }
                }
                // Pour une Entree ('in'), on s'assure que la destination est bien dans leur depot.
                // Pour un transfert, la destination peut etre n'importe ou.
                if ($movementType === 'in') {
                    if ($destLocationId) {
                        $loc = \App\Models\WarehouseLocation::with('room.warehouse')->find($destLocationId);
                        if (!$loc || $loc->room->warehouse_id != $user->depot_id) {
                            throw ValidationException::withMessages(['destination_warehouse_location_id' => ['Cet emplacement n\'appartient pas a votre depot.']]);
                        }
                    }
                    if ($destCabinetId) {
                        $cab = \App\Models\WarehouseCabinet::with('room.warehouse')->find($destCabinetId);
                        if (!$cab || $cab->room->warehouse_id != $user->depot_id) {
                            throw ValidationException::withMessages(['destination_cabinet_id' => ['Cette armoire n\'appartient pas a votre depot.']]);
                        }
                    }
                }
            }

            $movementDepotId = $request->input('depot_id');
            if (!$movementDepotId && $autoAssignDepot) {
                $movementDepotId = $user->depot_id;
            } elseif (!$movementDepotId) {
                if ($request->input('destination_warehouse_location_id')) {
                    $loc = \App\Models\WarehouseLocation::with('room.warehouse')->find($request->input('destination_warehouse_location_id'));
                    if ($loc) $movementDepotId = $loc->room->warehouse_id;
                } elseif ($request->input('source_warehouse_location_id')) {
                    $loc = \App\Models\WarehouseLocation::with('room.warehouse')->find($request->input('source_warehouse_location_id'));
                    if ($loc) $movementDepotId = $loc->room->warehouse_id;
                }
            }

            $movementData = [
                'movement_type' => $movementType,
                'reference'     => $reference,
                'created_by'    => $user ? $user->id : null,
                'depot_id'      => $movementDepotId,
                'related_request_id' => $request->input('related_request_id'),
                'notes'         => $request->input('notes'),
                'motif'         => $request->input('motif'),
                'destination_text' => $request->input('destination_text'),
                'status'        => $status,
                'supplier_id'   => $request->input('supplier_id'),
                'supplier_contact_id' => $request->input('supplier_contact_id'),
                'source_warehouse_location_id'      => $request->input('source_warehouse_location_id'),
                'source_cabinet_id'                 => $request->input('source_cabinet_id'),
                'destination_warehouse_location_id' => $request->input('destination_warehouse_location_id'),
                'destination_cabinet_id'            => $request->input('destination_cabinet_id'),
                'destination_siege'                 => $request->input('destination_siege'),
                'destination_user_id'               => $request->input('destination_user_id'),
                'document_id'   => $request->input('document_id'),
            ];

            $movementData['planned_at'] = now();

            if ($request->hasFile('in_image')) {
                $movementData['in_image_path'] = $request->file('in_image')->store('stock-movements/in', 'public');
            }
            if ($request->hasFile('out_image')) {
                $movementData['out_image_path'] = $request->file('out_image')->store('stock-movements/out', 'public');
            }

            $movement = StockMovement::create($movementData);

            $linesData = collect($request->input('lines'))->map(fn ($line) => [
                'product_id' => (int) $line['product_id'],
                'quantity'   => (int) $line['quantity'],
                'warehouse_location_id' => $line['source_warehouse_location_id'] ?? $request->input('source_warehouse_location_id') ?: $request->input('destination_warehouse_location_id'),
                'cabinet_id'            => $line['source_cabinet_id'] ?? $request->input('source_cabinet_id') ?: $request->input('destination_cabinet_id'),
            ])->all();

            $movement->lines()->createMany($linesData);

            // Document association (OCR support)
            $imagePath = $movement->in_image_path ?: $movement->out_image_path;
            if ($imagePath) {
                foreach (collect($linesData)->pluck('product_id')->unique() as $pid) {
                    \App\Models\Document::create([
                        'user_id'      => $user ? $user->id : null,
                        'product_id'   => $pid,
                        'supplier_id'  => $movement->supplier_id,
                        'title'        => ($movement->movement_type === 'in' ? 'Bon d\'entree - ' : 'Bon de sortie - ') . $movement->reference,
                        'type'         => $movement->movement_type === 'in' ? 'bon_livraison' : 'bon_sortie',
                        'direction'    => in_array($movement->movement_type, ['in', 'out']) ? $movement->movement_type : 'unknown',
                        'status'       => 'applied',
                        'path'         => $imagePath,
                    ]);
                }
            }

            if ($status === 'executed') {
                $updateData['validated_by'] = $user->id;
                $updateData['executed_at'] = now();
                $movement->update($updateData);

                $this->executeMovementInternal($movement, $user);
            }

            return $movement;
        });


        // Notifications - Filter by depot for agents, notify all responsables for admins
        try {
            $query = User::whereHas('role', function($rq) {
                $rq->whereIn('name', ['Administrateur', 'Responsable', 'Responsable de stock', 'Gestionnaire', 'Validateur', 'administrateur', 'responsable', 'responsable de stock', 'gestionnaire', 'validateur']);
            });

            // Notify responsables of the movement's depot, and admins (who may have null depot_id)
            $movementDepotId = $movement->depot_id;
            $query->where(function ($q) use ($movementDepotId) {
                if ($movementDepotId) {
                    $q->where('depot_id', $movementDepotId)
                      ->orWhereNull('depot_id');
                }
            });

            $responsables = $query->get();

            foreach ($responsables as $resp) {
                /** @var User $resp */
                if ($user && $resp->id !== $user->id) {
                    $resp->notify(new StockMovementNotification($movement));
                }
            }
        } catch (\Throwable $e) {
            Log::error('Stock Movement Notification failed', ['err' => $e->getMessage()]);
        }

        return response()->json($movement->load(
            'lines.product',
            'creator',
            'validator',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
            'sourceCabinet',
            'destinationCabinet'
        ), 201);
    }

    /**
     * Internal method to apply stock changes
     */
    private function executeMovementInternal(StockMovement $movement, User $user)
    {
        $movement->loadMissing('lines.product');

        foreach ($movement->lines as $line) {
            $product = $line->product;
            if (!$product) continue;
            $product->lockForUpdate();

            $qty = (int) $line->quantity;

            // Sortie / Transfert (Source)
            if (in_array($movement->movement_type, ['out', 'transfer'])) {
                $sourceStock = null;
                $sourceLoc = $line->warehouse_location_id ?? $movement->source_warehouse_location_id;
                $sourceCab = $line->cabinet_id ?? $movement->source_cabinet_id;

                if ($sourceLoc) {
                    $sourceStock = ProductStock::where('product_id', $product->id)
                        ->where('warehouse_location_id', $sourceLoc)
                        ->lockForUpdate()
                        ->first();
                } elseif ($sourceCab) {
                    $sourceStock = ProductStock::where('product_id', $product->id)
                        ->where('cabinet_id', $sourceCab)
                        ->lockForUpdate()
                        ->first();
                }

                $available = (int) ($sourceStock?->quantity ?? 0);
                if ($qty > $available) {
                    throw ValidationException::withMessages([
                        'lines' => ["Stock insuffisant pour {$product->title} (Disponible: {$available}, DemandÃ: {$qty})."],
                    ]);
                }

                if ($sourceStock) {
                    $sourceStock->decrement('quantity', $qty);
                    $sourceStock->update(['last_updated' => now()]);
                }
            }

            // EntrÃe / Transfert (Destination)
            if (in_array($movement->movement_type, ['in', 'transfer'])) {
                $destStock = null;
                $destLoc = $line->warehouse_location_id ?? $movement->destination_warehouse_location_id;
                $destCab = $line->cabinet_id ?? $movement->destination_cabinet_id;

                $query = ProductStock::where('product_id', $product->id);

                if ($destLoc) {
                    $query->where('warehouse_location_id', $destLoc);
                } else {
                    $query->where('cabinet_id', $destCab);
                }

                $destStock = $query->lockForUpdate()->first();

                if (!$destStock) {
                    $destStock = ProductStock::create([
                        'product_id' => $product->id,
                        'warehouse_location_id' => $destLoc,
                        'cabinet_id' => $destCab,
                        'supplier_id' => $movement->supplier_id,
                        'quantity' => $qty,
                        'last_updated' => now(),
                    ]);
                } else {
                    $destStock->increment('quantity', $qty);
                    if ($movement->supplier_id && !$destStock->supplier_id) {
                        $destStock->update(['supplier_id' => $movement->supplier_id]);
                    }
                    $destStock->update(['last_updated' => now()]);
                }
            }

            // Sync global stock
            $product->update(['stock_quantity' => (int) $product->stocks()->sum('quantity')]);
        }

        $movement->update([
            'status' => 'executed',
            'executed_at' => now(),
            'validated_by' => $user->id
        ]);
    }

    public function update($id, Request $request)
    {
        $movement = StockMovement::with('lines')->findOrFail($id);
        if ($movement->status !== 'draft') {
            return response()->json(['message' => 'Only draft movements can be edited.'], 422);
        }
        if ($movement->lines->count() === 0) {
            return response()->json(['message' => 'Legacy static movement cannot be edited.'], 422);
        }

        $request->validate([
            'reference' => 'nullable|string',
            'notes' => 'nullable|string',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'source_warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'destination_warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'document_id' => 'nullable|exists:documents,id',
            'in_image' => 'nullable|file|image|max:10240',
            'out_image' => 'nullable|file|image|max:10240',
            'lines' => 'nullable|array|min:1',
            'lines.*.product_id' => 'required_with:lines|exists:products,id',
            'lines.*.quantity' => 'required_with:lines|integer|min:1',
        ]);

        $productIds = collect((array) $request->input('lines'))
            ->pluck('product_id')
            ->map(fn ($v) => (int) $v)
            ->unique()
            ->values()
            ->all();

        $inactive = Product::query()
            ->whereIn('id', $productIds)
            ->where('status', '!=', 'active')
            ->pluck('title')
            ->values()
            ->all();

        if (count($inactive) > 0) {
            $list = implode(', ', $inactive);
            throw ValidationException::withMessages([
                'lines' => ["Impossible d'utiliser des produits inactifs: {$list}. Activez-les pour continuer."],
            ]);
        }

        DB::transaction(function () use ($movement, $request) {
            if ($request->has('reference')) {
                $movement->reference = $request->input('reference');
            }
            if ($request->has('notes')) {
                $movement->notes = $request->input('notes');
            }
            if ($request->has('supplier_id')) {
                $movement->supplier_id = $request->input('supplier_id');
            }
            if ($request->has('source_warehouse_location_id')) {
                $movement->source_warehouse_location_id = $request->input('source_warehouse_location_id');
            }
            if ($request->has('destination_warehouse_location_id')) {
                $movement->destination_warehouse_location_id = $request->input('destination_warehouse_location_id');
            }
            if ($request->has('document_id')) {
                $movement->document_id = $request->input('document_id');
            }
            if ($request->hasFile('in_image')) {
                $movement->in_image_path = $request->file('in_image')->store('stock-movements/in', 'public');
            }
            if ($request->hasFile('out_image')) {
                $movement->out_image_path = $request->file('out_image')->store('stock-movements/out', 'public');
            }
            $movement->save();

            if ($request->has('lines')) {
                $movement->lines()->delete();
                $lines = collect($request->input('lines'))->map(fn ($line) => [
                    'product_id' => (int) $line['product_id'],
                    'quantity' => (int) $line['quantity'],
                ])->all();
                $movement->lines()->createMany($lines);
            }
        });

        return response()->json($movement->fresh([
            'lines.product',
            'creator',
            'validator',
            'supplier',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
            'sourceCabinet',
            'destinationCabinet',
        ]));
    }

    public function destroy($id)
    {
        $movement = StockMovement::findOrFail($id);
        if ($movement->status !== 'draft') {
            return response()->json(['message' => 'Only draft movements can be deleted.'], 422);
        }
        if ($movement->lines()->count() === 0) {
            return response()->json(['message' => 'Legacy static movement cannot be deleted.'], 422);
        }

        $movement->delete();
        return response()->json(['message' => 'Movement deleted.']);
    }
}




