<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Models\SupplierContact;
use Illuminate\Http\Request;

class SupplierContactController extends Controller
{
    public function index(Supplier $supplier)
    {
        return $supplier->contacts()
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request, Supplier $supplier)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'role' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string',
        ]);

        $contact = $supplier->contacts()->create($validated);
        return response()->json($contact, 201);
    }

    public function update(Request $request, Supplier $supplier, SupplierContact $contact)
    {
        if ($contact->supplier_id !== $supplier->id) {
            return response()->json(['error' => 'Contact does not belong to supplier'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'role' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string',
        ]);

        $contact->update($validated);
        return response()->json($contact);
    }

    public function destroy(Supplier $supplier, SupplierContact $contact)
    {
        if ($contact->supplier_id !== $supplier->id) {
            return response()->json(['error' => 'Contact does not belong to supplier'], 404);
        }

        $contact->delete();
        return response()->noContent();
    }
}

