<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\WarehouseLocation;
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

        $status = $request->get('status', 'active');
        if ($status) {
            $query->where('status', $status);
        }

        return $query->orderBy('code')->paginate($request->get('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:warehouse_rooms,id',
            'code' => 'required|string|unique:warehouse_locations,code',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'type' => 'nullable|string',
            'capacity_units' => 'nullable|numeric',
            'status' => 'in:active,inactive',
        ]);

        return WarehouseLocation::create($validated);
    }

    public function show(WarehouseLocation $location)
    {
        return $location->load('room', 'products');
    }

    public function update(Request $request, WarehouseLocation $location)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:warehouse_rooms,id',
            'code' => 'required|string|unique:warehouse_locations,code,' . $location->id,
            'name' => 'required|string',
            'description' => 'nullable|string',
            'type' => 'nullable|string',
            'capacity_units' => 'nullable|numeric',
            'status' => 'in:active,inactive',
        ]);

        $location->update($validated);
        return $location;
    }

    public function destroy(WarehouseLocation $location)
    {
        $location->delete();
        return response()->noContent();
    }

    public function getProducts(WarehouseLocation $location)
    {
        return $location->load(['products' => function ($query) {
            $query->with(['category', 'stocks']);
        }])->products;
    }
}
