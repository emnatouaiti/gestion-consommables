<?php

namespace App\Http\Controllers\Warehouse;

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
        if ($warehouse->rooms()->exists()) {
            return response()->json(['message' => 'Suppression impossible: ce depot contient des salles.'], 422);
        }

        $warehouse->delete();
        return response()->noContent();
    }

    public function getProducts(Warehouse $warehouse)
    {
        // Products present in product_stocks tied to this warehouse (locations or cabinets)
        $stockEntries = ProductStock::with(['product.category', 'warehouseLocation.room', 'warehouseCabinet.room'])
            ->whereHas('product', fn ($q) => $q->where('status', 'active'))
            ->get()
            ->filter(function ($s) use ($warehouse) {
                $room = $s->warehouseLocation?->room ?? $s->warehouseCabinet?->room ?? null;
                return $room && $room->warehouse_id === $warehouse->id;
            });

        $products = $stockEntries->map(function ($s) {
            $loc = $s->warehouseLocation;
            $cab = $s->warehouseCabinet;
            $room = $loc?->room ?? $cab?->room;
            
            return array_merge($s->product->toArray(), [
                'stock_quantity' => $s->quantity,
                'location_id' => $loc?->id,
                'location_code' => $loc?->code,
                'location_name' => $loc?->name,
                'cabinet_id' => $cab?->id,
                'cabinet_name' => $cab?->name,
                'room_id' => $room?->id,
                'room_name' => $room?->name ?? '',
            ]);
        });

        return response()->json($products->values());
    }
}





