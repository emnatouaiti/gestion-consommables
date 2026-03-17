<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\SiteFloor;
use Illuminate\Http\Request;

class SiteFloorController extends Controller
{
    public function index(Request $request)
    {
        $query = SiteFloor::with('site');

        if ($request->filled('site_id')) {
            $query->where('site_id', $request->input('site_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return $query
            ->orderBy('level')
            ->orderBy('name')
            ->paginate($request->input('per_page', 50));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'site_id' => 'required|exists:sites,id',
            'name' => 'required|string|max:255',
            'level' => 'nullable|integer',
            'status' => 'nullable|in:active,inactive',
        ]);

        $validated['status'] = $validated['status'] ?? 'active';
        return SiteFloor::create($validated);
    }

    public function show(SiteFloor $floor)
    {
        return $floor->load('site', 'rooms');
    }

    public function update(Request $request, SiteFloor $floor)
    {
        $validated = $request->validate([
            'site_id' => 'required|exists:sites,id',
            'name' => 'required|string|max:255',
            'level' => 'nullable|integer',
            'status' => 'nullable|in:active,inactive',
        ]);

        $floor->update($validated);
        return $floor;
    }

    public function destroy(SiteFloor $floor)
    {
        $floor->delete();
        return response()->noContent();
    }
}

