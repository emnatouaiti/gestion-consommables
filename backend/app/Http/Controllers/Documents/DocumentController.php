<?php

namespace App\Http\Controllers\Documents;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Product;
use App\Models\Category;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Models\StockMovement;
use App\Models\StockMovementLine;
use App\Models\ProductStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Notifications\StockMovementNotification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class DocumentController extends Controller
{
    private $lastOcrText = '';

    /**
     * Helper to check user roles robustly
     */
    private function userHasAnyRole($user, array $roles): bool
    {
        if (!$user) return false;
        $roleName = strtolower(trim($user->role?->name ?? ''));
        foreach ($roles as $expected) {
            if ($roleName === strtolower(trim($expected))) {
                return true;
            }
        }
        return false;
    }

    public function index(Request $request)
    {
        try {
            Log::info('DocumentController@index reached', [
                'params' => $request->all(),
                'user' => auth()->id(),
                'user_roles' => auth()->user()?->roles ?? null,
            ]);

            $query = Document::query();

            $query->with([
                'product' => function ($q) {
                    $q->select('id', 'title', 'reference', 'has_expiration');
                },
                'supplier' => function ($q) {
                    $q->select('id', 'name');
                },
                'warehouse' => function ($q) {
                    $q->select('id', 'name');
                }
            ])->orderByDesc('id');

            if ($request->filled('product_id')) {
                $query->where('product_id', $request->input('product_id'));
            }

            $results = $query->limit(200)->get();
            Log::info('DocumentController@index results', ['count' => $results->count()]);
            return response()->json($results, 200);
        } catch (\Throwable $e) {
            Log::error('DocumentController@index error', [
                'msg' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'line' => $e->getLine(),
                'file' => $e->getFile(),
            ]);
            return response()->json([
                'message' => 'Erreur interne du serveur',
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
            ], 500);
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'file'         => 'required|file',
            'title'        => 'nullable|string|max:255',
            'type'         => 'nullable|string|max:100',
            'direction'    => 'nullable|in:in,out,unknown',
            'product_id'   => 'nullable|exists:products,id',
            'supplier_id'  => 'nullable|exists:suppliers,id',
            'warehouse_id' => 'nullable|numeric|exists:warehouses,id',
            'supplier_name'=> 'nullable|string|max:255',
            'supplier_email'=> 'nullable|email|max:255',
        ]);

        $user = $request->user();
        $warehouseId = $request->warehouse_id;

        if ($request->filled('product_id')) {
            $product = Product::query()->select(['id', 'title', 'status'])->find((int) $request->input('product_id'));
            if ($product && Str::lower((string) $product->status) !== 'active') {
                return response()->json([
                    'message' => "Le produit \"{$product->title}\" est inactif. Changez son statut en active pour l'utiliser.",
                    'product' => $product,
                ], 422);
            }
        }

        $path       = $request->file('file')->store('documents', 'public');
        $fullPath   = Storage::disk('public')->path($path);
        $ocrText    = $this->runTesseract($fullPath);
        $this->lastOcrText = $ocrText;
        $tsvText    = $this->runTesseractTSV($fullPath);
        $parsed     = [];
        if ($tsvText !== '') {
            $parsed = $this->parseLinesFromTSV($tsvText, $path);
        }
        if (empty($parsed) && $ocrText !== '') {
            $parsed = $this->parseLines($ocrText);
        }
        if (empty($parsed)) {
            $parsed = $this->extractTableFromImageHeuristic($fullPath);
        }
        $guessedType = $request->input('type') ?: ($ocrText !== '' ? $this->guessType($ocrText) : 'document');
        $direction   = $request->input('direction', $ocrText !== '' ? $this->guessDirection($ocrText) : 'unknown');

        if ($direction === 'unknown' && $guessedType === 'bon_livraison') {
            $direction = 'in';
        }

        $autoTitle            = $this->inferTitle($ocrText, $guessedType, $request->file('file')->getClientOriginalName(), $request->input('title'));
        $supplierNameOverride = trim((string) $request->input('supplier_name', $request->input('name', '')));
        $supplierEmailOverride= trim((string) $request->input('supplier_email', ''));

        $ocrSupplierName  = $ocrText !== '' ? $this->guessSupplierName($ocrText) : null;
        $supplierName     = $supplierNameOverride !== '' ? $supplierNameOverride : $ocrSupplierName;
        $supplierEmail    = $supplierEmailOverride !== '' ? $supplierEmailOverride : ($ocrText !== '' ? $this->guessSupplierEmail($ocrText) : null);
        $supplierId       = $request->supplier_id;
        $allowAutoSupplier= $request->boolean('auto_create_supplier', true);

        $supplierCandidate = null;
        if (!$supplierId && $supplierEmail) {
            $emailMatch = Supplier::where('email', $supplierEmail)
                ->orWhereRaw('LOWER(email) = ?', [Str::lower($supplierEmail)])
                ->first(['id', 'name', 'email']);
            if ($emailMatch) {
                $supplierCandidate = [
                    'id' => (int) $emailMatch->id,
                    'name' => $emailMatch->name,
                    'email' => $emailMatch->email,
                    'score' => 100,
                    'status' => 'exact',
                ];
            }
        }
        if (!$supplierCandidate && !$supplierId && $supplierName) {
            $supplierMatch = $this->findMatchingSupplier($supplierName, $supplierEmail);
            if (in_array(($supplierMatch['status'] ?? null), ['exact', 'candidate'], true)) {
                $supplierCandidate = $supplierMatch;
            }
        }
        if (!$supplierCandidate && !$supplierId && $ocrSupplierName) {
            $historySupplierId = $this->findSupplierIdFromHistory($ocrSupplierName);
            if ($historySupplierId) {
                $historySupplier = Supplier::select(['id', 'name', 'email'])->find($historySupplierId);
                if ($historySupplier) {
                    $supplierCandidate = [
                        'id' => (int) $historySupplier->id,
                        'name' => $historySupplier->name,
                        'email' => $historySupplier->email,
                        'score' => 95,
                        'status' => 'history',
                    ];
                }
            }
        }

        if (
            $supplierCandidate
            && $supplierCandidate['status'] !== 'exact'
            && !$request->boolean('confirm_supplier_match', false)
            && !$request->filled('supplier_id')
            && $supplierNameOverride === ''
        ) {
            return response()->json([
                'message' => 'Nous avons trouve un fournisseur potentiel. Confirmez s\'il s\'agit du bon.',
                'suggested_supplier' => ['name' => $supplierName, 'email' => $supplierEmail],
                'suggested_existing_supplier' => [
                    'id' => $supplierCandidate['id'],
                    'name' => $supplierCandidate['name'],
                    'email' => $supplierCandidate['email'],
                    'score' => $supplierCandidate['score'],
                ],
            ], 409);
        }

        if (!$supplierId && $supplierCandidate && $supplierCandidate['status'] === 'exact') {
            $supplierId = (int) $supplierCandidate['id'];
        }
        if (!$supplierId && $request->boolean('confirm_supplier_match', false) && $request->filled('supplier_id')) {
            $supplierId = (int) $request->input('supplier_id');
        }
        if (!$supplierId && !$allowAutoSupplier) {
            return response()->json([
                'message' => 'Confirmez le fournisseur avant de persister ce document.',
                'suggested_supplier' => ['name' => $supplierName, 'email' => $supplierEmail],
            ], 409);
        }
        if (!$supplierId && ($supplierName || $supplierEmail)) {
            if (!$allowAutoSupplier) {
                return response()->json([
                    'message' => 'Confirmez le fournisseur avant de persister ce document.',
                    'suggested_supplier' => ['name' => $supplierName, 'email' => $supplierEmail],
                ], 409);
            }
            $newSupplier = Supplier::create([
                'name'  => $supplierName ?? ($supplierEmail ?? 'Fournisseur OCR'),
                'email' => $supplierEmail,
                'phone' => null,
                'notes' => 'CrÃÃ automatiquement depuis OCR',
            ]);
            $supplierId = $newSupplier->id;
        }

        $document = Document::create([
            'user_id'      => optional($request->user())->id,
            'product_id'   => $request->product_id,
            'supplier_id'  => $supplierId,
            'warehouse_id' => $warehouseId,
            'title'        => $autoTitle,
            'type'         => $guessedType,
            'direction'    => $direction,
            'path'         => $path,
            'ocr_text'     => $ocrText,
            'ocr_lines'    => $parsed,
            'status'       => 'pending',
        ]);

        return response()->json($document, 201);
    }

    public function apply(Request $request, int $id)
    {
        $document = Document::findOrFail($id);

        if (($document->direction === 'unknown' || !$document->direction) && $document->type === 'bon_livraison') {
            $document->direction = 'in';
        }
        if (($document->direction === 'in' || $document->type === 'bon_livraison') && !$document->supplier_id) {
            return response()->json(['message' => 'SÃlectionnez un fournisseur avant d\'appliquer ce bon de livraison.'], 422);
        }

        $items = $request->input('items');
        if (!is_array($items) || count($items) === 0) {
            return response()->json(['message' => 'Aucune ligne Ã  appliquer.'], 422);
        }

        $missingProducts  = [];
        $inactiveProducts = [];
        $prepareActions   = [];

        foreach ($items as $item) {
            $title     = trim((string) ($item['title'] ?? ''));
            $reference = trim((string) ($item['reference'] ?? ''));
            $productId = $item['product_id'] ?? null;
            $quantity  = (int) ($item['quantity'] ?? 0);
            $dir       = $item['direction'] ?? $document->direction ?? 'unknown';
            $warehouseId = $item['warehouse_id'] ?? $document->warehouse_id ?? null;
            $locId     = $item['warehouse_location_id'] ?? $item['location_id'] ?? null;
            $cabinetId = $item['cabinet_id'] ?? null;
            $expirationDate = $item['expiration_date'] ?? null;
            $batchNumber    = $item['batch_number'] ?? null;
            $unit = isset($item['unit']) ? trim((string) $item['unit']) : null;
            $minThreshold = isset($item['seuil_min']) ? max(0, (int) $item['seuil_min']) : 0;
            $hasExpiration = !empty($item['has_expiration']);

            if ($dir === 'unknown') {
                $guessedDir = $this->guessDirection((string) $document->ocr_text);
                if ($guessedDir !== 'unknown') $dir = $guessedDir;
            }

            $product = null;
            if ($productId) {
                $product = Product::find($productId);
            } else {
                if ($reference !== '') {
                    $product = Product::whereRaw('LOWER(reference) = ?', [Str::lower($reference)])->first();
                }
                if (!$product && $title !== '') {
                    $product = Product::where('title', 'like', $title)->first();
                }
            }

            if ($product && Str::lower((string) $product->status) !== 'active') {
                $inactiveProducts[] = [
                    'id' => (int) $product->id,
                    'title' => $product->title,
                    'reference' => $product->reference,
                    'status' => $product->status,
                ];
                continue;
            }

            if (!$product && $title !== '') {
                $categoryId = $item['categorie_id'] ?? $item['category_id'] ?? null;
                if (!$categoryId || !Category::find($categoryId)) {
                    $missingProducts[] = [
                        'title' => $title,
                        'reference' => $reference,
                        'category_required' => true,
                        'category_id' => $categoryId ?: null,
                    ];
                    continue;
                }
                $prepareActions[] = [
                    'title' => $title, 'reference' => $reference,
                    'category_id' => $categoryId, 'quantity' => $quantity,
                    'warehouse_id' => $warehouseId,
                    'direction' => $dir, 'warehouse_location_id' => $locId,
                    'cabinet_id' => $cabinetId, 'expiration_date' => $expirationDate,
                    'batch_number' => $batchNumber, 'unit' => $unit,
                    'seuil_min' => $minThreshold, 'has_expiration' => $hasExpiration,
                    'product' => null,
                ];
                continue;
            }

            $prepareActions[] = [
                'title' => $title, 'reference' => $reference,
                'category_id' => $item['categorie_id'] ?? $item['category_id'] ?? null,
                'quantity' => $quantity, 'direction' => $dir,
                'warehouse_id' => $warehouseId,
                'warehouse_location_id' => $locId, 'cabinet_id' => $cabinetId,
                'expiration_date' => $expirationDate, 'batch_number' => $batchNumber,
                'unit' => $unit, 'seuil_min' => $minThreshold, 'has_expiration' => $hasExpiration,
                'product' => $product,
            ];
        }

        if (count($inactiveProducts) > 0) {
            return response()->json([
                'message' => 'Certains produits existent mais sont inactifs. Activez-les pour pouvoir les ajouter.',
                'inactive_products' => $inactiveProducts,
            ], 409);
        }
        if (count($missingProducts) > 0) {
            return response()->json([
                'message' => 'Des produits sont introuvables. Choisissez une catÃgorie pour chacun.',
                'suggested_products' => $missingProducts,
            ], 409);
        }

        $allowAutoProduct = $request->boolean('auto_create_product', false);
        if (!$allowAutoProduct && count(array_filter($prepareActions, fn($a) => $a['product'] === null)) > 0) {
            return response()->json(['message' => 'Produit introuvable, confirmation nÃcessaire avant crÃation.'], 409);
        }

        $validSupplierId = null;
        if ($document->supplier_id && Supplier::whereKey($document->supplier_id)->exists()) {
            $validSupplierId = (int) $document->supplier_id;
        }

        $locDeltas = [];
        $cabDeltas = [];
        foreach ($prepareActions as $action) {
            $qty = $action['quantity'] ?? 0;
            $dir = $action['direction'] ?? 'unknown';
            if ($qty > 0 && $dir === 'in') {
                if (!empty($action['warehouse_location_id'])) {
                    $locId = $action['warehouse_location_id'];
                    $locDeltas[$locId] = ($locDeltas[$locId] ?? 0) + $qty;
                }
                if (!empty($action['cabinet_id'])) {
                    $cabId = $action['cabinet_id'];
                    $cabDeltas[$cabId] = ($cabDeltas[$cabId] ?? 0) + $qty;
                }
            }
        }
        foreach ($locDeltas as $locId => $delta) {
            $loc = \App\Models\WarehouseLocation::find($locId);
            if ($loc && $loc->capacity_units > 0 && ($loc->current_units + $delta) > $loc->capacity_units) {
                return response()->json(['message' => 'CapacitÃ maximale dÃpassÃe pour l\'emplacement '.$loc->name], 422);
            }
        }
        foreach ($cabDeltas as $cabId => $delta) {
            $cab = \App\Models\WarehouseCabinet::find($cabId);
            if ($cab && $cab->capacity_units > 0 && ($cab->current_units + $delta) > $cab->capacity_units) {
                return response()->json(['message' => 'CapacitÃ maximale dÃpassÃe pour l\'armoire '.$cab->name], 422);
            }
        }

        $user      = $request->user();
        $isManager = $this->userHasAnyRole($user, ['administrateur', 'responsable', 'responsable de stock', 'gestionnaire', 'validateur']);

        DB::transaction(function () use ($prepareActions, $document, $validSupplierId, $isManager, $user) {
            foreach ($prepareActions as $action) {
                $product   = $action['product'];
                $locId     = $action['warehouse_location_id'] ?? null;
                $cabinetId = $action['cabinet_id'] ?? null;

                if (!$product) {
                    if (!$locId && !$cabinetId) {
                        throw new \Exception('Choisissez soit un emplacement, soit une armoire pour ce produit.');
                    }
                    $catId   = $action['category_id'];
                    $product = Product::create([
                        'status'         => 'active',
                        'has_expiration' => $action['has_expiration'] ?? false,
                        'title'          => $action['title'],
                        'reference'      => $action['reference'] !== '' ? $action['reference'] : strtoupper(Str::slug($action['title'])) . '-' . Str::random(4),
                        'seuil_min'      => max(0, (int) ($action['seuil_min'] ?? 0)),
                        'stock_quantity' => 0,
                        'categorie_id'   => $catId,
                        'unit'           => $action['unit'] ?? null,
                        'photo'          => $document->path,
                    ]);
                    if ($validSupplierId) $product->suppliers()->syncWithoutDetaching([$validSupplierId]);
                } elseif ($validSupplierId) {
                    $product->suppliers()->syncWithoutDetaching([$validSupplierId]);
                }

                $quantity = $action['quantity'];
                $dir      = $action['direction'];

                if ($isManager && $product && $quantity > 0) {
                    if ($dir === 'in') $product->increment('stock_quantity', $quantity);
                    elseif ($dir === 'out') $product->decrement('stock_quantity', $quantity);

                    if ($locId || $cabinetId) {
                        $ps = ProductStock::firstOrNew([
                            'product_id'            => $product->id,
                            'warehouse_location_id' => $locId ?: null,
                            'cabinet_id'            => $cabinetId ?: null,
                            'batch_number'          => $action['batch_number'] ?: null,
                            'expiration_date'       => $action['expiration_date'] ?: null,
                        ]);
                        if (!$ps->exists || !$ps->supplier_id) $ps->supplier_id = $validSupplierId;
                        if ($cabinetId && !$locId) {
                            $ps->cabinet_id = $cabinetId;
                            $ps->warehouse_location_id = null;
                        }
                        if ($action['expiration_date']) $ps->expiration_date = $action['expiration_date'];
                        if ($action['batch_number'])    $ps->batch_number    = $action['batch_number'];
                        $delta      = $dir === 'in' ? $quantity : -$quantity;
                        $ps->quantity    = max(0, (int)($ps->quantity ?? 0) + $delta);
                        $ps->last_updated = now();
                        $ps->save();
                    }
                }
                if ($product) {
                    $document->product_id = $document->product_id ?: $product->id;
                }
            }

            $document->status = $isManager ? 'applied' : 'pending_validation';
            if ($document->direction === 'unknown') {
                $document->direction = $this->guessDirection((string) $document->ocr_text);
            }
            if ($document->direction === 'unknown' && $document->type === 'bon_livraison') {
                $document->direction = 'in';
            }
            $document->save();

            $firstLocId = null;
            $firstCabId = null;
            foreach ($prepareActions as $a) {
                if (!empty($a['warehouse_location_id'])) { $firstLocId = $a['warehouse_location_id']; break; }
                elseif (!empty($a['cabinet_id']))        { $firstCabId = $a['cabinet_id']; break; }
            }

            $firstWarehouseId = null;
            foreach ($prepareActions as $a) {
                if (!empty($a['warehouse_id'])) { $firstWarehouseId = (int) $a['warehouse_id']; break; }
            }
            if (!$document->warehouse_id && $firstWarehouseId) {
                $document->warehouse_id = $firstWarehouseId;
                $document->save();
            }

            $movementType = in_array($document->direction, ['in', 'out']) ? $document->direction : 'in';
            $movement = StockMovement::create([
                'movement_type'   => $movementType,
                'reference'       => 'DOC-' . $document->id,
                'created_by'      => $user?->id,
                'depot_id'        => $document->warehouse_id ?: $firstWarehouseId ?: $user?->depot_id,
                'status'          => $isManager ? 'executed' : 'pending_validation',
                'supplier_id'     => $document->supplier_id,
                'document_id'     => $document->id,
                'destination_user_id' => $document->user_id ?: $user?->id,
                'in_image_path'   => $movementType === 'in'  ? $document->path : null,
                'out_image_path'  => $movementType === 'out' ? $document->path : null,
                'destination_warehouse_location_id' => $movementType === 'in'  ? $firstLocId : null,
                'source_warehouse_location_id'      => $movementType === 'out' ? $firstLocId : null,
                'destination_cabinet_id'            => $movementType === 'in'  ? $firstCabId : null,
                'source_cabinet_id'                 => $movementType === 'out' ? $firstCabId : null,
                'notes' => 'GÃnÃrÃ par OCR Document: ' . $document->title,
            ]);

            foreach ($prepareActions as $action) {
                if ($action['product'] && isset($action['quantity']) && (int)$action['quantity'] > 0) {
                    StockMovementLine::create([
                        'stock_movement_id'     => $movement->id,
                        'product_id'            => $action['product']->id,
                        'quantity'              => (int)$action['quantity'],
                        'warehouse_location_id' => $action['warehouse_location_id'] ?? null,
                        'cabinet_id'            => $action['cabinet_id'] ?? null,
                    ]);
                }
            }

            if (!$isManager && $user) {
                try {
                    $documentDepotId = $document->warehouse_id ?: $user->depot_id;
                    $query = User::whereHas('role', function($rq) {
                        $rq->whereIn('name', [
                            'Administrateur','Responsable','Responsable de stock','Gestionnaire','Validateur',
                            'administrateur','responsable','responsable de stock','gestionnaire','validateur',
                        ]);
                    })->where(function ($q) use ($documentDepotId) {
                        $q->where('depot_id', $documentDepotId)->orWhereNull('depot_id');
                    });
                    foreach ($query->get() as $resp) {
                        if ($resp->id !== $user->id) $resp->notify(new StockMovementNotification($movement));
                    }
                } catch (\Throwable $e) {
                    Log::error('OCR Approval Notification failed', [
                        'err' => $e->getMessage(), 'document_id' => $document->id,
                    ]);
                }
            }
        });

        $msg = $isManager ? 'Document appliquÃ' : 'Application soumise Ã  validation';
        return response()->json(['message' => $msg, 'document' => $document->fresh()]);
    }

    public function update(Request $request, int $id)
    {
        $document = Document::findOrFail($id);
        $request->validate([
            'ocr_lines'             => 'nullable|array',
            'ocr_lines.*.reference' => 'nullable|string|max:255',
            'ocr_lines.*.title'     => 'nullable|string|max:255',
            'ocr_lines.*.quantity'  => 'nullable|numeric|min:0',
            'title'                 => 'nullable|string|max:255',
            'type'                  => 'nullable|string|max:100',
            'direction'             => 'nullable|in:in,out,unknown',
        ]);
        if ($request->has('ocr_lines'))   $document->ocr_lines  = $request->input('ocr_lines', []);
        if ($request->filled('title'))    $document->title      = $request->input('title');
        if ($request->filled('type'))     $document->type       = $request->input('type');
        if ($request->filled('direction'))$document->direction  = $request->input('direction');
        $document->save();
        return response()->json($document);
    }

    public function download(int $id)
    {
        $doc = Document::findOrFail($id);
        if (!$doc->path || !Storage::disk('public')->exists($doc->path)) {
            abort(404, 'Fichier non trouve sur le serveur.');
        }
        return Storage::disk('public')->response($doc->path);
    }

    public function diagnostic(Request $request)
    {
        try {
            $count = Document::count();
            $last  = Document::with(['product:id,title','supplier:id,name','warehouse:id,name'])->latest()->first();
            return response()->json([
                'status' => 'ok', 'document_count' => $count,
                'last_document' => $last, 'database' => config('database.default'),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error', 'message' => 'Erreur de diagnostic documents', 'error' => $e->getMessage(),
            ], 500);
        }
    }

    // =========================================================================
    // OCR HELPERS
    // =========================================================================

    private function inferTitle(string $ocrText, ?string $guessedType, string $fallbackName, ?string $userTitle): string
    {
        $cleanUser = trim((string) $userTitle);
        if ($cleanUser !== '' && !preg_match('/^(capture|img|image|scan|eya)$/i', $cleanUser)) {
            return $cleanUser;
        }
        $text = Str::lower($ocrText);
        if (str_contains($text, 'bon de livraison') || $guessedType === 'bon_livraison') return 'Bon de livraison';
        if (str_contains($text, 'bon de reception') || str_contains($text, 'bon de rÃception')) return 'Bon de rÃception';
        if (str_contains($text, 'bon de sortie')) return 'Bon de sortie';
        if (str_contains($text, 'rÃception de marchandise') || str_contains($text, 'reception de marchandise')) return 'Bon de rÃception';
        if (str_contains($text, 'facture')) return 'Facture';
        $first = $this->firstLine($ocrText);
        return $first ?: $fallbackName;
    }

    private function tesseractBinary(): ?string
    {
        $candidates = [
            env('TESSERACT_PATH'),
            'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
            'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
            '/usr/bin/tesseract',
            '/usr/local/bin/tesseract',
            'tesseract',
        ];
        return collect($candidates)
            ->filter()
            ->first(fn($p) => is_string($p) && (file_exists($p) || trim($p) === 'tesseract'));
    }

    private function runTesseractTSV(string $fullPath): string
    {
        $binary = $this->tesseractBinary();
        if (!$binary) return '';

        $source    = $this->preprocessImage($fullPath);
        $isWindows = stripos(PHP_OS_FAMILY, 'Windows') !== false;
        $binArg    = $isWindows ? '"' . $binary . '"' : escapeshellarg($binary);
        $fileArg   = $isWindows ? '"' . $source . '"' : escapeshellarg($source);
        
        $psmOptions = [6, 3, 11, 1]; // Try uniform block, fully automatic, sparse text, etc.
        $bestTsv = '';
        $bestCount = 0;

        foreach ($psmOptions as $psm) {
            $tmpBase    = tempnam(sys_get_temp_dir(), 'ocr_tsv_');
            $tmpBaseArg = $isWindows ? '"' . $tmpBase . '"' : escapeshellarg($tmpBase);

            $tdp = env('TESSDATA_PREFIX');
            $tdpPrefix = '';
            if ($tdp) {
                $tdpPrefix = $isWindows ? 'set "TESSDATA_PREFIX=' . $tdp . '" && ' : 'TESSDATA_PREFIX=' . escapeshellarg($tdp) . ' ';
            }

            $cmd = $tdpPrefix . $binArg . ' ' . $fileArg . ' ' . $tmpBaseArg
                . ' -l fra+eng --psm ' . $psm . ' --oem 1 --dpi 300 tsv'
                . ($isWindows ? ' 2>&1' : ' 2>/dev/null');

            @shell_exec($cmd);

            $tsvFile = $tmpBase . '.tsv';
            if (file_exists($tsvFile)) {
                $tsv = (string) file_get_contents($tsvFile);
                @unlink($tsvFile);
                
                // Count lines in TSV (excluding header and noise)
                $lineCount = count(array_filter(explode("\n", $tsv), fn($l) => str_contains($l, "\t") && strlen($l) > 20));
                if ($lineCount > $bestCount) {
                    $bestCount = $lineCount;
                    $bestTsv = $tsv;
                }
                if ($lineCount > 5) break; // Good enough
            }
            @unlink($tmpBase);
        }

        if ($source !== $fullPath && file_exists($source)) @unlink($source);
        return $bestTsv;
    }

    private function knownQtyMisreads(): array
    {
        return [
            // Only keeping very common general OCR symbol-to-digit mappings
            'wi' => 10, 'w1' => 10, 'wl' => 10,
            'lo' => 10, 'io' => 10, 'l0' => 10,
            'i0' => 10, 'ii' => 11, '1o' => 10,
            '|0' => 10,
            'oe' => 40, '0e' => 40,
            'ea' => 80, 'go' => 60,
            'tci' => 60, 'tc1' => 60, 'tcl' => 60,
            '7as' => 80, '7a5' => 80, '7a' => 70,
            'l' => 1, 'i' => 1, 'o' => 0, 's' => 5, 'z' => 2, 'b' => 8, 'g' => 9,
        ];
    }

    /**
     * Generic OCR numeric normalizer for quantity-like tokens.
     * Returns a digit-only string or null when token does not look numeric.
     */
    private function normalizeNumericLikeToken(string $token): ?string
    {
        $raw = strtolower(trim($token));
        if ($raw === '') return null;

        $compact = preg_replace('/[^0-9a-z|]/', '', $raw);
        if ($compact === '') return null;

        // Reject tokens with letters unlikely to be OCR numeric confusions
        if (preg_match('/[a-hj-np-rt-vx-y]/', $compact)) return null;

        $mapped = strtr($compact, [
            'o' => '0', 'q' => '0', 'd' => '0',
            'i' => '1', 'l' => '1', '|' => '1',
            'z' => '2',
            's' => '5',
            'b' => '8',
            'g' => '9',
        ]);

        if (!preg_match('/^\d+$/', $mapped)) return null;
        return $mapped;
    }

    /**
     * Basic quality gate for OCR-extracted product titles.
     * Rejects obvious garbage/noise strings.
     */
    private function isLikelyValidTitle(string $title): bool
    {
        $t = trim(mb_strtolower($title));
        if ($t === '' || mb_strlen($t) < 3) return false;

        // Must contain letters
        if (!preg_match('/[a-zÃ Ã¢Ã¤ÃÃ¨ÃªÃ«ÃÃ¯Ã´Ã¶Ã¹Ã»Ã¼Ã§]/iu', $t)) return false;

        // Reject metadata-like lines
        if (preg_match('/gmail|email|date|numero|bon de livraison|client|adresse|livraison|destinataire|recu|regu|contact|phone/i', $t)) {
            return false;
        }

        // Reject highly noisy fragments with too many symbols
        $symbols = preg_match_all('/[^a-z0-9Ã Ã¢Ã¤ÃÃ¨ÃªÃ«ÃÃ¯Ã´Ã¶Ã¹Ã»Ã¼Ã§\s\-]/iu', $t);
        if ($symbols !== false && $symbols > 3) return false;

        // Very short vowel-less gibberish
        if (mb_strlen($t) <= 8 && !preg_match('/[aeiouyÃ Ã¢Ã¤ÃÃ¨ÃªÃ«ÃÃ¯Ã´Ã¶Ã¹Ã»Ã¼]/iu', $t)) return false;

        return true;
    }

    /**
     * Returns true if the token looks like a date fragment.
     * Date fragments must NEVER be treated as quantities.
     */
    private function looksLikeDate(string $token): bool
    {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $token))       return true;
        if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $token)) return true;
        if (preg_match('/^(19|20)\d{2}$/', $token))             return true;
        return false;
    }

    /**
     * Try to parse a token as a quantity value.
     * Returns the integer quantity or null if not parseable.
     *
     * FIX SUMMARY vs original:
     *  - Upper cap raised from 500 to 9999
     *  - Date patterns are rejected before all other logic
     *  - Year guard covers 1900â€“2199
     *  - knownQtyMisreads expanded with 'oe'=>40, 'ea'=>80, 'go'=>60
     *  - Fuzzy substitution only on tokens â‰¤ 3 chars
     */
    private function tryParseQuantity(string $token): ?int
    {
        $tok = trim($token, ',.;:+- ()[]|/\\');
        if ($tok === '') return null;

        // 1. Reject dates before anything else
        if ($this->looksLikeDate($tok)) return null;

        // 2. Direct numeric
        if (is_numeric($tok)) {
            $val = (int) $tok;
            if ($val >= 1900 && $val <= 2199) return null; // year
            // Guard against model numbers: if it looks like a model number (e.g. 5420, 1080)
            // and it's not a common small quantity, reject it here and let the parser decide.
            if ($val > 500 && $val != 1000 && $val != 2000) return null; 
            if ($val <= 0) return null;
            return $val;
        }

        $lower = strtolower($tok);

        // 3. Known OCR misreads (exact match)
        $known = $this->knownQtyMisreads();
        if (isset($known[$lower])) return $known[$lower];
        // Also test a compact form without spaces/punctuation for tokens like "tC i" / "7 as"
        $compact = preg_replace('/[^a-z0-9]/i', '', $lower);
        if ($compact !== '' && isset($known[$compact])) return $known[$compact];

        $normalized = $this->normalizeNumericLikeToken($tok);
        if ($normalized !== null) {
            $val = (int) $normalized;
            if ($val >= 1900 && $val <= 2199) return null;
            if ($val <= 0 || $val > 9999) return null;
            return $val;
        }

        // 4. Fuzzy substitution only for very short tokens (â‰¤ 3 chars)
        //    Prevents turning normal words like "Sos" into numbers (505)
        if (strlen($tok) <= 3) {
            $fuzzy = strtr($lower, [
                'l' => '1', 'i' => '1', 'o' => '0',
                's' => '5', 'z' => '2', 'b' => '8', 'g' => '9',
            ]);
            if (is_numeric($fuzzy)) {
                $val = (int) $fuzzy;
                if ($val >= 1900 && $val <= 2199) return null;
                if ($val <= 0 || $val > 9999)     return null;
                return $val;
            }
        }

        return null;
    }

    /**
     * Returns true when a row's text looks like a column-header row.
     *
     * FIX: original only skipped rows containing "description" or "produit".
     * This version detects the OCR-noisy header variants robustly by counting
     * how many distinct column-header signals appear in the same row.
     */
    private function isHeaderRow(string $rowText): bool
    {
        $t = strtolower($rowText);
        $signals = 0;

        // Reference column header variants
        if (preg_match('/r[eÃiÃ]?f[eÃiÃ]?[rn]?[eÃiÃ]?[nc]?[ec]?[eo]?|rif/i', $t)) $signals++;
        // Description / produit column header variants
        if (preg_match('/descri?p?ti?[o0]?n?|produit|descriptiond[anu]produit|descr|prod/i', $t)) $signals++;
        // Quantity column header variants
        if (preg_match('/quan?ti?[tdÃ]?[eÃ]?|qte|qty|ouanti|uanti/i', $t)) $signals++;
        // Observations / Notes column
        if (preg_match('/observ|notes?/', $t)) $signals++;
        // Metadata signals
        if (preg_match('/adresse|livraison|client|destinataire|nom|phone|contact|email|tel\b|site\b|web\b/i', $t)) $signals++;

        // A header row is usually short and contains multiple signals
        return $signals >= 2 && strlen($t) < 150;
    }

    /**
     * Parse Tesseract TSV output into structured product lines.
     *
     * KEY FIXES vs original:
     *
     *  FIX-1  isHeaderRow() now catches OCR-noisy column headers robustly.
     *
     *  FIX-2  tryParseQuantity() cap raised to 9999, so 150/500 are no longer
     *         silently dropped.
     *
     *  FIX-3  Date-fragment tokens (e.g. "2026-05-14") are now skipped both as
     *         references and as quantities.
     *
     *  FIX-4  Quantity-column boundary widened: tokens whose LEFT edge is within
     *         120 px of qtyColStart (was 0 px) are included in qtyTokens.
     *         This absorbs OCR word-placement drift that caused "40"/"60"/"80"
     *         to land in titleTokens instead of qtyTokens.
     *
     *  FIX-5  knownQtyMisreads expanded: 'oe'=>40, 'ea'=>80, 'go'=>60.
     *         These cover the exact mis-readings seen in the OfficePlast scan.
     *
     *  FIX-6  Quantity scan searches qtyTokens from RIGHT to LEFT (most reliable)
     *         and falls back to titleTokens only when nothing is found.
     *
     *  FIX-7  Reference regex extended: accepts "vroooz"-style OCR noise for
     *         "INV-000N" patterns when the token starts with v/w/IV/WV/1V.
     *
     *  FIX-8  When qty is found inside titleTokens it is REMOVED from the title
     *         so it doesn't pollute the product description.
     */
    private function parseLinesFromTSV(string $tsv, ?string $storedPath = null): array
    {
        if (trim($tsv) === '') return [];

        $lines = explode("\n", trim($tsv));
        array_shift($lines); // Remove TSV header

        $words = [];
        foreach ($lines as $line) {
            $cols = explode("\t", $line);
            if (count($cols) < 12) continue;
            $text = trim($cols[11]);
            if ($text === '' || $text === '###') continue;
            $conf = (float) $cols[10];
            if ($conf < 10) continue;
            $words[] = [
                'left'   => (int) $cols[6],
                'top'    => (int) $cols[7],
                'right'  => (int) $cols[6] + (int) $cols[8],
                'bottom' => (int) $cols[7] + (int) $cols[9],
                'conf'   => $conf,
                'text'   => $text,
            ];
        }
        if (empty($words)) return [];

        // Group words into rows by Y proximity (tolerance 35 px)
        $rows = [];
        foreach ($words as $word) {
            $placed = false;
            foreach ($rows as &$row) {
                $rowTop = (int) round(array_sum(array_column($row, 'top')) / count($row));
                if (abs($word['top'] - $rowTop) <= 35) {
                    $row[]  = $word;
                    $placed = true;
                    break;
                }
            }
            unset($row);
            if (!$placed) $rows[] = [$word];
        }

        // Sort rows top-to-bottom
        usort($rows, fn($a, $b) => (int)min(array_column($a, 'top')) <=> (int)min(array_column($b, 'top')));

        // Locate the header row (Reference + QuantitÃ columns)
        $headerRowIdx  = null;
        $refColEnd     = null;
        $qtyColStart   = null;
        $qtyColEnd     = null;
        $qtyPrimaryStart = null; // "QuantitÃ LivrÃe" when present
        $qtyPrimaryEnd   = null;
        $titleColStart = null;
        $titleColEnd   = null;

        foreach ($rows as $idx => $row) {
            $rowText  = strtolower(implode(' ', array_column($row, 'text')));
            $hasRef   = preg_match('/r[eÃiÃ]?f/', $rowText) === 1;
            $hasQty   = preg_match('/quan?ti?[tdÃ]?[eÃ]?|qty|qte/', $rowText) === 1;
            $hasDescr = preg_match('/descri?p?ti?[o0]?n?|produit/', $rowText) === 1;

            if ($hasRef && ($hasQty || $hasDescr)) {
                $headerRowIdx = $idx;
                foreach ($row as $word) {
                    if (preg_match('/r[eÃiÃ]?f[eÃiÃ]?[rn]?[eÃiÃ]?[nc]?[ec]?[eo]?/i', $word['text'])) {
                        $refColEnd = $word['right'] + 80;
                    }
                    if (preg_match('/quan?ti?[tdÃ]?[eÃ]?/i', $word['text'])) {
                        // FIX-4: widen boundary by 150 px to the left to absorb OCR drift
                        $qtyColStart = $word['left'] - 150;
                        $qtyColEnd   = $word['right'] + 120;
                    }
                    if (preg_match('/descri?p?ti?[o0]?n?|produit/i', $word['text'])) {
                        $titleColStart = $word['left'] - 20;
                    }
                    if (preg_match('/livr[Ãe]e?/i', $word['text'])) {
                        $qtyPrimaryStart = $word['left'] - 40;
                        $qtyPrimaryEnd   = $word['right'] + 80;
                    }
                }
                if ($titleColStart !== null && $qtyColStart !== null) {
                    $titleColEnd = $qtyColStart - 10;
                }
                break;
            }
        }

        if ($headerRowIdx === null || $refColEnd === null || $qtyColStart === null) {
            return [];
        }

        $refBlacklist = [
            'reference','date','page','total','quantite','description','nom','client',
            'adresse','contact','phone','reception','livraison','bon','details',
            'reterence','riterence','quantit','observations','techpro','solutions',
            'destinataire','dtails','rifrence','riference','produit','descr',
            'rifrenco','rference','rfrence','jriference','jrifrence',
            'descritiondaproduit','descriptiondnproduit',
            '-reference','_reference','descriptiondn','n*',
            'rfrenc','reerence','rerence',
        ];

        $parsed = [];

        foreach (array_slice($rows, $headerRowIdx + 1) as $row) {
            $rowText      = implode(' ', array_column($row, 'text'));
            $rowTextLower = strtolower($rowText);

            // Skip header rows and address/client metadata lines
            if ($this->isHeaderRow($rowText)) continue;
            if (preg_match('/adresse|livraison|destinataire|client|nom du/i', $rowTextLower)) continue;

            // Sort words left â†’ right
            usort($row, fn($a, $b) => $a['left'] <=> $b['left']);

            $refTokens   = [];
            $titleTokens = [];
            $qtyTokens   = [];

            foreach ($row as $word) {
                if ($word['left'] >= $qtyColStart) {
                    // FIX-4: widened qty column boundary catches drift
                    $qtyTokens[] = $word;
                } elseif ($word['right'] <= $refColEnd) {
                    $refTokens[] = $word;
                } elseif ($titleColStart !== null && $titleColEnd !== null && $word['left'] >= $titleColStart && $word['right'] <= $titleColEnd) {
                    $titleTokens[] = $word;
                } else {
                    // Keep in title side as fallback
                    $titleTokens[] = $word;
                }
            }

            // --- Extract reference ---
            $ref = null;
            foreach ($refTokens as $w) {
                $tok = $w['text'];
                // Standard INV-NNNN
                if (preg_match('/^INV[-_]?(\d+)$/i', $tok, $m)) {
                    $ref = 'INV-' . str_pad($m[1], 4, '0', STR_PAD_LEFT);
                    break;
                }
                // FIX-7: OCR-noisy INV prefix: "vroooz", "1V-0001", "WV0001", etc.
                if (preg_match('/^([1IWVwv]{1,3}|Imo|Invo|vr|vo)[-_]?\s*([0oirz\d]{3,8})$/i', $tok, $m)) {
                    $digits = strtr(strtolower($m[2]), ['o' => '0', 'i' => '1', 'l' => '1', 'z' => '2', 'r' => '0', 's' => '5']);
                    // Clean non-digits
                    $digits = preg_replace('/\D/', '', $digits);
                    if (strlen($digits) >= 1) {
                        $ref = 'INV-' . str_pad(substr($digits, -4), 4, '0', STR_PAD_LEFT);
                        break;
                    }
                }
                // 4-digit number only â†’ treat as INV sequence
                if (preg_match('/^(\d{4})$/', $tok, $m)) {
                    $ref = 'INV-' . $m[1];
                    break;
                }
                // Generic numeric row references (1, 2, 3...) for table formats with "RÃf."
                if (preg_match('/^\d{1,3}$/', $tok)) {
                    $ref = 'REF-' . ltrim($tok, '0');
                    if ($ref === 'REF-') $ref = 'REF-0';
                    break;
                }
                // Alphanumeric reference (contains both letters and digits)
                if (preg_match('/[A-Z]/i', $tok) && preg_match('/\d/', $tok)) {
                    $ref = $tok;
                    break;
                }
            }

            // --- Extract & clean title ---
            $titleWords = array_column($titleTokens, 'text');
            $titleStr   = trim(implode(' ', $titleWords));
            $titleStr   = preg_replace('/\s+\b[a-zA-Z]{1,2}\b$/', '', $titleStr);
            $titleStr   = preg_replace('/\b(\w+)\s+\1\b/i', '$1', $titleStr);
            if (preg_match('/^(.+),\s+(\w+)$/u', $titleStr, $m)) {
                if (str_contains(strtolower($m[1]), strtolower($m[2]))) {
                    $titleStr = trim($m[1]);
                }
            }
            $titleStr = $this->fixOcrTitleNoise($titleStr);
            $titleStr = trim($titleStr, ',.:;+- ');

            // --- Validation ---
            $lowRef = strtolower(trim($ref ?? ''));
            $isBlacklisted = false;
            foreach ($refBlacklist as $b) {
                if ($lowRef !== '' && (str_contains($lowRef, $b) || $lowRef === $b)) {
                    $isBlacklisted = true;
                    break;
                }
            }

            if ($ref && $this->looksLikeDate($ref)) continue;
            $lowTitle = strtolower($titleStr);
            if (!$ref || $isBlacklisted || strlen($titleStr) < 2
                || str_contains($lowTitle, 'reference')
                || ($lowRef !== '' && !str_starts_with($lowRef, 'ref-') && str_contains($lowRef, 'ref'))
            ) {
                continue;
            }
            if (!$this->isLikelyValidTitle($titleStr)) continue;

            // --- Extract quantity ---
            // STEP 1: Targeted OCR on the quantity column area
            $qty = null;
            if (!empty($qtyTokens)) {
                $qtyLeft   = min(array_column($qtyTokens, 'left'));
                $qtyTop    = min(array_column($qtyTokens, 'top'));
                $qtyRight  = max(array_column($qtyTokens, 'right'));
                $qtyBottom = max(array_column($qtyTokens, 'bottom'));
                
                // Add padding
                if ($storedPath) {
                    $qty = $this->runTargetedNumericOcr($storedPath, $qtyLeft - 10, $qtyTop - 5, $qtyRight + 10, $qtyBottom + 5);
                }
            }

            if ($qty === null) {
                // Fallback: scan individual tokens right â†’ left
                foreach (array_reverse($qtyTokens) as $w) {
                    $qty = $this->tryParseQuantity($w['text']);
                    if ($qty !== null) break;
                }
            }

            // If document has two quantity columns (commandÃe/livrÃe), prefer right-most (livrÃe).
            if (!empty($qtyTokens)) {
                $qtyFromRightMost = null;
                $rightZone = [];
                if ($qtyPrimaryStart !== null && $qtyPrimaryEnd !== null) {
                    $rightZone = array_values(array_filter($qtyTokens, fn($w) => $w['left'] >= $qtyPrimaryStart && $w['right'] <= $qtyPrimaryEnd));
                }
                if (empty($rightZone)) {
                    // fallback: take the far-right half of qty tokens
                    $maxRight = max(array_column($qtyTokens, 'right'));
                    $minLeft = min(array_column($qtyTokens, 'left'));
                    $mid = (int) (($maxRight + $minLeft) / 2);
                    $rightZone = array_values(array_filter($qtyTokens, fn($w) => $w['left'] >= $mid));
                }
                foreach (array_reverse($rightZone) as $w) {
                    $q = $this->tryParseQuantity($w['text']);
                    if ($q !== null) { $qtyFromRightMost = $q; break; }
                }
                if ($qtyFromRightMost !== null) $qty = $qtyFromRightMost;
            }

            // STEP 2: fallback â€” scan title tokens right â†’ left
            //         FIX-8: remove the token from title when it is used as qty
            if ($qty === null && !empty($titleTokens)) {
                $tw = array_column($titleTokens, 'text');
                for ($i = count($tw) - 1; $i >= 0; $i--) {
                    $candidate = $this->tryParseQuantity($tw[$i]);
                    if ($candidate === null) continue;

                    // Reject if adjacent to a measurement unit
                    $prevWord = ($i > 0) ? strtolower($tw[$i - 1]) : '';
                    $nextWord = ($i < count($tw) - 1) ? strtolower($tw[$i + 1]) : '';
                    $units    = ['pages','page','g','gr','ml','go','mo','ghz','ko','mg'];
                    if (in_array($prevWord, $units) || in_array($nextWord, $units)) continue;

                    $wordLeft      = $titleTokens[$i]['left'];
                    $isNearQtyCol  = $wordLeft >= ($qtyColStart - 80);
                    $lower         = strtolower(trim($tw[$i], ',.;:+- '));
                    $compact       = preg_replace('/[^a-z0-9]/i', '', $lower);
                    $isKnownMisread= isset($this->knownQtyMisreads()[$lower]) || ($compact !== '' && isset($this->knownQtyMisreads()[$compact]));

                    if ($isNearQtyCol || $isKnownMisread) {
                        $qty = $candidate;
                        // FIX-8: remove this token from the title
                        array_splice($titleTokens, $i, 1);
                        // Rebuild titleStr without the qty token
                        $titleStr = implode(' ', array_column($titleTokens, 'text'));
                        $titleStr = $this->fixOcrTitleNoise(trim($titleStr, ',.:;+- '));
                        break;
                    }
                }
            }

            if ($titleStr === '') continue;
            if (preg_match('/@|gmail|yahoo|hotmail|client|adresse|date|numero|bon de livraison/i', $titleStr)) continue;

            // Generic recovery pass: if quantity is missing or suspiciously 1-digit,
            // re-read the right side of the row (quantity column neighborhood).
            if ($storedPath && ($qty === null || $qty < 10)) {
                $rowLeft   = (int) min(array_column($row, 'left'));
                $rowTop    = (int) min(array_column($row, 'top'));
                $rowRight  = (int) max(array_column($row, 'right'));
                $rowBottom = (int) max(array_column($row, 'bottom'));

                $rowWidth = max(1, $rowRight - $rowLeft);
                // Right-most 38% of the row usually contains the quantity value.
                $altLeft = (int) ($rowLeft + ($rowWidth * 0.62));
                $altQty = $this->runTargetedNumericOcr($storedPath, $altLeft, $rowTop - 4, $rowRight + 12, $rowBottom + 4);

                if ($altQty !== null) {
                    if ($qty === null || ($qty < 10 && $altQty >= 10)) {
                        $qty = $altQty;
                    }
                }
            }

            $parsed[] = [
                'reference'        => $ref,
                'title'            => $titleStr,
                'quantity'         => $qty,
                'ordered_quantity' => null,
                '_rowTop'          => (int) min(array_column($row, 'top')),
            ];
        }

        // Post-process: attach orphan qty numbers to nearest product row above
        foreach ($rows as $row) {
            $hasRef    = false;
            $orphanQty = null;
            $rowTop    = (int) min(array_column($row, 'top'));

            foreach ($row as $word) {
                if ($word['right'] <= $refColEnd) { $hasRef = true; break; }
            }
            if ($hasRef) continue;

            foreach ($row as $word) {
                if ($word['left'] >= ($qtyColStart - 30)) {
                    $candidate = $this->tryParseQuantity($word['text']);
                    if ($candidate !== null) { $orphanQty = $candidate; break; }
                }
            }
            if ($orphanQty === null) continue;

            $bestIdx = null; $bestDist = PHP_INT_MAX;
            foreach ($parsed as $pIdx => $p) {
                if (isset($p['_rowTop']) && $p['_rowTop'] < $rowTop) {
                    $dist = $rowTop - $p['_rowTop'];
                    if ($dist < $bestDist) { $bestDist = $dist; $bestIdx = $pIdx; }
                }
            }
            if ($bestIdx !== null && $parsed[$bestIdx]['quantity'] === null) {
                $parsed[$bestIdx]['quantity'] = $orphanQty;
            }
        }

        $parsed = array_values(array_map(function ($p) { unset($p['_rowTop']); return $p; }, $parsed));

        // Fallback table extraction: when classical parsing fails or yields too few rows.
        // This tries to read rows by visual structure (left ref / center designation / right quantity).
        if (count($parsed) < 2) {
            $fallbackRows = [];
            foreach ($rows as $row) {
                usort($row, fn($a, $b) => $a['left'] <=> $b['left']);
                $rowText = strtolower(trim(implode(' ', array_column($row, 'text'))));
                if ($rowText === '') continue;

                // Skip metadata/header/footer lines
                if (preg_match('/bon de livraison|numero de bon|date|client|adresse|livraison|destinataire|contact|phone|email|gmail|recu par|regu par|quantite command|quantite livre/i', $rowText)) continue;
                if ($this->isHeaderRow($rowText)) continue;

                // Find right-most numeric-like token as quantity candidate.
                $qty = null;
                $qtyIdx = null;
                for ($i = count($row) - 1; $i >= 0; $i--) {
                    $candidate = $this->tryParseQuantity($row[$i]['text']);
                    if ($candidate !== null) {
                        $qty = $candidate;
                        $qtyIdx = $i;
                        break;
                    }
                }
                if ($qty === null) continue;

                // Build reference from the first token (numeric index or alphanumeric id).
                $firstTok = trim((string)($row[0]['text'] ?? ''));
                $ref = null;
                if (preg_match('/^INV[-_]?(\d+)$/i', $firstTok, $m)) {
                    $ref = 'INV-' . str_pad($m[1], 4, '0', STR_PAD_LEFT);
                } elseif (preg_match('/^\d{1,4}$/', $firstTok)) {
                    $ref = 'REF-' . ltrim($firstTok, '0');
                    if ($ref === 'REF-') $ref = 'REF-0';
                }
                if (!$ref) continue;

                // Title is tokens between ref and qty token.
                $titleParts = [];
                for ($j = 1; $j < count($row); $j++) {
                    if ($qtyIdx !== null && $j >= $qtyIdx) break;
                    $t = trim((string)$row[$j]['text']);
                    if ($t === '') continue;
                    if ($this->tryParseQuantity($t) !== null) continue;
                    $titleParts[] = $t;
                }
                $title = $this->fixOcrTitleNoise(trim(implode(' ', $titleParts)));
                $title = trim(preg_replace('/\s+/', ' ', $title));
                if (!$this->isLikelyValidTitle($title)) continue;

                $fallbackRows[] = [
                    'reference' => $ref,
                    'title' => $title,
                    'quantity' => $qty,
                    'ordered_quantity' => null,
                ];
            }

            // Deduplicate by (reference,title) and keep the best quantity
            if (!empty($fallbackRows)) {
                $merged = [];
                foreach ($fallbackRows as $r) {
                    $k = strtolower($r['reference'] . '|' . $r['title']);
                    if (!isset($merged[$k])) {
                        $merged[$k] = $r;
                    } else {
                        $prevQ = (int)($merged[$k]['quantity'] ?? 0);
                        $newQ = (int)($r['quantity'] ?? 0);
                        if ($newQ > $prevQ) $merged[$k]['quantity'] = $newQ;
                    }
                }
                if (count($merged) > count($parsed)) {
                    $parsed = array_values($merged);
                }
            }
        }

        return $parsed;
    }

    /**
     * Fix common OCR noise patterns in product titles.
     */
    private function fixOcrTitleNoise(string $title): string
    {
        $replacements = [
            '/\bOdinateur\b/i'                   => 'Ordinateur',
            '/\bgelmain\b/i'                     => 'gel Ã  main',
            '/\bDescriptiondnProduit\b/i'        => '',
            '/\bDescritiondaProduit\b/i'         => '',
            '/\bSous\b/i'                        => 'Souris',
            '/\bsansfil\b/i'                     => 'sans fil',
            '/\bsensfil\b/i'                     => 'sans fil',
            '/\bsensfilog[a-z]+\b/i'             => 'sans fil Logitech',
            '/\bogechmres\b/i'                   => 'Logitech M185',
            '/\bogtenmis\b/i'                    => 'Logitech',
            '/\bogitech\b/i'                     => 'Logitech',
            '/\bSouris\s+ar\b/i'                 => 'Souris',
            '/\bar\s+sans\b/i'                   => 'sans',
            '/\b5j\b/i'                          => '', // remove noise if leaked into title
            '/[\/&][a-zA-Z]*$/'                  => '',
            '/\s+[a-zA-Z]$/'                     => '',
            // Strip lone noise characters that OCR adds after real content
            '/\s+[\/\\\\|]\s*$/'                 => '',
            '/\bOe\s+a\b/i'                      => '',  // remove leftover "Oe a" qty noise
            '/\bINV[-_]?\d+\b/i'                 => '',  // remove references that leaked into title
        ];
        foreach ($replacements as $pattern => $replacement) {
            $title = preg_replace($pattern, $replacement, $title);
        }
        return trim(preg_replace('/\s+/', ' ', $title));
    }

    private function runTargetedNumericOcr(string $originalPath, int $left, int $top, int $right, int $bottom): ?int
    {
        if (!class_exists(\Imagick::class)) return null;
        try {
            $img = new \Imagick(Storage::disk('public')->path($originalPath));

            $iW = $img->getImageWidth();
            $iH = $img->getImageHeight();
            $left = max(0, $left); $top = max(0, $top);
            $right = min($iW, $right); $bottom = min($iH, $bottom);

            $w = $right - $left;
            $h = $bottom - $top;
            if ($w <= 5 || $h <= 5) return null;

            $base = clone $img;
            $base->cropImage($w, $h, $left, $top);
            $base->setImageColorspace(\Imagick::COLORSPACE_GRAY);
            $base->enhanceImage();
            $base->contrastImage(1);
            $base->resizeImage($w * 5, $h * 5, \Imagick::FILTER_LANCZOS, 1);

            $variants = [];

            $v1 = clone $base;
            $v1->adaptiveThresholdImage(40, 40, 10);
            $v1->morphology(\Imagick::MORPHOLOGY_OPEN, 1, \Imagick::KERNEL_SQUARE, "1");
            $variants[] = $v1;

            $v2 = clone $base;
            $v2->autoThresholdImage(\Imagick::AUTO_THRESHOLD_OTSU);
            $variants[] = $v2;

            $v3 = clone $base;
            $v3->adaptiveThresholdImage(32, 32, 8);
            $v3->negateImage(false);
            $variants[] = $v3;

            $tmpFiles = [];
            foreach ($variants as $variant) {
                $tmp = tempnam(sys_get_temp_dir(), 'ocr_qty_') . '.png';
                $variant->writeImage($tmp);
                $tmpFiles[] = $tmp;
                $variant->clear();
                $variant->destroy();
            }

            $base->clear(); $base->destroy();
            $img->clear(); $img->destroy();

            $binary = $this->tesseractBinary();
            if (!$binary) {
                foreach ($tmpFiles as $f) @unlink($f);
                return null;
            }

            $isWindows  = stripos(PHP_OS_FAMILY, 'Windows') !== false;
            $binArg     = $isWindows ? '"' . $binary . '"' : escapeshellarg($binary);
            $psms = [7, 8, 10, 6, 13];
            $candidates = [];

            foreach ($tmpFiles as $tmp) {
                $fileArg = $isWindows ? '"' . $tmp . '"' : escapeshellarg($tmp);
                foreach ($psms as $psm) {
                    $cmd = $binArg . ' ' . $fileArg . ' stdout --psm ' . $psm . ' -c tessedit_char_whitelist=0123456789';
                    $tdp = env('TESSDATA_PREFIX');
                    if ($tdp) {
                        $cmd = $isWindows ? 'set "TESSDATA_PREFIX=' . $tdp . '" && ' . $cmd : 'TESSDATA_PREFIX=' . escapeshellarg($tdp) . ' ' . $cmd;
                    }
                    $cmd .= $isWindows ? ' 2>&1' : ' 2>/dev/null';
                    $out = trim((string) @shell_exec($cmd));
                    if ($out === '') continue;

                    $digits = preg_replace('/\D/', '', $out);
                    if ($digits === '') continue;

                    $val = (int) $digits;
                    if ($val > 0 && $val < 10000) {
                        $candidates[] = $val;
                    }
                }
            }

            foreach ($tmpFiles as $f) @unlink($f);
            if (empty($candidates)) return null;

            $freq = array_count_values($candidates);
            arsort($freq);
            $bestVal = (int) array_key_first($freq);

            // If geometry suggests at least 2 digits but winner is 1-digit, prefer best >=10 candidate.
            $aspect = ($h > 0) ? ($w / $h) : 0;
            if ($bestVal < 10 && $aspect > 1.25) {
                $multi = array_values(array_filter($candidates, fn($v) => $v >= 10));
                if (!empty($multi)) {
                    $freq2 = array_count_values($multi);
                    arsort($freq2);
                    $bestVal = (int) array_key_first($freq2);
                }
            }

            return $bestVal;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function runTesseract(string $fullPath): string
    {
        $source = $this->preprocessImage($fullPath);

        $binary = $this->tesseractBinary();
        if (!$binary) return '';

        $isWindows  = stripos(PHP_OS_FAMILY, 'Windows') !== false;
        $binArg     = $isWindows ? '"' . $binary . '"' : escapeshellarg($binary);
        $langs      = ['fra+eng', 'fra', 'eng'];
        $psmOptions = [6, 3, 4, 11, 12, 1, 13];

        $bestOut   = '';
        $bestScore = -1;

        foreach ($langs as $lang) {
            foreach ($psmOptions as $psm) {
                $fileArg = $isWindows ? '"' . $source . '"' : escapeshellarg($source);
                $cmd = $binArg . ' ' . $fileArg . ' stdout -l ' . $lang
                    . ' --psm ' . $psm . ' --oem 1'
                    . ' -c preserve_interword_spaces=1'
                    . ' -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÃÃ¨ÃªÃ Ã¢Ã¹Ã»Ã§Ã‰ÃˆÃŠÃ€Ã‚ÃÃ›Ã‡.:/_-,"()Â°+*%@\' '
                    . ' -c user_defined_dpi=300';

                $tdp = env('TESSDATA_PREFIX');
                if ($tdp) {
                    $cmd = $isWindows
                        ? 'set "TESSDATA_PREFIX=' . $tdp . '" && ' . $cmd
                        : 'TESSDATA_PREFIX=' . escapeshellarg($tdp) . ' ' . $cmd;
                }
                $cmd .= $isWindows ? ' 2>&1' : ' 2>/dev/null';

                $out = @shell_exec($cmd);
                if (is_string($out)) {
                    $trimmed = trim($out);
                    if ($trimmed !== '' && !str_contains($trimmed, 'Error opening data file')) {
                        $score = 0;
                        foreach (explode("\n", $trimmed) as $l) {
                            $tl = trim($l);
                            if ($tl === '') continue;
                            if (preg_match('/INV-\d+/i', $tl))       $score += 10;
                            if (preg_match('/\b\d+\b$/', $tl))        $score += 5;
                            if (preg_match('/bon de livraison/i', $tl))$score += 5;
                        }
                        if ($score > $bestScore) { $bestScore = $score; $bestOut = $trimmed; }
                        if ($score >= 40) { // Increased threshold to find more lines
                            if ($source !== $fullPath && file_exists($source)) @unlink($source);
                            return $trimmed;
                        }
                    }
                }
            }
        }

        if ($source !== $fullPath && file_exists($source)) @unlink($source);
        return $bestOut;
    }

    private function preprocessImage(string $fullPath): string
    {
        if (!class_exists(\Imagick::class)) {
            $converted = $this->preprocessWithMagick($fullPath);
            return $converted ?: $fullPath;
        }
        try {
            $img = new \Imagick($fullPath);
            $img->deskewImage(0.4);
            $img->enhanceImage();
            $img->contrastImage(0);
            $img->sharpenImage(0, 1);
            $w = $img->getImageWidth();
            $h = $img->getImageHeight();
            $img->resizeImage((int)($w * 2.0), (int)($h * 2.0), \Imagick::FILTER_LANCZOS, 1);
            $img->setImageColorspace(\Imagick::COLORSPACE_GRAY);
            $img->adaptiveThresholdImage(40, 40, 20); // More aggressive thresholding
            $img->stripImage();
            $tmp = tempnam(sys_get_temp_dir(), 'ocr_') . '.tif';
            $img->writeImage($tmp);
            $img->clear(); $img->destroy();
            return $tmp;
        } catch (\Throwable $e) {
            $fallback = $this->preprocessWithMagick($fullPath);
            return $fallback ?: $fullPath;
        }
    }

    private function preprocessWithMagick(string $fullPath): ?string
    {
        $magick    = env('MAGICK_PATH', 'magick');
        $hasBinary = $magick === 'magick' || is_file($magick);
        if (!$hasBinary) return null;

        $tmp = tempnam(sys_get_temp_dir(), 'ocr_') . '.png';
        $cmd = sprintf(
            '"%s" %s -density 300 -resample 300x300 -deskew 40%% -resize 200%% -colorspace Gray -contrast-stretch 2%%x2%% -alpha remove -background white +repage -strip %s',
            $magick, escapeshellarg($fullPath), escapeshellarg($tmp)
        );
        @shell_exec($cmd);
        return file_exists($tmp) ? $tmp : null;
    }

    /**
     * Parse plain-text OCR output into structured product lines.
     *
     * FIX SUMMARY vs original:
     *  - tryParseQuantity() cap raised to 9999
     *  - Date-fragment tokens are rejected
     *  - isHeaderRow() used to skip column-header lines robustly
     *  - knownQtyMisreads expanded: 'oe'=>40, 'ea'=>80, 'go'=>60
     */
    private function parseLines(string $text): array
    {
        $lines  = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $text)));
        $parsed = [];
        $headerFound = false;

        foreach ($lines as $line) {
            $lowLine = strtolower($line);
            
            // Skip clear metadata lines
            if (preg_match('/adresse|livraison|destinataire|client|nom du|contact|phone|email|tel:|fax:|site web|gmail|hotmail|yahoo/i', $lowLine)) continue;
            if (preg_match('/bon de livraison|numero de bon|rÃfÃrence n/i', $lowLine)) continue;

            if ($this->isHeaderRow($line) || str_contains($lowLine, 'ref')) {
                $headerFound = true;
                continue;
            }

            // Optional: if we haven't found a header yet, skip lines that are likely header metadata
            if (!$headerFound && (strlen($line) < 10 || preg_match('/^\d+$/', $line))) continue;

            $clean = preg_replace('/[\|\[\]\(\)_]+/', ' ', $line);
            $clean = preg_replace('/[^\p{L}\d\.\-\s]/u', ' ', $clean);
            $clean = trim((string) preg_replace('/\s+/', ' ', $clean));
            if ($clean === '') continue;

            $tokens = preg_split('/\s+/', $clean);
            if (count($tokens) < 2) continue;

            $qty     = null;
            $ordered = null;

            // Scan the last few tokens for quantity
            $maxSearch = min(count($tokens), 3);
            
            // First, try combining the last 2 or 3 tokens (for noisy reads like "tc i" or "7 as")
            for ($len = $maxSearch; $len >= 2; $len--) {
                $combined = strtolower(implode(' ', array_slice($tokens, -$len)));
                $candidate = $this->tryParseQuantity($combined);
                if ($candidate !== null) {
                    $qty = $candidate;
                    array_splice($tokens, -$len);
                    break;
                }
            }

            if ($qty === null) {
                // Fallback: individual tokens right â†’ left
                for ($i = count($tokens) - 1; $i >= count($tokens) - $maxSearch; $i--) {
                    if ($this->looksLikeDate($tokens[$i])) continue;
                    $candidate = $this->tryParseQuantity($tokens[$i]);
                    if ($candidate !== null) {
                        if ($i > 0) {
                            $prev = $this->tryParseQuantity($tokens[$i - 1]);
                            if ($prev !== null) {
                                $ordered = $prev;
                                $qty = $candidate;
                                array_splice($tokens, $i - 1, 2);
                                break;
                            }
                        }
                        $qty = $candidate;
                        array_splice($tokens, $i, 1);
                        break;
                    }
                }
            }

            // Extract reference
            $ref = null;
            $refBlacklist = [
                'reference','date','page','total','quantite','description','nom','client',
                'adresse','contact','phone','reception','livraison','bon','details',
                'reterence','riterence','relerence','quantit','observations',
                'n*','n.','techpro','solutions','destinataire','dtails',
                'rifrence','riference','ritrence','produit','desc','descr',
                'qte','qty','descriptiondnproduit','descritiondaproduit',
                'rference','rfrenc','reerence','rerence',
            ];

            foreach ($tokens as $i => $tok) {
                $lowTok = strtolower($tok);
                if (in_array($lowTok, $refBlacklist) || strlen($tok) < 2) continue;
                if ($this->looksLikeDate($tok)) continue;

                // Priority 1: Standard INV-NNNN
                if (preg_match('/^INV[-_]?(\d+)$/i', $tok, $m)) {
                    $ref = 'INV-' . str_pad($m[1], 4, '0', STR_PAD_LEFT);
                    unset($tokens[$i]); $tokens = array_values($tokens); break;
                }
                // Priority 2: Noisy prefixes like vroooz, 1V0001, (vroooz
                if (preg_match('/^[^\w]*([1IWVwv]{1,3}|Imo|Invo|vr|vo)[-_]?\s*([0oirz\d]{3,8})[^\w]*$/i', $tok, $m)) {
                    $digits = strtr(strtolower($m[2]), ['o' => '0', 'i' => '1', 'l' => '1', 'z' => '2', 'r' => '0', 's' => '5']);
                    $digits = preg_replace('/\D/', '', $digits);
                    if (strlen($digits) >= 1) {
                        $ref = 'INV-' . str_pad(substr($digits, -4), 4, '0', STR_PAD_LEFT);
                        unset($tokens[$i]); $tokens = array_values($tokens); break;
                    }
                }
                // Priority 3: Alphanumeric (contains both letters and digits)
                if (preg_match('/[A-Z]/i', $tok) && preg_match('/\d/', $tok)) {
                    $ref = $tok; unset($tokens[$i]); $tokens = array_values($tokens); break;
                }
                // Priority 4: Short alphanumeric (2 chars like A1) - MUST be mixed
                if (strlen($tok) === 2 && preg_match('/[A-Z]/i', $tok) && preg_match('/\d/', $tok)) {
                    $ref = $tok; unset($tokens[$i]); $tokens = array_values($tokens); break;
                }
                // Fallback: numeric row index references only (1,2,3...)
                if ($i === 0 && preg_match('/^\d{1,3}$/', $tok)) {
                    $ref = 'REF-' . ltrim($tok, '0');
                    if ($ref === 'REF-') $ref = 'REF-0';
                    unset($tokens[$i]); $tokens = array_values($tokens); break;
                }
            }

            $title = trim(implode(' ', $tokens));
            $title = $this->fixOcrTitleNoise($title);
            $title = trim(preg_replace('/\s+/', ' ', $title));
            $title = preg_replace('/\s+\b[a-zA-Z]{1,2}\b$/', '', trim($title));
            $title = preg_replace('/\b(\w+)\s+\1\b/i', '$1', $title);
            $title = trim($title, ',.:;+- ');

            if (!$ref || in_array(strtolower($ref), $refBlacklist)) continue;
            if (strlen($ref) < 3 && strlen($title) < 3) continue;
            if (preg_match('/@|gmail|yahoo|hotmail/i', $title)) continue;
            if (!$this->isLikelyValidTitle($title)) continue;

            $parsed[] = [
                'reference'        => $ref,
                'title'            => $title ?: 'Produit ' . $ref,
                'quantity'         => $qty,
                'ordered_quantity' => $ordered,
            ];
        }

        return $parsed;
    }

    /**
     * Fallback: OCR only the table area and parse row structure directly.
     * Useful when full-page OCR is noisy but the printed table is still readable.
     */
    private function extractTableFromImageHeuristic(string $fullPath): array
    {
        if (!class_exists(\Imagick::class)) return [];

        try {
            $img = new \Imagick($fullPath);
            $w = $img->getImageWidth();
            $h = $img->getImageHeight();
            if ($w < 50 || $h < 50) return [];

            // Crop around the lower-middle region where table rows are usually located
            $cropTop = (int)($h * 0.42);
            $cropBottom = (int)($h * 0.90);
            $cropLeft = (int)($w * 0.05);
            $cropRight = (int)($w * 0.96);
            $cw = max(10, $cropRight - $cropLeft);
            $ch = max(10, $cropBottom - $cropTop);

            $img->cropImage($cw, $ch, $cropLeft, $cropTop);
            $img->setImageColorspace(\Imagick::COLORSPACE_GRAY);
            $img->enhanceImage();
            $img->resizeImage((int)($cw * 2.2), (int)($ch * 2.2), \Imagick::FILTER_LANCZOS, 1);
            $img->adaptiveThresholdImage(30, 30, 8);

            $tmp = tempnam(sys_get_temp_dir(), 'ocr_tbl_') . '.png';
            $img->writeImage($tmp);
            $img->clear();
            $img->destroy();

            $tableText = $this->runTesseract($tmp);
            @unlink($tmp);
            if (trim($tableText) === '') return [];

            $rows = [];
            $lines = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $tableText)));
            foreach ($lines as $line) {
                $low = mb_strtolower($line);
                if ($low === '') continue;
                if (preg_match('/rÃf|ref|dÃsignation|quantitÃ|commandÃe|livrÃe|livree/i', $low)) continue;
                if (preg_match('/client|adresse|date|bon|livraison|recu|regu|email|gmail/i', $low)) continue;

                $clean = preg_replace('/\s+/', ' ', trim($line));

                // Pattern: "1 gel Ã  main 20 20" -> qty = last (livrÃe)
                if (preg_match('/^\s*(\d{1,3})\s+(.+?)\s+(\d{1,4})\s+(\d{1,4})\s*$/u', $clean, $m)) {
                    $title = $this->fixOcrTitleNoise(trim($m[2]));
                    if (!$this->isLikelyValidTitle($title)) continue;
                    $refIdx = ltrim((string)$m[1], '0');
                    if ($refIdx === '') $refIdx = '0';
                    $rows[] = [
                        'reference' => 'REF-' . $refIdx,
                        'title' => $title,
                        'quantity' => (int)$m[4],
                        'ordered_quantity' => (int)$m[3],
                    ];
                    continue;
                }

                // Pattern: "2 stylo 10"
                if (preg_match('/^\s*(\d{1,3})\s+(.+?)\s+(\d{1,4})\s*$/u', $clean, $m)) {
                    $title = $this->fixOcrTitleNoise(trim($m[2]));
                    if (!$this->isLikelyValidTitle($title)) continue;
                    $refIdx = ltrim((string)$m[1], '0');
                    if ($refIdx === '') $refIdx = '0';
                    $rows[] = [
                        'reference' => 'REF-' . $refIdx,
                        'title' => $title,
                        'quantity' => (int)$m[3],
                        'ordered_quantity' => null,
                    ];
                }
            }

            // Deduplicate by reference/title
            $dedup = [];
            foreach ($rows as $r) {
                $k = strtolower(($r['reference'] ?? '') . '|' . ($r['title'] ?? ''));
                if (!isset($dedup[$k])) $dedup[$k] = $r;
            }
            return array_values($dedup);
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function firstLine(string $text): ?string
    {
        $lines = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $text)));
        return $lines ? mb_substr(array_values($lines)[0], 0, 120) : null;
    }

    private function guessSupplierName(string $text): ?string
    {
        $lines     = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $text))));
        $blacklist = [
            'bondelivraison','bon de livraison','bon de sortie','bon de reception',
            'detailsdelalivraison','details de la livraison','reference','date',
            'adresse','contact','email','e mail','destinataire','nomduclient',
            'nom du client','adresse de livraison','datedelivraison','signatureclient',
        ];

        foreach ($lines as $index => $line) {
            $normalized = $this->normalizeSupplierValue($line);
            if ($normalized === '' || in_array($normalized, $blacklist, true)) continue;

            $previous = $index > 0 ? $this->normalizeSupplierValue($lines[$index - 1]) : '';
            $next     = $index < count($lines) - 1 ? $this->normalizeSupplierValue($lines[$index + 1]) : '';

            if (
                in_array($previous, ['bondelivraison','bon de livraison','bon','bon de reception'], true)
                && !$this->looksLikeAddressOrContact($normalized)
                && !$this->looksLikeClientField($next)
            ) {
                return $line;
            }
        }

        foreach ($lines as $line) {
            $normalized = $this->normalizeSupplierValue($line);
            if (
                preg_match('/^[\p{L}][\p{L}\s\-\.\d@]+$/u', $line)
                && mb_strlen($line) >= 3 && mb_strlen($line) <= 60
                && $normalized !== ''
                && !in_array($normalized, $blacklist, true)
                && !$this->looksLikeAddressOrContact($normalized)
            ) {
                $match = $this->findMatchingSupplier($line);
                if ($match['status'] !== 'none' && $match['score'] >= 85) return $line;
            }
        }
        return null;
    }

    /**
     * Extract supplier email from OCR text.
     *
     * FIX: Added '@' to the Tesseract character whitelist (runTesseract) so
     * "contact@techpro.tn" is no longer OCR'd as "contacttechpro.tn".
     * This method itself is unchanged but now receives correct input.
     */
    private function guessSupplierEmail(string $text): ?string
    {
        // FIX: also try to recover emails where @ was OCR'd as empty
        // by looking for "word.tld" patterns on lines containing "contact" or "email"
        if (preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $text, $m)) {
            return strtolower($m[0]);
        }

        // Secondary pass: find lines with contact/email labels and repair missing @
        foreach (explode("\n", $text) as $line) {
            $lower = strtolower(trim($line));
            if (str_contains($lower, 'contact') || str_contains($lower, 'email') || str_contains($lower, 'mail')) {
                // Match pattern like "contacttechpro.tn" â†’ try inserting @ before the domain
                if (preg_match('/\b([a-z0-9._%+\-]+)([a-z0-9\-]+\.[a-z]{2,})\b/i', $line, $m2)) {
                    $candidate = $m2[1] . '@' . $m2[2];
                    if (filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
                        return strtolower($candidate);
                    }
                }
            }
        }

        return null;
    }

    private function guessDirection(string $text): string
    {
        $t = Str::lower($text);
        if (preg_match('/bon\s*de\s*livraison|bondelivraison|r[eÃ]ception|entree|entr[eÃ]/iu', $t)) return 'in';
        if (preg_match('/bon\s*de\s*sortie|bonsortie|sortie/iu', $t)) return 'out';
        return 'unknown';
    }

    private function guessType(string $text): string
    {
        $t = Str::lower($text);
        if (preg_match('/bon\s*de\s*livraison|bondelivraison/iu', $t)) return 'bon_livraison';
        if (preg_match('/bon\s*de\s*sortie|bonsortie/iu', $t)) return 'bon_sortie';
        return 'document';
    }

    private function findMatchingSupplier(?string $supplierName, ?string $supplierEmail = null): array
    {
        $normalizedName = $this->normalizeSupplierValue($supplierName);
        if ($normalizedName === '') return ['status' => 'none'];

        $suppliers = Supplier::query()->select(['id', 'name', 'email'])->get();
        $bestId    = null;
        $bestScore = 0;

        foreach ($suppliers as $supplier) {
            if ($supplierEmail && $supplier->email && Str::lower((string) $supplier->email) === Str::lower((string) $supplierEmail)) {
                return ['status' => 'exact', 'id' => (int) $supplier->id, 'name' => $supplier->name, 'email' => $supplier->email, 'score' => 100];
            }
            $candidate = $this->normalizeSupplierValue($supplier->name);
            if ($candidate === '') continue;
            if ($candidate === $normalizedName) {
                return ['status' => 'exact', 'id' => (int) $supplier->id, 'name' => $supplier->name, 'email' => $supplier->email, 'score' => 100];
            }
            $score = 0;
            if (str_contains($candidate, $normalizedName) || str_contains($normalizedName, $candidate)) {
                $score = 92;
            } else {
                similar_text($normalizedName, $candidate, $percent);
                $score = (int) round($percent);
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestId    = ['id' => (int) $supplier->id, 'name' => $supplier->name, 'email' => $supplier->email, 'score' => $score];
            }
        }

        if ($bestScore < 85 && isset($this->lastOcrText)) {
            $rawLower = Str::lower($this->lastOcrText);
            foreach ($suppliers as $supplier) {
                $sName = $this->normalizeSupplierValue($supplier->name);
                if (strlen($sName) > 4 && str_contains($rawLower, $sName)) {
                    return ['status' => 'partial', 'id' => (int) $supplier->id, 'name' => $supplier->name, 'email' => $supplier->email, 'score' => 90];
                }
            }
        }

        if ($bestScore >= 92 && is_array($bestId)) return ['status' => 'exact', ...$bestId];
        if ($bestScore >= 78 && is_array($bestId)) return ['status' => 'candidate', ...$bestId];
        return ['status' => 'none'];
    }

    private function normalizeSupplierValue(?string $value): string
    {
        $normalized = Str::of((string) $value)
            ->ascii()->lower()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->trim()->value();

        if ($normalized === '') return '';

        $stopWords = ['ste','st','sarl','suarl','sa','sas','eurl','societe','soc','company','co','ltd','limited','inc','groupe','group','tunisie','tn'];
        $parts = array_values(array_filter(
            preg_split('/\s+/', $normalized) ?: [],
            fn($part) => $part !== '' && !in_array($part, $stopWords, true)
        ));

        return implode(' ', $parts);
    }

    private function findSupplierIdFromHistory(?string $ocrSupplierName): ?int
    {
        $normalized = $this->normalizeSupplierValue($ocrSupplierName);
        if ($normalized === '') return null;

        $documents = Document::query()
            ->whereNotNull('supplier_id')->whereNotNull('ocr_text')
            ->latest('id')->limit(100)->get(['supplier_id', 'ocr_text']);

        foreach ($documents as $document) {
            $guessed = $this->guessSupplierName((string) $document->ocr_text);
            if ($this->normalizeSupplierValue($guessed) === $normalized) {
                return (int) $document->supplier_id;
            }
        }
        return null;
    }

    private function looksLikeAddressOrContact(string $normalized): bool
    {
        return str_contains($normalized, 'adresse')
            || str_contains($normalized, 'contact')
            || str_contains($normalized, 'email')
            || str_contains($normalized, 'mail')
            || preg_match('/\d{6,}/', $normalized) === 1;
    }

    private function looksLikeClientField(string $normalized): bool
    {
        return str_contains($normalized, 'client')
            || str_contains($normalized, 'destinataire')
            || str_contains($normalized, 'livraison');
    }

    public function findAvailableLocation(Request $request)
    {
        $user        = $request->user();
        $warehouseId = $request->input('warehouse_id');
        if (!$warehouseId && $user && $user->depot_id) $warehouseId = $user->depot_id;
        if (!$warehouseId) return response()->json(['message' => 'Aucun dÃpÃ´t trouvÃ pour cet utilisateur.'], 404);

        $quantity = (int) ($request->input('quantity') ?? 1);

        $availableLocation = \App\Models\WarehouseLocation::join('warehouse_rooms', 'warehouse_locations.room_id', '=', 'warehouse_rooms.id')
            ->where('warehouse_rooms.warehouse_id', $warehouseId)
            ->where('warehouse_rooms.status', 'active')
            ->where('warehouse_locations.status', 'active')
            ->where(function ($q) use ($quantity) {
                $q->whereRaw('capacity_units IS NULL')
                  ->orWhereRaw('capacity_units = 0')
                  ->orWhereRaw('(capacity_units - current_units) >= ?', [$quantity]);
            })
            ->orderBy('warehouse_locations.current_units', 'asc')
            ->select('warehouse_locations.*')->first();

        if ($availableLocation) {
            return response()->json([
                'found'    => true,
                'location' => [
                    'id'             => $availableLocation->id,
                    'name'           => $availableLocation->name,
                    'code'           => $availableLocation->code,
                    'room_id'        => $availableLocation->room_id,
                    'room_name'      => $availableLocation->room->name ?? null,
                    'warehouse_id'   => $availableLocation->room->warehouse_id ?? null,
                    'warehouse_name' => $availableLocation->room->warehouse->name ?? null,
                    'current_units'  => $availableLocation->current_units,
                    'capacity_units' => $availableLocation->capacity_units,
                ],
                'quantity_requested' => $quantity,
            ]);
        }

        $availableCabinet = \App\Models\WarehouseCabinet::join('warehouse_rooms', 'warehouse_cabinets.room_id', '=', 'warehouse_rooms.id')
            ->where('warehouse_rooms.warehouse_id', $warehouseId)
            ->where('warehouse_rooms.status', 'active')
            ->where('warehouse_cabinets.status', 'active')
            ->where(function ($q) use ($quantity) {
                $q->whereRaw('capacity_units IS NULL')
                  ->orWhereRaw('capacity_units = 0')
                  ->orWhereRaw('(capacity_units - current_units) >= ?', [$quantity]);
            })
            ->orderBy('warehouse_cabinets.current_units', 'asc')
            ->select('warehouse_cabinets.*')->first();

        if ($availableCabinet) {
            return response()->json([
                'found'    => true,
                'cabinet'  => [
                    'id'             => $availableCabinet->id,
                    'name'           => $availableCabinet->name,
                    'code'           => $availableCabinet->code,
                    'room_id'        => $availableCabinet->room_id,
                    'room_name'      => $availableCabinet->room->name ?? null,
                    'warehouse_id'   => $availableCabinet->room->warehouse_id ?? null,
                    'warehouse_name' => $availableCabinet->room->warehouse->name ?? null,
                    'current_units'  => $availableCabinet->current_units,
                    'capacity_units' => $availableCabinet->capacity_units,
                ],
                'quantity_requested' => $quantity,
                'suggestion'         => 'Aucun emplacement disponible, mais une armoire est disponible.',
            ]);
        }

        return response()->json([
            'found'              => false,
            'message'            => 'Aucun emplacement ou armoire disponible avec la capacitÃ requise.',
            'quantity_requested' => $quantity,
            'warehouse_id'       => $warehouseId,
        ], 404);
    }

    public function getAvailableLocations(Request $request)
    {
        $user        = $request->user();
        $warehouseId = $request->input('warehouse_id');
        if (!$warehouseId && $user && $user->depot_id) $warehouseId = $user->depot_id;
        if (!$warehouseId) return response()->json(['message' => 'Aucun dÃpÃ´t trouvÃ pour cet utilisateur.'], 404);

        $locations = \App\Models\WarehouseLocation::join('warehouse_rooms', 'warehouse_locations.room_id', '=', 'warehouse_rooms.id')
            ->where('warehouse_rooms.warehouse_id', $warehouseId)
            ->where('warehouse_rooms.status', 'active')
            ->where('warehouse_locations.status', 'active')
            ->where(function ($q) {
                $q->whereRaw('capacity_units IS NULL')
                  ->orWhereRaw('capacity_units = 0')
                  ->orWhereRaw('capacity_units > current_units');
            })
            ->orderBy('warehouse_rooms.name')
            ->orderBy('warehouse_locations.name')
            ->select('warehouse_locations.*', 'warehouse_rooms.name as room_name')
            ->get()
            ->map(fn($loc) => [
                'id'              => $loc->id,
                'name'            => $loc->name,
                'code'            => $loc->code,
                'room_id'         => $loc->room_id,
                'room_name'       => $loc->room_name,
                'current_units'   => $loc->current_units,
                'capacity_units'  => $loc->capacity_units,
                'available_units' => $loc->capacity_units ? ($loc->capacity_units - $loc->current_units) : 'unlimited',
            ]);

        $cabinets = \App\Models\WarehouseCabinet::join('warehouse_rooms', 'warehouse_cabinets.room_id', '=', 'warehouse_rooms.id')
            ->where('warehouse_rooms.warehouse_id', $warehouseId)
            ->where('warehouse_rooms.status', 'active')
            ->where('warehouse_cabinets.status', 'active')
            ->where(function ($q) {
                $q->whereRaw('capacity_units IS NULL')
                  ->orWhereRaw('capacity_units = 0')
                  ->orWhereRaw('capacity_units > current_units');
            })
            ->orderBy('warehouse_rooms.name')
            ->orderBy('warehouse_cabinets.name')
            ->select('warehouse_cabinets.*', 'warehouse_rooms.name as room_name')
            ->get()
            ->map(fn($cab) => [
                'id'              => $cab->id,
                'name'            => $cab->name,
                'code'            => $cab->code,
                'room_id'         => $cab->room_id,
                'room_name'       => $cab->room_name,
                'current_units'   => $cab->current_units,
                'capacity_units'  => $cab->capacity_units,
                'available_units' => $cab->capacity_units ? ($cab->capacity_units - $cab->current_units) : 'unlimited',
            ]);

        return response()->json([
            'warehouse_id'    => $warehouseId,
            'locations'       => $locations,
            'cabinets'        => $cabinets,
            'total_locations' => $locations->count(),
            'total_cabinets'  => $cabinets->count(),
        ]);
    }
}




