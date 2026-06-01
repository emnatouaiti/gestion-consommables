<?php

namespace App\Http\Controllers\Stock;

use App\Http\Controllers\Controller;
use App\Models\ProductStock;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

class ProductStockController extends Controller
{
    public function getProductStocks(Product $product)
    {
        $user = Auth::user();
        $query = $product->stocks()
            ->with('warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse', 'supplier')
            ->where('quantity', '>', 0);

        if (\Illuminate\Support\Facades\Schema::hasColumn('product_stocks', 'batch_status')) {
            $query->whereIn('batch_status', ['active', 'expired']);
        }

        // Filtrer par dÃ©pÃ´t de l'utilisateur si c'est un responsable/agent
        if ($user && $user->depot_id) {
            $isStockManager = $user->hasAnyRole(['responsable de stock', 'responsable', 'agent de stock', 'agent']);

            if ($isStockManager) {
                $query->where(function ($q) use ($user) {
                    $q->whereHas('warehouseLocation.room', function ($q2) use ($user) {
                        $q2->where('warehouse_id', $user->depot_id);
                    })->orWhereHas('warehouseCabinet.room', function ($q2) use ($user) {
                        $q2->where('warehouse_id', $user->depot_id);
                    });
                });
            }
        }

        $stocks = $query->get();

        $formatted = $stocks->map(function ($s) {
            $room = $s->warehouseLocation?->room ?: $s->warehouseCabinet?->room;
            $wh = $room?->warehouse;
            return array_merge($s->toArray(), [
                'warehouse_id'   => $wh?->id,
                'warehouse_name' => $wh?->name ?: 'DÃ©pÃ´t inconnu',
                'room_id'        => $room?->id,
                'room_name'      => $room?->name ?: 'Salle inconnue',
                'location_label' => $s->warehouseLocation?->code ?: ($s->warehouseCabinet?->name ?: 'Emplacement ' . $s->id)
            ]);
        });


        // Final filter to ensure we only return entries with valid warehouse info
        $final = $formatted->filter(function($item) {
            return !empty($item['warehouse_id']);
        });

        return response()->json($final->values()->all());
    }

    public function updateStock(Request $request, ProductStock $stock)
    {
        if (($stock->product?->status ?? null) !== 'active') {
            return response()->json([
                'message' => 'Produit inactif: modification de stock interdite.',
            ], 422);
        }

        $validated = $request->validate([
            'quantity' => 'required|integer|min:0',
            'notes' => 'nullable|string',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'cabinet_id' => 'nullable|exists:warehouse_cabinets,id',
        ]);

        if (empty($validated['warehouse_location_id']) && empty($validated['cabinet_id'])) {
            return response()->json(['message' => 'Choisissez un emplacement ou une armoire.'], 422);
        }

        $quantityDiff = $validated['quantity'] - $stock->quantity;

        if ($quantityDiff > 0) {
            if (!empty($validated['warehouse_location_id'])) {
                $loc = \App\Models\WarehouseLocation::find($validated['warehouse_location_id']);
                if ($loc && $loc->capacity_units > 0 && ($loc->current_units + $quantityDiff) > $loc->capacity_units) {
                    return response()->json(['message' => 'CapacitÃ© maximale dÃ©passÃ©e pour cet emplacement.'], 422);
                }
            } elseif (!empty($validated['cabinet_id'])) {
                $cab = \App\Models\WarehouseCabinet::find($validated['cabinet_id']);
                if ($cab && $cab->capacity_units > 0 && ($cab->current_units + $quantityDiff) > $cab->capacity_units) {
                    return response()->json(['message' => 'CapacitÃ© maximale dÃ©passÃ©e pour cette armoire.'], 422);
                }
            }
        }

        $validated['last_updated'] = now();

        $stock->update($validated);
        return $stock->load('warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse', 'product', 'supplier');
    }

    public function addStock(Request $request, Product $product)
    {
        if ($product->status !== 'active') {
            return response()->json([
                'message' => 'Produit inactif: ajout de quantite interdit.',
            ], 422);
        }

        $validated = $request->validate([
            'warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'cabinet_id' => 'nullable|exists:warehouse_cabinets,id',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
            'supplier_id' => 'nullable|exists:suppliers,id',
        ]);

        if (empty($validated['warehouse_location_id']) && empty($validated['cabinet_id'])) {
            return response()->json(['message' => 'Choisissez un emplacement ou une armoire.'], 422);
        }

        if (!empty($validated['warehouse_location_id'])) {
            $loc = \App\Models\WarehouseLocation::find($validated['warehouse_location_id']);
            if ($loc && $loc->capacity_units > 0 && ($loc->current_units + $validated['quantity']) > $loc->capacity_units) {
                return response()->json(['message' => 'CapacitÃ© maximale dÃ©passÃ©e pour cet emplacement.'], 422);
            }
        } elseif (!empty($validated['cabinet_id'])) {
            $cab = \App\Models\WarehouseCabinet::find($validated['cabinet_id']);
            if ($cab && $cab->capacity_units > 0 && ($cab->current_units + $validated['quantity']) > $cab->capacity_units) {
                return response()->json(['message' => 'CapacitÃ© maximale dÃ©passÃ©e pour cette armoire.'], 422);
            }
        }

        $validated['last_updated'] = now();

        $stock = ProductStock::create(array_merge($validated, ['product_id' => $product->id]));

        return $stock->load('warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse', 'product', 'supplier');
    }

    public function removeStock(ProductStock $stock)
    {
        $stock->delete();
        return response()->noContent();
    }

    public function getTotalStock(Product $product)
    {
        $product->loadMissing('suppliers');
        $defaultSupplier = $product->suppliers->first();

        // --- 1. Stocks from product_stocks table ---
        $stockQuery = $product->stocks()
            ->with('warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse', 'supplier');

        if (Schema::hasColumn('product_stocks', 'batch_status')) {
            $stockQuery->whereIn('batch_status', ['active', 'expired']);
        }

        $stockEntries = $stockQuery->get();

        $stockDetails = $stockEntries->map(function ($stock) use ($defaultSupplier) {
            $room = $stock->warehouseLocation?->room ?? $stock->warehouseCabinet?->room;
            $warehouse = $room?->warehouse;

            // Separate handling for location vs cabinet
            $locationCode = null;
            $locationName = null;
            $storageType = 'location';

            if ($stock->warehouse_location_id && $stock->warehouseLocation) {
                $locationCode = $stock->warehouseLocation->code;
                $locationName = $stock->warehouseLocation->name;
                $storageType = 'location';
            } elseif ($stock->cabinet_id && $stock->warehouseCabinet) {
                $locationCode = $stock->warehouseCabinet->code;
                $locationName = $stock->warehouseCabinet->name;
                $storageType = 'cabinet';
            }

            $supplier = $stock->supplier ?: $defaultSupplier;

            $locationDisplay = null;
            $cabinetDisplay = null;

            if ($storageType === 'location' && $locationCode && $locationName) {
                $locationDisplay = trim($locationCode . ' ' . $locationName);
            }
            if ($storageType === 'cabinet' && $locationCode && $locationName) {
                $cabinetDisplay = trim($locationCode . ' ' . $locationName);
            }

            $capacity = null;
            $current = null;
            if ($storageType === 'location' && $stock->warehouseLocation) {
                $capacity = $stock->warehouseLocation->capacity_units;
                $current = $stock->warehouseLocation->current_units;
            } elseif ($storageType === 'cabinet' && $stock->warehouseCabinet) {
                $capacity = $stock->warehouseCabinet->capacity_units;
                $current = $stock->warehouseCabinet->current_units;
            }


            return [
                'id' => $stock->id,
                'warehouse' => $warehouse?->name,
                'warehouse_id' => $warehouse?->id,
                'room' => $room?->name,
                'location_code' => $locationCode,
                'location_name' => $locationName,
                'storage_type' => $storageType,
                'location_display' => $locationDisplay,
                'cabinet_display' => $cabinetDisplay,
                'cabinet_id' => $stock->cabinet_id,
                'warehouse_location_id' => $stock->warehouse_location_id,
                'quantity' => $stock->quantity,
                'notes' => $stock->notes,
                'supplier_id' => $supplier?->id,
                'supplier_name' => $supplier?->name,
                'expiration_date' => $stock->expiration_date,
                'batch_number' => $stock->batch_number,
                'capacity_units' => $capacity,
                'current_units' => $current,
            ];
        });

        $totalFromStocks = $stockEntries->sum('quantity');

        $totalQuantity = $totalFromStocks;

        // --- 3. Build availability per warehouse ---
        $warehouseQuery = Warehouse::query()->orderBy('name');
        if (Schema::hasColumn('warehouses', 'status')) {
            $warehouseQuery->where('status', 'active');
        }
        $allWarehouses = $warehouseQuery->get();
        $stockByWarehouse = $stockDetails->groupBy('warehouse_id');

        $warehousesAvailability = $allWarehouses->map(function ($wh) use ($stockByWarehouse) {
            $warehouseStocks = $stockByWarehouse->get($wh->id, collect());
            $qty = $warehouseStocks->sum('quantity');

            return [
                'warehouse_id' => $wh->id,
                'warehouse_name' => $wh->name,
                'city' => $wh->city,
                'in_stock' => $qty > 0,
                'quantity' => $qty,
                'locations' => $warehouseStocks->values(),
            ];
        });

        return [
            'product_id' => $product->id,
            'product_name' => $product->title,
            'total_quantity' => $totalQuantity,
            'is_in_stock' => $totalQuantity > 0,
            'details' => $stockDetails->values(),
            'warehouses_availability' => $warehousesAvailability,
        ];
    }

    public function searchStocks(Request $request)
    {
        $user = Auth::user();
        $search = $request->get('q', '');
        $perPage = $request->get('per_page', 20);

        $query = ProductStock::with('product', 'warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse', 'supplier')
            ->whereHas('product', fn ($q) => $q->where('status', 'active'));

        // Filtrer par dÃ©pÃ´t de l'utilisateur si c'est un responsable/agent
        if ($user && $user->depot_id) {
            $isStockManager = $user->hasAnyRole(['responsable de stock', 'responsable', 'agent de stock', 'agent']);

            if ($isStockManager) {
                $query->where(function($q) use ($user) {
                    $q->whereHas('warehouseLocation.room', function ($subQ) use ($user) {
                        $subQ->where('warehouse_id', $user->depot_id);
                    })->orWhereHas('warehouseCabinet.room', function ($subQ) use ($user) {
                        $subQ->where('warehouse_id', $user->depot_id);
                    });
                });
            }
        }

        if ($search) {
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('status', 'active')
                    ->where(function ($sub) use ($search) {
                        $sub->where('title', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%");
                    });
            })->orWhereHas('warehouseLocation', function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%");
            })->orWhereHas('warehouseCabinet', function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }
}




