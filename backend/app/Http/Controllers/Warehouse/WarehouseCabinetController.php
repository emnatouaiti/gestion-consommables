<?php

namespace App\Http\Controllers\Warehouse;

use App\Http\Controllers\Controller;
use App\Models\WarehouseCabinet;
use App\Models\WarehouseRoom;
use Illuminate\Http\Request;

class WarehouseCabinetController extends Controller
{
    public function index(Request $request)
    {
        $query = WarehouseCabinet::with(['room.warehouse']);

        if ($request->has('room_id') && !empty($request->room_id)) {
            $query->where('room_id', $request->room_id);
        }

        if ($request->has('q') && !empty($request->q)) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }


        return $query->orderBy('name')->paginate($request->get('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:warehouse_rooms,id',
            'code' => 'nullable|string|max:255',
            'name' => 'required|string|max:255',
            'capacity_units' => 'nullable|numeric',
        ]);

        $room = WarehouseRoom::findOrFail($validated['room_id']);
        if ($room->max_cabinets > 0 && $room->cabinets()->count() >= $room->max_cabinets) {
            return response()->json([
                'message' => "La salle '{\$room->name}' a atteint sa capacité maximale de {$room->max_cabinets} armoires."
            ], 422);
        }

        return WarehouseCabinet::create($validated);
    }

    public function show(WarehouseCabinet $cabinet)
    {
        return $cabinet->load('room.warehouse');
    }

    public function update(Request $request, WarehouseCabinet $cabinet)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:warehouse_rooms,id',
            'code' => 'nullable|string|max:255',
            'name' => 'required|string|max:255',
            'capacity_units' => 'nullable|numeric',
        ]);

        $cabinet->update($validated);
        return $cabinet;
    }

    public function destroy(WarehouseCabinet $cabinet)
    {
        if (\App\Models\ProductStock::where('cabinet_id', $cabinet->id)->exists()) {
            return response()->json(['message' => 'Suppression impossible: cette armoire contient du stock.'], 422);
        }

        $cabinet->delete();
        return response()->noContent();
    }

    public function products(WarehouseCabinet $cabinet)
    {
        $stocks = \App\Models\ProductStock::with(['product.category'])
            ->whereHas('product', fn($q) => $q->where('status', 'active'))
            ->where('cabinet_id', $cabinet->id)
            ->get();

        $products = $stocks->map(function ($stock) {
            $prod = $stock->product;
            if ($prod) {
                $prod->local_quantity = $stock->quantity;
            }
            return $prod;
        })->filter()->values();

        return response()->json(['data' => $products]);
    }
}




