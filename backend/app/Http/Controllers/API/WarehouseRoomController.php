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


        return $query->orderBy('name')->paginate($request->get('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'warehouse_id' => 'required|exists:warehouses,id',
            'name' => 'required|string',
            'max_locations' => 'nullable|integer|min:1',
            'max_cabinets' => 'nullable|integer|min:1',
        ]);

        $warehouse = Warehouse::findOrFail($validated['warehouse_id']);
        if ($warehouse->max_rooms > 0 && $warehouse->rooms()->count() >= $warehouse->max_rooms) {
            return response()->json([
                'message' => "Le dépôt '{$warehouse->name}' a atteint sa capacité maximale de {$warehouse->max_rooms} salles."
            ], 422);
        }

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
            'max_locations' => 'nullable|integer|min:1',
            'max_cabinets' => 'nullable|integer|min:1',
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
        $stockEntries = ProductStock::with(['product.category', 'warehouseLocation', 'warehouseCabinet'])
            ->whereHas('product', fn ($q) => $q->where('status', 'active'))
            ->get()
            ->filter(function ($s) use ($room) {
                $roomRef = $s->warehouseLocation?->room_id ?? $s->warehouseCabinet?->room_id ?? null;
                return $roomRef === $room->id;
            });

        $products = $stockEntries->map(function ($s) use ($room) {
            $loc = $s->warehouseLocation;
            $cab = $s->warehouseCabinet;
            
            return array_merge($s->product->toArray(), [
                'stock_quantity' => $s->quantity,
                'location_id' => $loc?->id,
                'location_code' => $loc?->code,
                'location_name' => $loc?->name,
                'cabinet_id' => $cab?->id,
                'cabinet_name' => $cab?->name,
                'room_id' => $room->id,
                'room_name' => $room->name,
                'warehouse_id' => $room->warehouse_id,
                'warehouse_name' => $room->warehouse ? $room->warehouse->name : '',
            ]);
        });

        return response()->json([
            'room' => $room->only('id', 'name'),
            'warehouse' => $room->warehouse ? $room->warehouse->only('id', 'name') : null,
            'products' => $products->values(),
        ]);
    }
}
