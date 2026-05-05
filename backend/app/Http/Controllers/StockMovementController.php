<?php

namespace App\Http\Controllers;

use App\Models\StockMovement;
use App\Models\StockMovementLine;
use App\Models\User;
use App\Models\Document;
use App\Notifications\StockMovementResponseNotification;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use App\Models\ProductStock;
use App\Models\AuditLog;
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
                'creator',
                'validator',
                'supplier',
                'document',
                'sourceWarehouseLocation.room.warehouse',
                'destinationWarehouseLocation.room.warehouse',
            ])
            ->latest();

        // By default, hide legacy "static" movements that don't have lines.
        // Those rows come from an older schema (product_id/quantity_delta/stock_before/stock_after/reason).
        if (!$request->boolean('include_legacy')) {
            $query->whereHas('lines');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
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
            'creator',
            'validator',
            'supplier',
            'document',
            'sourceWarehouseLocation.room.warehouse',
            'destinationWarehouseLocation.room.warehouse',
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
            return response()->json(['message' => 'Ce mouvement est déjà exécuté.'], 400);
        }

        // If it's pending_validation, only managers can execute directly
        if ($movement->status === 'pending_validation') {
            if (!$this->userHasAnyRole($user, ['Responsable de stock', 'Responsable', 'Administrateur'])) {
                return response()->json(['message' => 'Ce mouvement doit d\'abord être approuvé par un responsable.'], 403);
            }
        } elseif ($movement->status !== 'approved') {
             return response()->json(['message' => 'Ce mouvement doit être approuvé avant d\'être exécuté.'], 400);
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

        return response()->json($movement->fresh(['lines.product', 'creator', 'validator']));
    }

    /**
     * Intermediate step: Approve without updating stock
     */
    public function approve(Request $request, $id)
    {
        $user = Auth::user();
        if (!$this->userHasAnyRole($user, ['Responsable de stock', 'Responsable', 'Administrateur'])) {
            return response()->json(['message' => 'Non autorisé.'], 403);
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

            // Audit log
            try {
                AuditLog::create([
                    'user_id' => $user->id,
                    'action' => 'stock_movement.approve',
                    'description' => "Mouvement {$movement->reference} approuvé et exécuté",
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);
            } catch (\Throwable $e) {}
        });

        return response()->json($movement->fresh(['lines.product', 'creator', 'validator']));
    }

    /**
     * Reject a pending movement
     */
    public function reject(Request $request, $id)
    {
        $user = Auth::user();
        if (!$this->userHasAnyRole($user, ['Responsable de stock', 'Responsable', 'Administrateur'])) {
            return response()->json(['message' => 'Non autorisé.'], 403);
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

            // Audit log
            try {
                AuditLog::create([
                    'user_id' => $user->id,
                    'action' => 'stock_movement.reject',
                    'description' => "Mouvement {$movement->reference} rejeté : " . $request->input('notes'),
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);
            } catch (\Throwable $e) {}
        });

        return response()->json($movement->fresh(['lines.product', 'creator', 'validator']));
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
        
        // Check spatie roles
        foreach ($roles as $role) {
            if ($user->hasRole($role)) return true;
        }

        // Check direct role column (LOWER case)
        $userRole = Str::lower($user->role);
        foreach ($roles as $role) {
            if ($userRole === Str::lower($role)) return true;
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
            'document_id'   => 'nullable|exists:documents,id',
            'in_image'      => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'out_image'     => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'lines'         => 'required|array|min:1',
            'lines.*.product_id' => 'required|exists:products,id',
            'lines.*.quantity'   => 'required|integer|min:1',
        ]);

        $movementType = $request->input('movement_type', $request->input('type'));
        
        // 1. Inactive products check
        $productIds = collect($request->input('lines'))->pluck('product_id')->all();
        $inactive = Product::whereIn('id', $productIds)->where('status', '!=', 'active')->pluck('title')->all();
        if (count($inactive) > 0) {
            throw ValidationException::withMessages(['lines' => ["Produits inactifs détectés : " . implode(', ', $inactive)]]);
        }

        // 2. Logic validations
        if ($movementType === 'in' && !$request->filled('supplier_id')) {
            throw ValidationException::withMessages(['supplier_id' => ['Le fournisseur est requis pour une entrée.']]);
        }
        if (in_array($movementType, ['out', 'transfer']) && !$request->filled('source_warehouse_location_id') && !$request->filled('source_cabinet_id')) {
            throw ValidationException::withMessages(['source_warehouse_location_id' => ['L\'emplacement source est requis.']]);
        }
        if (in_array($movementType, ['in', 'transfer']) && !$request->filled('destination_warehouse_location_id') && !$request->filled('destination_cabinet_id')) {
            throw ValidationException::withMessages(['destination_warehouse_location_id' => ['L\'emplacement destination est requis.']]);
        }

        $reference = $request->input('reference') ?: 'SMV-' . now()->format('Ymd-His') . '-' . Str::upper(Str::random(4));

        $movement = DB::transaction(function () use ($request, $user, $movementType, $reference) {
            $isManager = $this->userHasAnyRole($user, ['administrateur', 'responsable', 'responsable de stock', 'gestionnaire', 'validateur']);
            $status = $isManager ? 'executed' : 'pending_validation';

            $movementData = [
                'movement_type' => $movementType,
                'reference'     => $reference,
                'created_by'    => $user ? $user->id : null,
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
                'document_id'   => $request->input('document_id'),
            ];

            if (Schema::hasColumn('stock_movements', 'planned_at')) {
                $movementData['planned_at'] = now();
            }

            if ($request->hasFile('in_image')) {
                $movementData['in_image_path'] = $request->file('in_image')->store('stock-movements/in', 'public');
            }
            if ($request->hasFile('out_image')) {
                $movementData['out_image_path'] = $request->file('out_image')->store('stock-movements/out', 'public');
            }

            $movement = StockMovement::create($movementData);

            $linesData = collect($request->input('lines'))->map(fn ($line) => [
                'product_id' => (int) $line['product_id'],
                'quantity' => (int) $line['quantity'],
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
                        'title'        => ($movement->movement_type === 'in' ? 'Bon d\'entrée - ' : 'Bon de sortie - ') . $movement->reference,
                        'type'         => $movement->movement_type === 'in' ? 'bon_livraison' : 'bon_sortie',
                        'direction'    => in_array($movement->movement_type, ['in', 'out']) ? $movement->movement_type : 'unknown',
                        'status'       => 'applied',
                        'path'         => $imagePath,
                    ]);
                }
            }

            if ($status === 'executed') {
                $updateData = [];
                if (Schema::hasColumn('stock_movements', 'validated_by')) $updateData['validated_by'] = $user->id;
                if (Schema::hasColumn('stock_movements', 'executed_at')) $updateData['executed_at'] = now();
                if (!empty($updateData)) $movement->update($updateData);
                
                $this->applyStockChanges($movement);
            }

            return $movement;
        });

        // Audit Log
        try {
            AuditLog::create([
                'user_id' => $user?->id,
                'action' => 'stock_movement.create',
                'description' => "Flux {$movement->reference} créé ({$movement->status})",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        } catch (\Throwable $e) {}

        // Notifications
        try {
            $responsables = User::whereHas('roles', function ($q) { 
                $q->whereRaw("LOWER(name) IN (?, ?, ?, ?, ?)", ['administrateur', 'responsable', 'responsable de stock', 'gestionnaire', 'validateur']); 
            })->orWhereRaw("LOWER(role) IN (?, ?, ?, ?, ?)", ['administrateur', 'responsable', 'responsable de stock', 'gestionnaire', 'validateur'])->get();

            foreach ($responsables as $resp) {
                if ($user && $resp->id !== $user->id) {
                    $resp->notify(new StockMovementNotification($movement));
                }
            }
        } catch (\Throwable $e) {
            Log::error('Stock Movement Notification failed', ['err' => $e->getMessage()]);
        }

        return response()->json($movement->load('lines.product', 'creator', 'validator'), 201);
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
                if ($movement->source_warehouse_location_id) {
                    $sourceStock = ProductStock::where('product_id', $product->id)
                        ->where('warehouse_location_id', $movement->source_warehouse_location_id)
                        ->lockForUpdate()
                        ->first();
                } elseif ($movement->source_cabinet_id) {
                    $sourceStock = ProductStock::where('product_id', $product->id)
                        ->where('cabinet_id', $movement->source_cabinet_id)
                        ->lockForUpdate()
                        ->first();
                }

                $available = (int) ($sourceStock?->quantity ?? 0);
                if ($qty > $available) {
                    throw ValidationException::withMessages([
                        'lines' => ["Stock insuffisant pour {$product->title} (Disponible: {$available}, Demandé: {$qty})."],
                    ]);
                }

                if ($sourceStock) {
                    $sourceStock->decrement('quantity', $qty);
                    $sourceStock->update(['last_updated' => now()]);
                }
            }

            // Entrée / Transfert (Destination)
            if (in_array($movement->movement_type, ['in', 'transfer'])) {
                $destStock = null;
                $query = ProductStock::where('product_id', $product->id);
                
                if ($movement->destination_warehouse_location_id) {
                    $query->where('warehouse_location_id', $movement->destination_warehouse_location_id);
                } else {
                    $query->where('cabinet_id', $movement->destination_cabinet_id);
                }
                
                $destStock = $query->lockForUpdate()->first();

                if (!$destStock) {
                    $destStock = ProductStock::create([
                        'product_id' => $product->id,
                        'warehouse_location_id' => $movement->destination_warehouse_location_id,
                        'cabinet_id' => $movement->destination_cabinet_id,
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
