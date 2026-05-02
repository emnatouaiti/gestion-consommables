<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ProductController extends Controller
{
    public function requestList(Request $request)
    {
        $q = trim((string) $request->get('q', ''));

        $query = Product::query()
            ->where('status', 'active')
            ->select(['id', 'title', 'reference', 'stock_quantity', 'has_expiration'])
            ->orderBy('title');

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('reference', 'like', "%{$q}%");
            });
        }

        return response()->json($query->get());
    }

    public function index(Request $request)
    {
        $query = Product::with([
            'category:id,title',
            'suppliers:id,name',
            'photos:id,product_id,path,sort_order',
            'unit:id,name,code',
            'warehouseLocation' => function ($q) {
                $q->with(['room' => function ($r) {
                    $r->with('warehouse:id,name');
                }]);
            }
        ]);
        $perPage = max(1, min(100, (int) $request->get('per_page', 20)));

        // Default: only active products everywhere, unless the products list explicitly asks otherwise.
        $status = $request->get('status', 'active');
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($request->filled('categorie_id')) {
            $query->where('categorie_id', $request->categorie_id);
        }

        if ($request->filled('supplier_id')) {
            $supplierId = (int) $request->supplier_id;
            $query->whereHas('suppliers', function ($sub) use ($supplierId) {
                $sub->where('suppliers.id', $supplierId);
            });
        }

        if ($request->filled('q')) {
            $q = trim($request->q);
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('reference', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        if ($request->boolean('low_stock_only')) {
            $query->whereColumn('stock_quantity', '<=', 'seuil_min');
        }

        if ($request->boolean('out_of_stock_only')) {
            $query->where('stock_quantity', '<=', 0);
        }

        return response()->json(
            $query->orderBy('id', 'desc')->paginate($perPage)
        );
    }

    public function overview()
    {
        $totalProducts = Product::count();
        $activeProducts = Product::where('status', 'active')->count();
        $outOfStock = Product::where('stock_quantity', '<=', 0)->count();
        $lowStock = Product::whereColumn('stock_quantity', '<=', 'seuil_min')->count();
        $totalUnits = (int) Product::sum('stock_quantity');
        $inventoryValue = (float) Product::selectRaw('COALESCE(SUM(stock_quantity * COALESCE(purchase_price, 0)), 0) as total')->value('total');

        $topLowStock = Product::with('category:id,title')
            ->where('status', 'active')
            ->whereColumn('stock_quantity', '<=', 'seuil_min')
            ->orderByRaw('(seuil_min - stock_quantity) DESC')
            ->limit(8)
            ->get(['id', 'title', 'reference', 'stock_quantity', 'seuil_min', 'categorie_id']);

        return response()->json([
            'total_products' => $totalProducts,
            'active_products' => $activeProducts,
            'out_of_stock' => $outOfStock,
            'low_stock' => $lowStock,
            'total_units' => $totalUnits,
            'inventory_value' => round($inventoryValue, 2),
            'top_low_stock' => $topLowStock,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:active,inactive',
            'title' => 'required|string|max:255',
            'short_description' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'commentaire' => 'nullable|string',
            'fabricant' => 'nullable|string|max:255',
            'num_serie' => 'nullable|string|max:255',
            'num_inventaire' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
            'marque' => 'nullable|string|max:255',
            'seuil_min' => 'required|integer|min:0',
            'seuil_max' => 'nullable|integer|gt:seuil_min',
            'reference' => 'nullable|string|max:120',
            'categorie_id' => 'required|exists:categories,id',
            'has_expiration' => 'nullable|boolean',
            'stock_quantity' => 'nullable|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'unit_id' => 'nullable|exists:units,id',
            'unit' => 'nullable|string|max:50',
            'location' => 'nullable|string|max:255',
            'warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'supplier_ids' => 'nullable|array',
            'supplier_ids.*' => 'integer|exists:suppliers,id',
            'photo' => 'nullable',
            'photos' => 'nullable|array',
            'photos.*' => 'nullable|file|mimetypes:image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/heic,image/heif|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Donnees invalides pour la creation du produit.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        // If the user tries to create a product that already exists but is inactive,
        // return it and suggest re-activating instead of creating a duplicate.
        $incomingTitle = trim((string) ($data['title'] ?? ''));
        if ($incomingTitle !== '') {
            $existingInactive = Product::query()
                ->select(['id', 'title', 'reference', 'status'])
                ->where('status', 'inactive')
                ->whereRaw('LOWER(title) = ?', [Str::lower($incomingTitle)])
                ->first();

            if ($existingInactive) {
                $activatePath = '/api/admin/products/' . $existingInactive->id . '/activate';
                return response()->json([
                    'message' => 'Ce produit existe deja mais il est inactif. Voulez-vous le reactiver (status=active) ?',
                    'errors' => [
                        'status' => ["Produit inactif: activez-le au lieu de creer un doublon (PUT {$activatePath})."],
                    ],
                    'existing_product' => $existingInactive,
                    'suggested_update' => [
                        'method' => 'PUT',
                        'path' => $activatePath,
                        'body' => [],
                    ],
                ], 422);
            }
        }

        if (!empty($data['reference'])) {
            $incomingRef = trim((string) $data['reference']);
            $existingRef = Product::query()
                ->select(['id', 'title', 'reference', 'status'])
                ->whereRaw('LOWER(reference) = ?', [Str::lower($incomingRef)])
                ->first();

            if ($existingRef) {
                if (Str::lower((string) $existingRef->status) !== 'active') {
                    $activatePath = '/api/admin/products/' . $existingRef->id . '/activate';
                    return response()->json([
                        'message' => 'Ce produit existe deja mais il est inactif. Voulez-vous le reactiver (status=active) ?',
                        'errors' => [
                            'status' => ["Produit inactif: activez-le au lieu de creer un doublon (PUT {$activatePath})."],
                        ],
                        'existing_product' => $existingRef,
                        'suggested_update' => [
                            'method' => 'PUT',
                            'path' => $activatePath,
                            'body' => [],
                        ],
                    ], 422);
                }

                return response()->json([
                    'reference' => ['Cette reference existe deja.'],
                ], 422);
            }
        }

        // If no reference provided, generate a unique one automatically
        if (empty($data['reference'])) {
            $base = isset($data['title']) ? preg_replace('/[^A-Za-z0-9]/', '', strtoupper($data['title'])) : 'PRD';
            $base = substr($base, 0, 10) ?: 'PRD';
            do {
                $suffix = strtoupper(substr(uniqid(), -6));
                $candidate = $base . '-' . $suffix;
            } while (Product::where('reference', $candidate)->exists());

            $data['reference'] = $candidate;
        }
        $supplierIds = $data['supplier_ids'] ?? [];
        unset($data['supplier_ids']);

        if (!empty($data['unit_id']) && empty($data['unit'])) {
            $data['unit'] = optional(Unit::find($data['unit_id']))->name;
        }

        $data['stock_quantity'] = $data['stock_quantity'] ?? 0;

        if ($request->hasFile('photo')) {
            $data['photo'] = $request->file('photo')->store('products', 'public');
        }

        $product = Product::create($data);
        $product->barcode_value = $this->buildBarcodeValue($product->reference, $product->id);
        $product->save();

        // Sync suppliers
        if (!empty($supplierIds)) {
            $product->suppliers()->sync($supplierIds);
        }

        if ($request->hasFile('photos')) {
            $photos = $request->file('photos');
            foreach ($photos as $idx => $file) {
                if (!$file) continue;
                $path = $file->store('products', 'public');
                $product->photos()->create([
                    'path' => $path,
                    'sort_order' => (int)$idx,
                ]);
            }
        }

        return response()->json([
            'message' => 'Produit cree',
            'product' => $product->load(['category:id,title', 'suppliers:id,name', 'photos:id,product_id,path,sort_order', 'unit:id,name,code']),
        ], 201);
    }

    public function show(int $id)
    {
        return response()->json(
            Product::with([
                'category:id,title',
                'suppliers:id,name',
                'photos:id,product_id,path,sort_order',
            'unit:id,name,code',
                'warehouseLocation' => function ($q) {
                    $q->with(['room' => function ($r) {
                        $r->with('warehouse:id,name');
                    }]);
                }
            ])->findOrFail($id)
        );
    }

    public function update(Request $request, int $id)
    {
        $product = Product::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:active,inactive',
            'title' => 'required|string|max:255',
            'short_description' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'commentaire' => 'nullable|string',
            'fabricant' => 'nullable|string|max:255',
            'num_serie' => 'nullable|string|max:255',
            'num_inventaire' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
            'marque' => 'nullable|string|max:255',
            'seuil_min' => 'required|integer|min:0',
            'seuil_max' => 'nullable|integer|gt:seuil_min',
            'reference' => 'required|string|max:120|unique:products,reference,' . $product->id,
            'categorie_id' => 'required|exists:categories,id',
            'has_expiration' => 'nullable|boolean',
            'stock_quantity' => 'nullable|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'unit_id' => 'nullable|exists:units,id',
            'unit' => 'nullable|string|max:50',
            'location' => 'nullable|string|max:255',
            'warehouse_location_id' => 'nullable|exists:warehouse_locations,id',
            'supplier_ids' => 'nullable|array',
            'supplier_ids.*' => 'integer|exists:suppliers,id',
            'photo' => 'nullable|string',
            'photos' => 'nullable|array',
            'photos.*' => 'nullable|file|mimetypes:image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/heic,image/heif|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();
        $supplierIds = $data['supplier_ids'] ?? [];
        unset($data['supplier_ids']);

        if (!empty($data['unit_id']) && empty($data['unit'])) {
            $data['unit'] = optional(Unit::find($data['unit_id']))->name;
        }

        // Don't force stock_quantity on update when omitted from payload.

        if ($request->hasFile('photo')) {
            if ($product->photo && Storage::disk('public')->exists($product->photo)) {
                Storage::disk('public')->delete($product->photo);
            }
            $data['photo'] = $request->file('photo')->store('products', 'public');
        } elseif (array_key_exists('photo', $data) && is_string($data['photo']) && $data['photo'] !== '') {
            // Accept existing path as default image without re-upload
            $data['photo'] = ltrim($data['photo'], '/');
        } else {
            unset($data['photo']);
        }

        $referenceChanged = $product->reference !== $data['reference'];

        $product->update($data);

        if ($referenceChanged || empty($product->barcode_value)) {
            $product->barcode_value = $this->buildBarcodeValue($product->reference, $product->id);
            $product->save();
        }

        // Sync suppliers
        if (!empty($supplierIds)) {
            $product->suppliers()->sync($supplierIds);
        } else {
            $product->suppliers()->detach();
        }

        if ($request->hasFile('photos')) {
            $photos = $request->file('photos');
            $baseOrder = (int)($product->photos()->max('sort_order') ?? 0);
            foreach ($photos as $idx => $file) {
                if (!$file) continue;
                $path = $file->store('products', 'public');
                $product->photos()->create([
                    'path' => $path,
                    'sort_order' => $baseOrder + (int)$idx + 1,
                ]);
            }
        }

        return response()->json([
            'message' => 'Produit mis a jour',
            'product' => $product->load(['category:id,title', 'suppliers:id,name', 'photos:id,product_id,path,sort_order', 'unit:id,name,code']),
        ]);
    }

    /**
     * Reactivate a product without requiring the full update payload.
     */
    public function activate(int $id)
    {
        $product = Product::findOrFail($id);
        $product->status = 'active';
        $product->save();

        return response()->json([
            'message' => 'Produit reactive',
            'product' => $product->fresh(),
        ]);
    }

    public function destroy(int $id)
    {
        $product = Product::findOrFail($id);

        if ($product->photo && Storage::disk('public')->exists($product->photo)) {
            Storage::disk('public')->delete($product->photo);
        }

        $product->delete();

        return response()->json(['message' => 'Produit supprime']);
    }

    public function downloadBarcode(int $id)
    {
        $product = Product::findOrFail($id);
        $value = $product->barcode_value ?: $this->buildBarcodeValue($product->reference, $product->id);

        if (!$product->barcode_value) {
            $product->barcode_value = $value;
            $product->save();
        }

        $svg = $this->generateBarcodeSvg($value);

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Content-Disposition' => 'attachment; filename="barcode-' . $product->id . '.svg"',
        ]);
    }

    private function buildBarcodeValue(string $reference, int $id): string
    {
        $normalizedRef = preg_replace('/[^A-Za-z0-9-]/', '', strtoupper($reference)) ?: 'REF';
        return 'PRD-' . $id . '-' . $normalizedRef;
    }

    private function generateBarcodeSvg(string $value): string
    {
        $cleanValue = preg_replace('/[^A-Za-z0-9\-]/', '', strtoupper($value)) ?: 'PRD-000';

        $x = 20;
        $y = 20;
        $height = 80;
        $bars = '';

        foreach (str_split($cleanValue) as $char) {
            $ascii = ord($char);

            for ($bit = 0; $bit < 7; $bit++) {
                $isDark = (($ascii >> $bit) & 1) === 1;

                if ($isDark) {
                    $bars .= '<rect x="' . $x . '" y="' . $y . '" width="2" height="' . $height . '" fill="#000" />';
                    $x += 3;
                } else {
                    $x += 2;
                }
            }

            $x += 2;
        }

        $width = max(260, $x + 20);

        return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $width . '" height="140" viewBox="0 0 ' . $width . ' 140">'
            . '<rect width="100%" height="100%" fill="#fff" />'
            . $bars
            . '<text x="20" y="125" font-size="14" font-family="Arial, sans-serif" fill="#111">' . htmlspecialchars($cleanValue, ENT_QUOTES, 'UTF-8') . '</text>'
            . '</svg>';
    }

    /**
     * Return list of distinct fabricants (manufacturers) from products.
     */
    public function manufacturers()
    {
        $list = Product::query()
            ->where('status', 'active')
            ->whereNotNull('fabricant')
            ->where('fabricant', '!=', '')
            ->distinct()
            ->pluck('fabricant')
            ->values();

        return response()->json($list);
    }

    /**
     * Return list of distinct marques (brands), optionally filtered by fabricant.
     */
    public function brands(Request $request)
    {
        $fabricant = $request->get('fabricant');

        $q = Product::query()
            ->where('status', 'active')
            ->whereNotNull('marque')
            ->where('marque', '!=', '');

        if (!empty($fabricant)) {
            $q->where('fabricant', $fabricant);
        }

        $list = $q->distinct()->pluck('marque')->values();

        return response()->json($list);
    }

    /**
     * Return list of distinct models, optionally filtered by fabricant and marque.
     */
    public function models(Request $request)
    {
        $fabricant = $request->get('fabricant');
        $marque = $request->get('marque');

        $q = Product::query()
            ->where('status', 'active')
            ->whereNotNull('model')
            ->where('model', '!=', '');

        if (!empty($fabricant)) {
            $q->where('fabricant', $fabricant);
        }
        if (!empty($marque)) {
            $q->where('marque', $marque);
        }

        $list = $q->distinct()->pluck('model')->values();

        return response()->json($list);
    }

    /**
     * Generate short and full descriptions for a product title.
     * This is a simple local generator; replace with an external AI service if desired.
     */
    public function generateDescriptions(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'fabricant' => 'nullable|string|max:255',
            'marque' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $title = trim($request->get('title'));
        $fabricant = trim((string)$request->get('fabricant', ''));
        $marque = trim((string)$request->get('marque', ''));
        $model = trim((string)$request->get('model', ''));

        // Build a slightly more developed short description (1-2 sentences)
        $parts = [];
        $main = $title;
        if ($marque) $main .= ' — ' . $marque;
        if ($model) $main .= ' ' . $model;
        if ($fabricant) $main .= ' (' . $fabricant . ')';

        $sentence1 = $main . '.';
        $sentence2 = 'Idéal pour un usage professionnel, il offre robustesse et une prise en main simple.';

        $short = $sentence1 . ' ' . $sentence2;

        $description = "Le produit \"" . $title . "\"";
        if ($fabricant) {
            $description .= " fabriqué par " . $fabricant . ",";
        }
        if ($marque) {
            $description .= " de la marque " . $marque . ",";
        }
        if ($model) {
            $description .= " modèle " . $model . ".";
        }
        $description .= " Ce produit est conçu pour répondre aux besoins de vos opérations de stock: robustesse, facilité d'utilisation et maintenance réduite. Il convient pour une utilisation en environnement professionnel et peut être stocké facilement. Personnalisez la description selon les spécifications techniques si nécessaire.";

        return response()->json([
            'short_description' => $short,
            'description' => $description,
        ]);
    }
}
