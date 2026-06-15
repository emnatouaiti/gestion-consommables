<?php

namespace App\Http\Controllers\Warehouse;

use App\Http\Controllers\Controller;
use App\Models\WarehouseLocation;
use App\Models\WarehouseRoom;
use Illuminate\Http\Request;

class WarehouseLocationController extends Controller
{
    public function index(Request $request)
    {
        $query = WarehouseLocation::with('room.warehouse');

        if ($request->has('room_id') && !empty($request->room_id)) {
            $query->where('room_id', $request->room_id);
        }

        if ($request->has('q') && !empty($request->q)) {
            $search = $request->q;
            $query->where('code', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%");
        }


        return $query->orderBy('code')->paginate($request->get('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:warehouse_rooms,id',
            'code' => 'nullable|string|unique:warehouse_locations,code',
            'name' => 'required|string',
            'capacity_units' => 'nullable|numeric',
        ]);

        $room = WarehouseRoom::findOrFail($validated['room_id']);
        if ($room->max_locations > 0 && $room->locations()->count() >= $room->max_locations) {
            return response()->json([
                'message' => "La salle '{$room->name}' a atteint sa capacite maximale de {$room->max_locations} emplacements."
            ], 422);
        }

        return WarehouseLocation::create($validated);
    }

    public function show(WarehouseLocation $location)
    {
        return $location->load(['room', 'productStocks.product' => fn ($q) => $q->where('status', 'active')]);
    }

    public function update(Request $request, WarehouseLocation $location)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:warehouse_rooms,id',
            'code' => 'nullable|string|unique:warehouse_locations,code,' . $location->id,
            'name' => 'required|string',
            'capacity_units' => 'nullable|numeric',
        ]);

        $location->update($validated);
        return $location;
    }

    public function destroy(WarehouseLocation $location)
    {
        if (\App\Models\ProductStock::where('warehouse_location_id', $location->id)->exists()) {
            return response()->json(['message' => 'Suppression impossible: cet emplacement contient du stock.'], 422);
        }

        $location->delete();
        return response()->noContent();
    }

    public function getProducts(WarehouseLocation $location)
    {
        $stocks = \App\Models\ProductStock::with(['product.category'])
            ->whereHas('product', fn($q) => $q->where('status', 'active'))
            ->where('warehouse_location_id', $location->id)
            ->get();

        $products = $stocks->map(function ($stock) {
            $prod = $stock->product;
            if ($prod) {
                // Ensure we have the local quantity for the 3D viewer
                $prod->local_quantity = $stock->quantity;
            }
            return $prod;
        })->filter()->values();

        return response()->json(['data' => $products]);
    }
}




