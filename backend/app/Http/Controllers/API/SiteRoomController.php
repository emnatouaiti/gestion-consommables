<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\SiteRoom;
use Illuminate\Http\Request;

class SiteRoomController extends Controller
{
    public function index(Request $request)
    {
        $query = SiteRoom::with('floor.site');

        if ($request->filled('floor_id')) {
            $query->where('floor_id', $request->input('floor_id'));
        }

        if ($request->filled('site_id')) {
            $siteId = (int) $request->input('site_id');
            $query->whereHas('floor', fn ($q) => $q->where('site_id', $siteId));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where('name', 'like', "%{$q}%")
                ->orWhere('code', 'like', "%{$q}%");
        }

        return $query->orderBy('name')->paginate($request->input('per_page', 50));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'floor_id' => 'required|exists:site_floors,id',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:100',
            'status' => 'nullable|in:active,inactive',
        ]);

        $validated['status'] = $validated['status'] ?? 'active';
        return SiteRoom::create($validated);
    }

    public function show(SiteRoom $room)
    {
        return $room->load('floor.site');
    }

    public function update(Request $request, SiteRoom $room)
    {
        $validated = $request->validate([
            'floor_id' => 'required|exists:site_floors,id',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:100',
            'status' => 'nullable|in:active,inactive',
        ]);

        $room->update($validated);
        return $room;
    }

    public function destroy(SiteRoom $room)
    {
        $room->delete();
        return response()->noContent();
    }
}

