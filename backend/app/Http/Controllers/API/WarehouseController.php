<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function index(Request $request)
    {
        $query = Warehouse::query();

        if ($request->filled('kind')) {
            $query->where('kind', $request->input('kind'));
        }

        if ($request->has('q') && !empty($request->q)) {
            $search = $request->q;
            $query->where('name', 'like', "%{$search}%")
                ->orWhere('city', 'like', "%{$search}%");
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
            'name' => 'required|string',
            'kind' => 'nullable|in:depot,local',
            'description' => 'nullable|string',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'governorate' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'phone' => 'nullable|string',
            'status' => 'in:active,inactive',
        ]);

        return Warehouse::create($validated);
    }

    public function show(Warehouse $warehouse)
    {
        return $warehouse->load('rooms.locations');
    }

    public function update(Request $request, Warehouse $warehouse)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'kind' => 'nullable|in:depot,local',
            'description' => 'nullable|string',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'governorate' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'phone' => 'nullable|string',
            'status' => 'in:active,inactive',
        ]);

        $warehouse->update($validated);
        return $warehouse;
    }

    public function destroy(Warehouse $warehouse)
    {
        $warehouse->delete();
        return response()->noContent();
    }

    public function getProducts(Warehouse $warehouse)
    {
        // Get all products in this warehouse through warehouse locations
        return $warehouse->load([
            'rooms' => function ($q) {
            $q->with([
                    'locations' => function ($l) {
                $l->with('products.category');
            }
                ]);
        }
        ])->rooms->flatMap(function ($room) {
            return $room->locations->flatMap(function ($location) {
                    return $location->products->map(function ($product) use ($location) {
                            return array_merge($product->toArray(), [
                                'location_id' => $location->id,
                                'location_code' => $location->code,
                                'location_name' => $location->name,
                                'room_id' => $location->warehouse_room_id,
                                'room_name' => $location->warehouse_room ? $location->warehouse_room->name : ''
                            ]);
                        }
                        );
                    }
                    );
                })->values();
    }
}
