<?php

namespace App\Http\Controllers;

use App\Models\StockMovement;
use App\Models\StockMovementLine;
use App\Models\AuditLog;
use App\Models\ProductStock;
use App\Models\User;
use App\Notifications\StockMovementNotification;
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

    public function validateMovement($id)
    {
        $movement = StockMovement::with('lines')->findOrFail($id);
        if ($movement->status === 'executed') {
            return response()->json(['message' => 'Already executed.'], 422);
        }
        if ($movement->status === 'cancelled') {
            return response()->json(['message' => 'Cannot execute a cancelled movement.'], 422);
        }
        if ($movement->lines->count() === 0) {
            return response()->json(['message' => 'Legacy static movement cannot be executed.'], 422);
        }

        DB::transaction(function () use ($movement) {
            foreach ($movement->lines as $line) {
                $product = \App\Models\Product::lockForUpdate()->find($line->product_id);
                if (!$product) continue;

                $qty = (int) $line->quantity;

                // Source deduction (out/transfer)
                if ($movement->movement_type === 'out' && $movement->source_warehouse_location_id) {
                    $sourceStock = ProductStock::where('product_id', $product->id)
                        ->where('warehouse_location_id', $movement->source_warehouse_location_id)
                        ->lockForUpdate()
                        ->first();

                    $available = (int) ($sourceStock?->quantity ?? 0);
                    if ($qty > $available) {
                        throw ValidationException::withMessages([
                            'lines' => ["Stock insuffisant pour {$product->title} (dispo: {$available}, demande: {$qty})."],
                        ]);
                    }

                    if ($sourceStock) {
                        $sourceStock->quantity = $available - $qty;
                        $sourceStock->last_updated = now();
                        $sourceStock->save();
                    }
                }

                // Destination add (in/transfer)
                if ($movement->destination_warehouse_location_id) {
                    $destStock = ProductStock::where('product_id', $product->id)
                        ->where('warehouse_location_id', $movement->destination_warehouse_location_id)
                        ->lockForUpdate()
                        ->first();

                    if (!$destStock) {
                        $destStock = ProductStock::create([
                            'product_id' => $product->id,
                            'warehouse_location_id' => $movement->destination_warehouse_location_id,
                            'supplier_id' => $movement->supplier_id,
                            'quantity' => 0,
                            'notes' => null,
                            'last_updated' => now(),
                        ]);
                        // Lock the created row for consistent update within the txn.
                        $destStock = ProductStock::where('id', $destStock->id)->lockForUpdate()->first();
                    }

                    $destStock->quantity = (int) $destStock->quantity + $qty;
                    if ($movement->supplier_id && !$destStock->supplier_id) {
                        $destStock->supplier_id = $movement->supplier_id;
                    }
                    $destStock->last_updated = now();
                    $destStock->save();
                }

                // Keep legacy aggregate column in sync for other screens.
                $product->stock_quantity = (int) $product->stocks()->sum('quantity');
                $product->save();
            }

            $movement->status = 'executed';
            if (Schema::hasColumn('stock_movements', 'executed_at')) {
                $movement->executed_at = now();
            }
            if (Schema::hasColumn('stock_movements', 'validated_by')) {
                $movement->validated_by = Auth::id();
            }
            $movement->save();
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

    public function cancelMovement($id, Request $request)
    {
        $movement = StockMovement::findOrFail($id);
        if ($movement->status === 'cancelled') {
            return response()->json(['message' => 'Already cancelled.'], 422);
        }
        if ($movement->status === 'executed') {
            return response()->json(['message' => 'Cannot cancel an executed movement.'], 422);
        }
        if ($movement->lines()->count() === 0) {
            return response()->json(['message' => 'Legacy static movement cannot be cancelled.'], 422);
        }

        $movement->status = 'cancelled';
        if (Schema::hasColumn('stock_movements', 'cancel_reason')) {
            $movement->cancel_reason = $request->input('reason');
        }
        $movement->save();

        return response()->json(['message' => 'Movement cancelled.']);
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        $request->validate([
            'movement_type' => 'required_without:type|in:in,out',
            'type' => 'nullable|in:in,out',
            'reference' => 'nullable|string',
            'notes' => 'nullable|string',
            'supplier_id' => 'required_if:movement_type,in|nullable|exists:suppliers,id',
            'source_warehouse_location_id' => 'required_if:movement_type,out|nullable|exists:warehouse_locations,id',
            'destination_warehouse_location_id' => 'required|exists:warehouse_locations,id',
            'document_id' => 'nullable|exists:documents,id',
            'in_image' => 'nullable|file|image|max:10240',
            'out_image' => 'nullable|file|image|max:10240',
            'lines' => 'required|array|min:1',
            'lines.*.product_id' => 'required|exists:products,id',
            'lines.*.quantity' => 'required|integer|min:1',
        ]);

        if (
            $request->filled('source_warehouse_location_id')
            && $request->filled('destination_warehouse_location_id')
            && (int) $request->input('source_warehouse_location_id') === (int) $request->input('destination_warehouse_location_id')
        ) {
            throw ValidationException::withMessages([
                'destination_warehouse_location_id' => ['La destination doit etre differente de la source.'],
            ]);
        }

        $movementType = $request->input('movement_type', $request->input('type'));
        $reference = $request->input('reference');
        if (!$reference) {
            $reference = 'SMV-' . now()->format('Ymd-His') . '-' . Str::upper(Str::random(4));
        }

        $movement = DB::transaction(function () use ($request, $user, $movementType, $reference) {
            $movementData = [
                'movement_type' => $movementType,
                'reference' => $reference,
                'created_by' => $user ? $user->id : null,
                'related_request_id' => $request->input('related_request_id'),
                'notes' => $request->input('notes'),
                'status' => 'draft',
                'planned_at' => Schema::hasColumn('stock_movements', 'planned_at') ? now() : null,
                'supplier_id' => $request->input('supplier_id'),
                'source_warehouse_location_id' => $request->input('source_warehouse_location_id'),
                'destination_warehouse_location_id' => $request->input('destination_warehouse_location_id'),
                'document_id' => $request->input('document_id'),
            ];

            if ($request->hasFile('in_image')) {
                $movementData['in_image_path'] = $request->file('in_image')->store('stock-movements/in', 'public');
            }
            if ($request->hasFile('out_image')) {
                $movementData['out_image_path'] = $request->file('out_image')->store('stock-movements/out', 'public');
            }

            $movement = StockMovement::create($movementData);

            $lines = collect($request->input('lines'))->map(fn ($line) => [
                'product_id' => (int) $line['product_id'],
                'quantity' => (int) $line['quantity'],
            ])->all();

            $movement->lines()->createMany($lines);
            return $movement;
        });

        // Audit log
        try {
            AuditLog::create([
                'user_id' => $user?->id,
                'action' => 'stock_movement.create',
                'description' => "Mouvement {$movement->id} de type {$movement->movement_type} cree par user {$user?->id}",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to create audit log for stock movement', ['err' => $e->getMessage()]);
        }

        // Notify admins and related request owner (if any)
        try {
            $admins = User::whereHas('roles', function ($q) { $q->whereRaw("LOWER(name) = 'administrateur'"); })->get();
            foreach ($admins as $admin) {
                $admin->notify(new StockMovementNotification($movement));
            }

            if ($movement->related_request_id) {
                $req = \App\Models\ConsumableRequest::find($movement->related_request_id);
                if ($req && $req->user_id) {
                    $owner = User::find($req->user_id);
                    if ($owner) {
                        $owner->notify(new StockMovementNotification($movement));
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error('Failed to send stock movement notifications', ['err' => $e->getMessage()]);
        }

        return response()->json($movement->load('lines.product', 'creator', 'validator'), 201);
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
