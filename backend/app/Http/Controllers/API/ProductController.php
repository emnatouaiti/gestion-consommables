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
        ]);

        // Filtrage par dépôt pour les responsables/agents
        $user = auth()->user();
        if ($user && ($user->role === 'responsable' || $user->role === 'agent') && $user->depot_id) {
            // Note: Since warehouse_location_id is removed from products,
            // we should probably filter products based on product_stocks.
            // But for now, let's just remove the broken query.
        }
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
            'unit_id' => 'nullable|exists:units,id',
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
            'unit_id' => 'nullable|exists:units,id',
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

        $product->update($data);

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


    /**
     * Generate short and full descriptions for a product title.
     * This is a simple local generator; replace with an external AI service if desired.
     */
    public function generateDescriptions(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'marque' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $title = trim($request->get('title'));
        $marque = trim((string)$request->get('marque', ''));
        $model = trim((string)$request->get('model', ''));
        $categoryId = $request->get('categorie_id');

        $apiKey = config('services.gemini.key');
        
        if ($apiKey) {
            \Illuminate\Support\Facades\Log::info("Attempting Gemini AI generation for: {$title}");
            try {
                $prompt = "Génère une description courte (environ 150 caractères) et une description longue et détaillée (environ 500-1000 caractères) RÉDIGÉES EXCLUSIVEMENT EN FRANÇAIS pour le produit suivant : \n";
                $prompt .= "Titre: {$title}\n";
                if ($marque) $prompt .= "Marque: {$marque}\n";
                if ($model) $prompt .= "Modèle: {$model}\n";
                $prompt .= "\nInstructions :\n";
                $prompt .= "1. Le ton doit être professionnel et technique.\n";
                $prompt .= "2. Décris l'utilité, les caractéristiques et les avantages du produit.\n";
                $prompt .= "3. Réponds UNIQUEMENT au format JSON brut suivant (pas de texte avant ou après) :\n";
                $prompt .= "{\"short_description\": \"...\", \"description\": \"...\"}";

                $response = \Illuminate\Support\Facades\Http::post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={$apiKey}", [
                    'contents' => [
                        [
                            'parts' => [
                                ['text' => $prompt]
                            ]
                        ]
                    ],
                    'generationConfig' => [
                        'temperature' => 0.7,
                        'topK' => 40,
                        'topP' => 0.95,
                        'maxOutputTokens' => 2048,
                        'responseMimeType' => 'application/json',
                    ]
                ]);

                if ($response->successful()) {
                    $result = $response->json();
                    $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';
                    \Illuminate\Support\Facades\Log::info("Gemini Raw Text: " . $text);
                    
                    // Clean potential markdown
                    $text = preg_replace('/```json\s*|\s*```/', '', $text);
                    $aiData = json_decode($text, true);

                    if ($aiData && isset($aiData['short_description']) && isset($aiData['description'])) {
                        \Illuminate\Support\Facades\Log::info("Gemini AI generation successful");
                        return response()->json($aiData);
                    } else {
                        \Illuminate\Support\Facades\Log::error("Gemini AI returned invalid JSON format: " . $text);
                    }
                } else {
                    \Illuminate\Support\Facades\Log::error("Gemini API failed with status {$response->status()}: " . $response->body());
                }
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Gemini Exception: " . $e->getMessage());
            }
        } else {
            \Illuminate\Support\Facades\Log::warning("Gemini API Key missing in config/services.php");
        }

        // --- FALLBACK LOGIC ---
        $categoryName = '';
        if ($categoryId) {
            $categoryName = \App\Models\Category::find($categoryId)?->title ?: '';
        }

        $short = "{$title}";
        if ($marque) $short .= " ({$marque})";
        if ($categoryName) $short .= " - Catégorie: {$categoryName}";
        $short .= ". Consommable fiable pour usage intensif.";

        $description = "Le produit \"{$title}\"";
        if ($marque) $description .= " sous la marque {$marque}";
        if ($model) $description .= " (Modèle: {$model})";
        
        $description .= " est une solution de haute qualité";
        if ($categoryName) $description .= " dans la gamme des {$categoryName}";
        
        $description .= ". Ce consommable a été sélectionné pour sa performance constante et sa durabilité. ";
        $description .= "Il s'intègre parfaitement dans vos processus opérationnels quotidiens, garantissant une efficacité optimale et une gestion simplifiée de votre stock.";
        
        if ($categoryName == 'Informatique' || $categoryName == 'Bureautique') {
            $description .= " Compatible avec les standards du secteur, il répond aux exigences techniques les plus strictes.";
        }

        return response()->json([
            'short_description' => $short,
            'description' => $description,
        ]);
    }
    /**
     * Return the full stock movement history for a specific product.
     */
    public function history(int $id)
    {
        $product = Product::findOrFail($id);

        $limit = request()->get('per_page', 10);

        $query = \App\Models\StockMovementLine::with([
            'movement' => function ($q) {
                $q->with([
                    'creator:id,nomprenom',
                    'validator:id,nomprenom',
                    'sourceWarehouseLocation:id,name,code',
                    'destinationWarehouseLocation:id,name,code',
                    'sourceCabinet:id,name',
                    'destinationCabinet:id,name',
                    'document',
                    'relatedRequest'
                ]);
            }
        ])
        ->where('product_id', $id);

        if (request()->filled('date_start')) {
            $query->whereDate('created_at', '>=', request()->date_start);
        }
        if (request()->filled('date_end')) {
            $query->whereDate('created_at', '<=', request()->date_end);
        }

        $history = $query->orderBy('created_at', 'desc')
            ->paginate($limit);

        return response()->json($history);
    }
}
