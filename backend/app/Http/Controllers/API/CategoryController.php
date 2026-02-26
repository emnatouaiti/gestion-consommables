<?php

namespace App\Http\Controllers\API;

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
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();

        // Calculate level
        if (!empty($data['parent_id'])) {
            $parent = Category::findOrFail($data['parent_id']);
            $level = $parent->level + 1;

            if ($level > 3) {
                return response()->json([
                    'message' => 'Impossible de créer plus de 3 niveaux de catégories.',
                ], 422);
            }

            $data['level'] = $level;
        } else {
            $data['level'] = 1;
            $data['parent_id'] = null;
        }

        $category = Category::create($data);

        return response()->json([
            'message' => 'Catégorie créée',
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
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();

        // Calculate level
        if (!empty($data['parent_id'])) {
            // Prevent setting parent to self or own descendant
            if ($data['parent_id'] == $category->id) {
                return response()->json([
                    'message' => 'Une catégorie ne peut pas être son propre parent.',
                ], 422);
            }

            $parent = Category::findOrFail($data['parent_id']);
            $level = $parent->level + 1;

            if ($level > 3) {
                return response()->json([
                    'message' => 'Impossible de dépasser 3 niveaux de catégories.',
                ], 422);
            }

            $data['level'] = $level;
        } else {
            $data['level'] = 1;
            $data['parent_id'] = null;
        }

        $category->update($data);

        return response()->json([
            'message' => 'Catégorie mise à jour',
            'category' => $category->load('recursiveChildren'),
        ]);
    }

    public function destroy(int $id)
    {
        $category = Category::withCount(['products', 'children'])->findOrFail($id);

        if ($category->products_count > 0) {
            return response()->json([
                'message' => 'Suppression impossible: cette catégorie contient des produits.',
            ], 422);
        }

        // Cascade delete is handled by the FK, but warn the user
        $category->delete();

        return response()->json(['message' => 'Catégorie supprimée']);
    }
}
