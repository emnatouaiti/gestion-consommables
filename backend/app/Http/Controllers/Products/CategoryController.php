<?php

namespace App\Http\Controllers\Products;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        // Tree mode: returns root categories with nested children
        if ($request->filled('tree') && $request->tree == '1') {
            $query = Category::whereNull('parent_id')->with('recursiveChildren');

            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            if ($request->filled('q')) {
                $q = trim($request->q);
                $query->where(function ($sub) use ($q) {
                    $sub->where('title', 'like', "%{$q}%")
                        ->orWhere('description', 'like', "%{$q}%");
                });
            }

            return response()->json(
                $query->orderBy('title', 'asc')->get()
            );
        }

        // Flat mode (default)
        $query = Category::query();

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('q')) {
            $q = trim($request->q);
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        return response()->json(
            $query->orderBy('id', 'desc')->get()
        );
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255|unique:categories,title',
            'description' => 'nullable|string',
            'status' => 'required|in:active,inactive',
            'parent_id' => 'nullable|integer|exists:categories,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        // Calculate level
        if (!empty($data['parent_id'])) {
            $parent = Category::findOrFail($data['parent_id']);
            $level = $parent->level + 1;

            if ($level > 3) {
                return response()->json([
                    'message' => 'Impossible de creer plus de 3 niveaux de categories.',
                ], 422);
            }

            $data['level'] = $level;
        } else {
            $data['level'] = 1;
            $data['parent_id'] = null;
        }

        $category = Category::create($data);

        return response()->json([
            'message' => 'Categorie creee',
            'category' => $category->load('recursiveChildren'),
        ], 201);
    }

    public function show(int $id)
    {
        return response()->json(
            Category::with('recursiveChildren', 'parent')->findOrFail($id)
        );
    }

    public function update(Request $request, int $id)
    {
        $category = Category::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255|unique:categories,title,' . $category->id,
            'description' => 'nullable|string',
            'status' => 'required|in:active,inactive',
            'parent_id' => 'nullable|integer|exists:categories,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $data = $validator->validated();

        // Calculate level
        if (!empty($data['parent_id'])) {
            // Prevent setting parent to self or own descendant
            if ($data['parent_id'] == $category->id) {
                return response()->json([
                    'message' => 'Une categorie ne peut pas etre son propre parent.',
                ], 422);
            }

            $parent = Category::findOrFail($data['parent_id']);
            $level = $parent->level + 1;

            if ($level > 3) {
                return response()->json([
                    'message' => 'Impossible de depasser 3 niveaux de categories.',
                ], 422);
            }

            $data['level'] = $level;
        } else {
            $data['level'] = 1;
            $data['parent_id'] = null;
        }

        $category->update($data);

        return response()->json([
            'message' => 'Categorie mise a jour',
            'category' => $category->load('recursiveChildren'),
        ]);
    }

    public function destroy(int $id)
    {
        $category = Category::withCount(['products', 'children'])->findOrFail($id);

        if ($category->products()->count() > 0) {
            return response()->json([
                'message' => 'Suppression impossible: cette categorie contient des produits.'
            ], 400);
        }

        // Cascade delete is handled by the FK, but warn the user
        $category->delete();

        return response()->json(['message' => 'Categorie supprimee']);
    }
}
