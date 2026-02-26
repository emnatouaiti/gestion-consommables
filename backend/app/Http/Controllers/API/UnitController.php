<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UnitController extends Controller
{
    public function index()
    {
        return Unit::orderBy('name')->get(['id', 'name', 'code', 'description']);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'nullable|string|max:50|unique:units,code',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $unit = Unit::create($validator->validated());

        return response()->json(['message' => 'Unite creee', 'unit' => $unit], 201);
    }

    public function update(Request $request, Unit $unit)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'nullable|string|max:50|unique:units,code,' . $unit->id,
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $unit->update($validator->validated());

        return response()->json(['message' => 'Unite mise a jour', 'unit' => $unit]);
    }

    public function destroy(Unit $unit)
    {
        $unit->delete();

        return response()->json(['message' => 'Unite supprimee']);
    }
}
