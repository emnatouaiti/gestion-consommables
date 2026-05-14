<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Marque;
use App\Models\Modele;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ReferencesController extends Controller
{
    // Marques
    public function listMarques(Request $request)
    {
        $q = Marque::query();
        return response()->json($q->orderBy('name')->get());
    }

    public function storeMarque(Request $request)
    {
        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);
        $m = Marque::create(['name' => trim($request->name)]);
        return response()->json($m, 201);
    }

    public function updateMarque(Request $request, int $id)
    {
        $m = Marque::findOrFail($id);
        $v = Validator::make($request->all(), ['name' => 'required|string|max:255']);
        if ($v->fails()) return response()->json($v->errors(), 422);
        $m->update(['name' => trim($request->name)]);
        return response()->json($m);
    }

    public function deleteMarque(int $id)
    {
        $m = Marque::findOrFail($id);
        $m->delete();
        return response()->json(['message' => 'Supprimé']);
    }

    // Modeles
    public function listModeles(Request $request)
    {
        $q = Modele::query();
        if ($request->filled('marque_id')) $q->where('marque_id', $request->marque_id);
        return response()->json($q->orderBy('name')->get());
    }

    public function storeModele(Request $request)
    {
        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'marque_id' => 'nullable|exists:marques,id',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);
        $r = Modele::create(['name' => trim($request->name), 'marque_id' => $request->marque_id ?? null]);
        return response()->json($r, 201);
    }

    public function updateModele(Request $request, int $id)
    {
        $r = Modele::findOrFail($id);
        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'marque_id' => 'nullable|exists:marques,id',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);
        $r->update(['name' => trim($request->name), 'marque_id' => $request->marque_id ?? null]);
        return response()->json($r);
    }

    public function deleteModele(int $id)
    {
        $r = Modele::findOrFail($id);
        $r->delete();
        return response()->json(['message' => 'Supprimé']);
    }
}
