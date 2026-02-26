<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\WarehouseCabinet;
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

        $status = $request->get('status', 'active');
        if ($status) {
            $query->where('status', $status);
        }

        return $query->orderBy('name')->paginate($request->get('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:warehouse_rooms,id',
            'code' => 'nullable|string|max:255',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'in:active,inactive',
        ]);

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
            'description' => 'nullable|string',
            'status' => 'in:active,inactive',
        ]);

        $cabinet->update($validated);
        return $cabinet;
    }

    public function destroy(WarehouseCabinet $cabinet)
    {
        $cabinet->delete();
        return response()->noContent();
    }
}
