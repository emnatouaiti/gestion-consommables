<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class SupplierController extends Controller
{
    public function index()
    {
        return Supplier::with('products', 'reviews.user', 'contacts')
            ->withCount('products')
            ->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'photo' => 'nullable|image|max:2048',
            'phone' => 'nullable|string',
            'email' => 'nullable|email',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'integer|exists:products,id',
        ]);

        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('suppliers', 'public');
            $validated['image_path'] = $path;
        }

        $productIds = $validated['product_ids'] ?? [];
        unset($validated['product_ids']);

        $supplier = Supplier::create($validated);
        if (!empty($productIds)) {
            $supplier->products()->sync($productIds);
        }

        return $supplier->load('products');
    }

    public function show(Supplier $supplier)
    {
        try {
            // Charger les produits
            $supplier->load('products');
            $supplier->load('reviews.user');
            $supplier->load('contacts');
            // Trier les avis
            $supplier->reviews = $supplier->reviews->sortByDesc('created_at')->values();
            // Map user name to 'name' for each review
            $supplier->reviews->transform(function ($review) {
                if ($review->user) {
                    $review->user->name = $review->user->nomprenom;
                }
                return $review;
            });

            $supplyHistory = \App\Models\ProductStock::where('supplier_id', $supplier->id)
                ->with('product:id,title,reference')
                ->select('product_id', DB::raw('SUM(quantity) as total_quantity'))
                ->groupBy('product_id')
                ->get();

            $data = $supplier->toArray();
            $data['supply_history'] = $supplyHistory;

            return response()->json($data);
        }
        catch (\Exception $e) {
            Log::error('Erreur show supplier: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function addReview(Request $request, Supplier $supplier)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $validated = $request->validate([
                'content' => 'required|string|min:1',
                'rating' => 'nullable|integer|min:1|max:5',
            ]);

            $review = $supplier->reviews()->create([
                'user_id' => $user->id,
                'content' => $validated['content'],
                'rating' => $validated['rating'] ?? null,
            ]);

            $review->load('user');
            if ($review->user) {
                $review->user->name = $review->user->nomprenom;
            }
            return response()->json($review->toArray(), 201);
        }
        catch (\Exception $e) {
            Log::error('Erreur addReview: ' . $e->getMessage());
            return response()->json(['error' => 'Erreur lors de la création de l\'avis', 'message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, Supplier $supplier)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'photo' => 'nullable|image|max:2048',
            'phone' => 'nullable|string',
            'email' => 'nullable|email',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'integer|exists:products,id',
        ]);

        if ($request->hasFile('photo')) {
            if ($supplier->image_path) {
                Storage::disk('public')->delete($supplier->image_path);
            }
            $path = $request->file('photo')->store('suppliers', 'public');
            $validated['image_path'] = $path;
        }

        $productIds = $validated['product_ids'] ?? [];
        unset($validated['product_ids']);

        $supplier->update($validated);
        if (!empty($productIds)) {
            $supplier->products()->sync($productIds);
        }

        return $supplier->load('products');
    }

    public function destroy(Supplier $supplier)
    {
        if ($supplier->image_path) {
            Storage::disk('public')->delete($supplier->image_path);
        }
        $supplier->delete();
        return response()->noContent();
    }
}
