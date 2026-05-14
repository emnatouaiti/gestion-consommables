<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use App\Models\ProductStock;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function index(Request $request)
    {
        $query = Warehouse::query();


        if ($request->has('q') && !empty($request->q)) {
            $search = $request->q;
            $query->where('name', 'like', "%{$search}%");
        }


        return $query->orderBy('name')->paginate($request->get('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'address' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'phone' => 'nullable|string',
            'max_rooms' => 'nullable|integer|min:1',
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
            'address' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'phone' => 'nullable|string',
            'max_rooms' => 'nullable|integer|min:1',
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
        // 1) Products directly assigned to locations (legacy behaviour)
        $locationProducts = $warehouse->load([
            'rooms' => function ($q) {
                $q->with([
                    'locations' => function ($l) {
                        $l->with(['products' => function ($p) {
                            $p->where('status', 'active')->with('category');
                        }]);
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
                });
            });
        })->values();

        // 2) Products present in product_stocks tied to this warehouse (locations or cabinets)
        $stockEntries = ProductStock::with('product', 'warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse')
            ->whereHas('product', fn ($q) => $q->where('status', 'active'))
            ->get()
            ->filter(function ($s) use ($warehouse) {
                $room = $s->warehouseLocation?->room ?? $s->warehouseCabinet?->room ?? null;
                $wh = $room?->warehouse ?? null;
                return $wh && $wh->id === $warehouse->id;
            });

        $stockProducts = $stockEntries->map(function ($s) {
            $product = $s->product;
            $room = $s->warehouseLocation?->room ?? $s->warehouseCabinet?->room ?? null;
            $location = $s->warehouseLocation ?? $s->warehouseCabinet ?? null;

            if (!$product) {
                return null;
            }

            return array_merge($product->toArray(), [
                'location_id' => $location?->id,
                'location_code' => $location?->code,
                'location_name' => $location?->name,
                'room_id' => $room?->id,
                'room_name' => $room?->name,
                'stock_quantity' => $s->quantity,
            ]);
        })->filter()->values();

        // Merge both lists keyed by product id to avoid duplicates, prefer locationProducts data
        $merged = collect([]);
        foreach ($locationProducts as $p) {
            $merged->put($p['id'], $p);
        }
        foreach ($stockProducts as $p) {
            if (!$merged->has($p['id'])) {
                $merged->put($p['id'], $p);
            } else {
                // ensure stock_quantity is present
                $existing = $merged->get($p['id']);
                if (empty($existing['stock_quantity']) && !empty($p['stock_quantity'])) {
                    $existing['stock_quantity'] = $p['stock_quantity'];
                    $merged->put($p['id'], $existing);
                }
            }
        }

        return $merged->values();
    }
}
