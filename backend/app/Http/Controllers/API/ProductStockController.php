<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\ProductStock;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Http\Request;

class ProductStockController extends Controller
{
    public function getProductStocks(Product $product)
    {
        return $product->stocks()->with('warehouseLocation.room.warehouse', 'supplier')->get();
    }

    public function updateStock(Request $request, ProductStock $stock)
    {
        $validated = $request->validate([
            'quantity' => 'required|integer|min:0',
            'notes' => 'nullable|string',
            'supplier_id' => 'nullable|exists:suppliers,id',
        ]);

        $validated['last_updated'] = now();

        $stock->update($validated);
        return $stock->load('warehouseLocation.room.warehouse', 'product', 'supplier');
    }

    public function addStock(Request $request, Product $product)
    {
        $validated = $request->validate([
            'warehouse_location_id' => 'required|exists:warehouse_locations,id',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
            'supplier_id' => 'nullable|exists:suppliers,id',
        ]);

        $validated['last_updated'] = now();

        $stock = ProductStock::create(array_merge($validated, ['product_id' => $product->id]));

        return $stock->load('warehouseLocation.room.warehouse', 'product', 'supplier');
    }

    public function removeStock(ProductStock $stock)
    {
        $stock->delete();
        return response()->noContent();
    }

    public function getTotalStock(Product $product)
    {
        // --- 1. Stocks from product_stocks table ---
        $stockEntries = $product->stocks()
            ->with('warehouseLocation.room.warehouse', 'supplier')
            ->get();

        $stockDetails = $stockEntries->map(fn($stock) => [
        'id' => $stock->id,
        'warehouse' => $stock->warehouseLocation->room->warehouse->name,
        'warehouse_id' => $stock->warehouseLocation->room->warehouse->id,
        'room' => $stock->warehouseLocation->room->name,
        'location_code' => $stock->warehouseLocation->code,
        'location_name' => $stock->warehouseLocation->name,
        'quantity' => $stock->quantity,
        'notes' => $stock->notes,
        'supplier_id' => $stock->supplier_id,
        'supplier_name' => $stock->supplier ? $stock->supplier->name : null,
        ]);

        $totalFromStocks = $stockEntries->sum('quantity');

        // --- 2. Product's own location assignment ---
        $product->load('warehouseLocation.room.warehouse');
        $ownLocation = $product->warehouseLocation;
        $ownWarehouseId = null;

        if ($ownLocation && $ownLocation->room && $ownLocation->room->warehouse) {
            $ownWarehouseId = $ownLocation->room->warehouse->id;
        }

        $ownQty = $product->stock_quantity ?? 0;

        // Add the product's own location as a detail entry
        if ($ownLocation && $ownLocation->room && $ownLocation->room->warehouse && $ownQty > 0) {
            $ownDetail = [
                'id' => 'own',
                'warehouse' => $ownLocation->room->warehouse->name,
                'warehouse_id' => $ownLocation->room->warehouse->id,
                'room' => $ownLocation->room->name,
                'location_code' => $ownLocation->code,
                'location_name' => $ownLocation->name,
                'quantity' => $ownQty,
                'notes' => 'Stock principal du produit',
            ];
            $stockDetails = $stockDetails->concat([$ownDetail]);
        }

        $totalQuantity = $totalFromStocks + $ownQty;

        // --- 3. Build availability per warehouse ---
        $allWarehouses = Warehouse::where('status', 'active')->orderBy('name')->get();
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
        $search = $request->get('q', '');
        $perPage = $request->get('per_page', 20);

        $query = ProductStock::with('product', 'warehouseLocation.room.warehouse', 'supplier');

        if ($search) {
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%");
            })->orWhereHas('warehouseLocation', function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%");
            });
        }

        return $query->paginate($perPage);
    }
}
