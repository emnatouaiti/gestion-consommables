<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\WarehouseRoom;
use App\Models\Warehouse;
use App\Models\WarehouseLocation;
use App\Models\ProductStock;
use Illuminate\Http\Request;

class WarehouseRoomController extends Controller
{
    public function index(Request $request)
    {
        $query = WarehouseRoom::with('warehouse');

        if ($request->has('warehouse_id') && !empty($request->warehouse_id)) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->has('q') && !empty($request->q)) {
            $search = $request->q;
            $query->where('name', 'like', "%{$search}%");
        }

        $status = $request->get('status', 'active');
        if ($status) {
            $query->where('status', $status);
        }

        return $query->orderBy('name')->paginate($request->get('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'warehouse_id' => 'required|exists:warehouses,id',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'type' => 'nullable|string',
            'capacity_volume' => 'nullable|numeric',
            'status' => 'in:active,inactive',
        ]);

        return WarehouseRoom::create($validated);
    }

    public function show(WarehouseRoom $room)
    {
        return $room->load('warehouse', 'locations', 'cabinets');
    }

    public function update(Request $request, WarehouseRoom $room)
    {
        $validated = $request->validate([
            'warehouse_id' => 'required|exists:warehouses,id',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'type' => 'nullable|string',
            'capacity_volume' => 'nullable|numeric',
            'status' => 'in:active,inactive',
        ]);

        $room->update($validated);
        return $room;
    }

    public function destroy(WarehouseRoom $room)
    {
        $room->delete();
        return response()->noContent();
    }

    public function getProducts(WarehouseRoom $room)
    {
        $room->load([
            'warehouse',
            'locations.products.category',
        ]);

        // 1) Products directly assigned to locations (legacy)
        $locationProducts = $room->locations->flatMap(function ($location) use ($room) {
            return $location->products->map(function ($product) use ($location, $room) {
                return array_merge($product->toArray(), [
                    'location_id' => $location->id,
                    'location_code' => $location->code,
                    'location_name' => $location->name,
                    'room_id' => $room->id,
                    'room_name' => $room->name,
                    'warehouse_id' => $room->warehouse_id,
                    'warehouse_name' => $room->warehouse ? $room->warehouse->name : '',
                ]);
            });
        })->values();

        // 2) Products present in product_stocks tied to this room (locations or cabinets)
        $stockEntries = ProductStock::with('product', 'warehouseLocation.room', 'warehouseCabinet.room')
            ->get()
            ->filter(function ($s) use ($room) {
                $roomRef = $s->warehouseLocation?->room ?? $s->warehouseCabinet?->room ?? null;
                return $roomRef && $roomRef->id === $room->id;
            });

        $stockProducts = $stockEntries->map(function ($s) use ($room) {
            $product = $s->product;
            $roomRef = $s->warehouseLocation?->room ?? $s->warehouseCabinet?->room ?? null;
            $location = $s->warehouseLocation ?? $s->warehouseCabinet ?? null;

            return array_merge($product->toArray(), [
                'location_id' => $location?->id,
                'location_code' => $location?->code,
                'location_name' => $location?->name,
                'room_id' => $room->id,
                'room_name' => $room->name,
                'warehouse_id' => $room->warehouse_id,
                'warehouse_name' => $room->warehouse ? $room->warehouse->name : '',
                'stock_quantity' => $s->quantity,
            ]);
        })->values();

        // Merge both lists keyed by product id to avoid duplicates
        $merged = collect([]);
        foreach ($locationProducts as $p) {
            $merged->put($p['id'], $p);
        }
        foreach ($stockProducts as $p) {
            if (!$merged->has($p['id'])) {
                $merged->put($p['id'], $p);
            } else {
                $existing = $merged->get($p['id']);
                if (empty($existing['stock_quantity']) && !empty($p['stock_quantity'])) {
                    $existing['stock_quantity'] = $p['stock_quantity'];
                    $merged->put($p['id'], $existing);
                }
            }
        }

        return response()->json([
            'room' => $room->only('id', 'name', 'type'),
            'warehouse' => $room->warehouse ? $room->warehouse->only('id', 'name', 'city') : null,
            'products' => $merged->values(),
        ]);
    }
}
