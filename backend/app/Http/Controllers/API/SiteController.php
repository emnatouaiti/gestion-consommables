<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Site;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    public function index(Request $request)
    {
        $query = Site::query();

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where('name', 'like', "%{$q}%")
                ->orWhere('city', 'like', "%{$q}%");
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        return $query->orderBy('name')->paginate($request->input('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'nullable|in:siege,agence,other',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:255',
            'status' => 'nullable|in:active,inactive',
        ]);

        $validated['type'] = $validated['type'] ?? 'siege';
        $validated['status'] = $validated['status'] ?? 'active';

        return Site::create($validated);
    }

    public function show(Site $site)
    {
        return $site->load('floors.rooms');
    }

    public function update(Request $request, Site $site)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'nullable|in:siege,agence,other',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:255',
            'status' => 'nullable|in:active,inactive',
        ]);

        $site->update($validated);
        return $site;
    }

    public function destroy(Site $site)
    {
        $site->delete();
        return response()->noContent();
    }
}

