<?php

namespace App\Http\Controllers\API;

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

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = Document::with(['product:id,title,reference', 'supplier:id,name', 'warehouse:id,name'])
            ->orderByDesc('id');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->input('product_id'));
        }

        return $query->limit(200)->get();
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
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'supplier_name'=> 'nullable|string|max:255',
            'supplier_email'=> 'nullable|email|max:255',
        ]);

        $path       = $request->file('file')->store('documents', 'public');
        $ocrText    = $this->runTesseract(Storage::disk('public')->path($path));
        $parsed     = $ocrText !== '' ? $this->parseLines($ocrText) : [];
        $guessedType = $request->input('type') ?: ($ocrText !== '' ? $this->guessType($ocrText) : 'document');
        $direction  = $request->input('direction', $ocrText !== '' ? $this->guessDirection($ocrText) : 'unknown');

        if ($direction === 'unknown' && $guessedType === 'bon_livraison') {
            $direction = 'in';
        }

        $autoTitle            = $this->inferTitle($ocrText, $guessedType, $request->file('file')->getClientOriginalName(), $request->input('title'));
        $supplierNameOverride = trim((string) $request->input('supplier_name', $request->input('name', '')));
        $supplierEmailOverride= trim((string) $request->input('supplier_email', ''));

        $ocrSupplierName      = $ocrText !== '' ? $this->guessSupplierName($ocrText) : null;
        $supplierName         = $supplierNameOverride !== '' ? $supplierNameOverride : $ocrSupplierName;
        $supplierEmail        = $supplierEmailOverride !== '' ? $supplierEmailOverride : ($ocrText !== '' ? $this->guessSupplierEmail($ocrText) : null);
        $supplierId           = $request->supplier_id;
        $allowAutoSupplier    = $request->boolean('auto_create_supplier', true);

        $supplierCandidate = null;
        if (!$supplierId && $supplierEmail) {
            $emailMatchId = Supplier::whereRaw('LOWER(email) = ?', [Str::lower($supplierEmail)])->value('id');
            if ($emailMatchId) {
                $emailMatch = Supplier::select(['id', 'name', 'email'])->find($emailMatchId);
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
            && !$request->boolean('confirm_supplier_match', false)
            && !$request->filled('supplier_id')
            && $supplierNameOverride === ''
        ) {
            return response()->json([
                'message' => 'Nous avons trouve un fournisseur. Confirmez d abord si c est le bon fournisseur.',
                'suggested_supplier' => [
                    'name' => $supplierName,
                    'email' => $supplierEmail,
                ],
                'suggested_existing_supplier' => [
                    'id' => $supplierCandidate['id'],
                    'name' => $supplierCandidate['name'],
                    'email' => $supplierCandidate['email'],
                    'score' => $supplierCandidate['score'],
                ],
            ], 409);
        }

        if (!$supplierId && $request->boolean('confirm_supplier_match', false) && $request->filled('supplier_id')) {
            $supplierId = (int) $request->input('supplier_id');
        }

        if (!$supplierId && !$allowAutoSupplier) {
            return response()->json([
                'message' => 'Confirmez le fournisseur avant de persister ce document.',
                'suggested_supplier' => [
                    'name' => $supplierName,
                    'email' => $supplierEmail,
                ],
            ], 409);
        }

        if (!$supplierId && ($supplierName || $supplierEmail)) {
            if (!$allowAutoSupplier) {
                return response()->json([
                    'message' => 'Confirmez le fournisseur avant de persister ce document.',
                    'suggested_supplier' => [
                        'name' => $supplierName,
                        'email' => $supplierEmail,
                    ],
                ], 409);
            }

            $newSupplier = Supplier::create([
                'name'  => $supplierName ?? ($supplierEmail ?? 'Fournisseur OCR'),
                'email' => $supplierEmail,
                'phone' => null,
                'notes' => 'Créé automatiquement depuis OCR',
            ]);
            $supplierId = $newSupplier->id;
        }

        $document = Document::create([
            'user_id'      => optional($request->user())->id,
            'product_id'   => $request->product_id,
            'supplier_id'  => $supplierId,
            'warehouse_id' => $request->warehouse_id,
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

        // Sécuriser direction pour les BL
        if (($document->direction === 'unknown' || !$document->direction) && $document->type === 'bon_livraison') {
            $document->direction = 'in';
        }

        // Exiger un fournisseur confirmé pour les entrées
        if (($document->direction === 'in' || $document->type === 'bon_livraison') && !$document->supplier_id) {
            return response()->json(['message' => 'Sélectionnez un fournisseur avant d\'appliquer ce bon de livraison.'], 422);
        }

        $items = $request->input('items');
        if (!is_array($items) || count($items) === 0) {
            return response()->json(['message' => 'Aucune ligne à appliquer.'], 422);
        }

        $missingProducts = [];
        $prepareActions = [];

        foreach ($items as $item) {
            $title     = trim((string) ($item['title'] ?? ''));
            $reference = trim((string) ($item['reference'] ?? ''));
            $productId = $item['product_id'] ?? null;
            $quantity  = (int) ($item['quantity'] ?? 0);
            $dir       = $item['direction'] ?? $document->direction ?? 'unknown';
            $locId     = $item['warehouse_location_id'] ?? $item['location_id'] ?? null;
            $cabinetId = $item['cabinet_id'] ?? null;

            if ($dir === 'unknown') {
                $guessedDir = $this->guessDirection((string) $document->ocr_text);
                if ($guessedDir !== 'unknown') {
                    $dir = $guessedDir;
                }
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
                    'title' => $title,
                    'reference' => $reference,
                    'category_id' => $categoryId,
                    'quantity' => $quantity,
                    'direction' => $dir,
                    'warehouse_location_id' => $locId,
                    'cabinet_id' => $cabinetId,
                    'product' => null,
                ];
                continue;
            }

            $prepareActions[] = [
                'title' => $title,
                'reference' => $reference,
                'category_id' => $item['categorie_id'] ?? $item['category_id'] ?? null,
                'quantity' => $quantity,
                'direction' => $dir,
                'warehouse_location_id' => $locId,
                'cabinet_id' => $cabinetId,
                'product' => $product,
            ];
        }

        if (count($missingProducts) > 0) {
            return response()->json([
                'message' => 'Des produits sont introuvables. Choisissez une catégorie pour chacun.',
                'suggested_products' => $missingProducts,
            ], 409);
        }

        $allowAutoProduct = $request->boolean('auto_create_product', false);
        if (!$allowAutoProduct && count(array_filter($prepareActions, fn($a) => $a['product'] === null)) > 0) {
            return response()->json(['message' => 'Produit introuvable, confirmation nécessaire avant création.'], 409);
        }

        $validSupplierId = null;
        if ($document->supplier_id && Supplier::whereKey($document->supplier_id)->exists()) {
            $validSupplierId = (int) $document->supplier_id;
        }

        foreach ($prepareActions as $action) {
            $product = $action['product'];
            $locId   = $action['warehouse_location_id'] ?? null;
            $cabinetId = $action['cabinet_id'] ?? null;
            if (!$product) {
                if (!$locId && !$cabinetId) {
                    return response()->json(['message' => 'Choisissez soit un emplacement, soit une armoire pour ce produit.'], 422);
                }
                $catId = $action['category_id'];
                $product = Product::create([
                    'status'        => 'active',
                    'title'         => $action['title'],
                    'reference'     => $action['reference'] !== '' ? $action['reference'] : strtoupper(Str::slug($action['title'])) . '-' . Str::random(4),
                    'seuil_min'     => 0,
                    'stock_quantity'=> 0,
                    'categorie_id'  => $catId,
                    'photo'         => $document->path,
                ]);

                if ($validSupplierId) {
                    $product->suppliers()->syncWithoutDetaching([$validSupplierId]);
                }
            } elseif ($validSupplierId) {
                $product->suppliers()->syncWithoutDetaching([$validSupplierId]);
            }

            $quantity = $action['quantity'];
            $dir = $action['direction'];
            if ($product && $quantity > 0) {
                if ($dir === 'in') {
                    $product->increment('stock_quantity', $quantity);
                } elseif ($dir === 'out') {
                    $product->decrement('stock_quantity', $quantity);
                }

                // Mettre à jour le stock par emplacement si fourni
                if ($locId || $cabinetId) {
                    $ps = ProductStock::firstOrNew(
                        $locId
                            ? [
                                'product_id' => $product->id,
                                'warehouse_location_id' => $locId,
                            ]
                            : [
                                'product_id' => $product->id,
                                'cabinet_id' => $cabinetId,
                            ]
                    );
                    if (!$ps->exists || !$ps->supplier_id) {
                        $ps->supplier_id = $validSupplierId;
                    }
                    if ($cabinetId && !$locId) {
                        $ps->cabinet_id = $cabinetId;
                        $ps->warehouse_location_id = null;
                    }
                    $delta = $dir === 'in' ? $quantity : -$quantity;
                    $ps->quantity = max(0, (int)($ps->quantity ?? 0) + $delta);
                    $ps->last_updated = now();
                    $ps->save();
                }
            }
            if ($product) {
                $document->product_id = $document->product_id ?: $product->id;
            }
        }

        $document->status = 'applied';
        if ($document->direction === 'unknown') {
            $document->direction = $this->guessDirection((string) $document->ocr_text);
        }
        if ($document->direction === 'unknown' && $document->type === 'bon_livraison') {
            $document->direction = 'in';
        }
        $document->save();

        // Create stock movement for this document operation.
        try {
            $movementType = in_array($document->direction, ['in', 'out']) ? $document->direction : 'in';
            $movement = StockMovement::create([
                'movement_type' => $movementType,
                'reference' => 'DOC-' . $document->id,
                'created_by' => optional($request->user())->id,
                'status' => 'executed',
                'supplier_id' => $document->supplier_id,
                'document_id' => $document->id,
                'in_image_path' => $movementType === 'in' ? $document->path : null,
                'out_image_path' => $movementType === 'out' ? $document->path : null,
            ]);

            foreach ($prepareActions as $action) {
                if ($action['product'] && isset($action['quantity']) && (int)$action['quantity'] > 0) {
                    StockMovementLine::create([
                        'stock_movement_id' => $movement->id,
                        'product_id' => $action['product']->id,
                        'quantity' => (int)$action['quantity'],
                    ]);
                }
            }
        } catch (\Throwable $e) {
            // OK si echec, on ne bloque pas l'application du document
            logger()->error('StockMovement creation failed for document apply', ['document_id' => $document->id, 'error' => $e->getMessage()]);
        }

        return response()->json(['message' => 'Document appliqué', 'document' => $document->fresh()]);
    }

    public function update(Request $request, int $id)
    {
        $document = Document::findOrFail($id);

        $request->validate([
            'ocr_lines' => 'nullable|array',
            'ocr_lines.*.reference' => 'nullable|string|max:255',
            'ocr_lines.*.title' => 'nullable|string|max:255',
            'ocr_lines.*.quantity' => 'nullable|numeric|min:0',
            'title' => 'nullable|string|max:255',
            'type' => 'nullable|string|max:100',
            'direction' => 'nullable|in:in,out,unknown',
        ]);

        if ($request->has('ocr_lines')) {
            $document->ocr_lines = $request->input('ocr_lines', []);
        }

        if ($request->filled('title')) {
            $document->title = $request->input('title');
        }
        if ($request->filled('type')) {
            $document->type = $request->input('type');
        }
        if ($request->filled('direction')) {
            $document->direction = $request->input('direction');
        }

        $document->save();

        return response()->json($document);
    }

    public function diagnostic(Request $request)
    {
        try {
            $count = Document::count();
            $last = Document::with(['product:id,title', 'supplier:id,name', 'warehouse:id,name'])->latest()->first();

            return response()->json([
                'status' => 'ok',
                'document_count' => $count,
                'last_document' => $last,
                'database' => config('database.default'),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Erreur de diagnostic documents',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function inferTitle(string $ocrText, ?string $guessedType, string $fallbackName, ?string $userTitle): string
    {
        $cleanUser = trim((string) $userTitle);
        if ($cleanUser !== '' && !preg_match('/^(capture|img|image|scan|eya)$/i', $cleanUser)) {
            return $cleanUser;
        }

        $text = Str::lower($ocrText);
        if (str_contains($text, 'bon de livraison') || $guessedType === 'bon_livraison') {
            return 'Bon de livraison';
        }
        if (str_contains($text, 'bon de reception') || str_contains($text, 'bon de réception')) {
            return 'Bon de réception';
        }
        if (str_contains($text, 'bon de sortie')) {
            return 'Bon de sortie';
        }
        if (str_contains($text, 'réception de marchandise') || str_contains($text, 'reception de marchandise')) {
            return 'Bon de réception';
        }
        if (str_contains($text, 'facture')) {
            return 'Facture';
        }

        $first = $this->firstLine($ocrText);
        return $first ?: $fallbackName;
    }

    private function runTesseract(string $fullPath): string
    {
        $source = $this->preprocessImage($fullPath);

        $candidates = [
            env('TESSERACT_PATH'),
            'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
            'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
            '/usr/bin/tesseract',
            '/usr/local/bin/tesseract',
            'tesseract',
        ];

        $binary = collect($candidates)
            ->filter()
            ->first(fn($path) => is_string($path) && (file_exists($path) || trim($path) === 'tesseract'));

        if (!$binary) {
            return '';
        }

        $isWindows  = stripos(PHP_OS_FAMILY, 'Windows') !== false;
        $binArg     = $isWindows ? '"' . $binary . '"' : escapeshellarg($binary);
        $langs      = ['fra+eng', 'fra', 'eng'];
        $psmOptions = [4, 6, 11, 12, 1];

        foreach ($langs as $lang) {
            foreach ($psmOptions as $psm) {
                $fileArg = $isWindows ? '"' . $source . '"' : escapeshellarg($source);
                $cmd = $binArg . ' ' . $fileArg . ' stdout -l ' . $lang
                    . ' --psm ' . $psm . ' --oem 1'
                    . ' -c preserve_interword_spaces=1'
                    . ' -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789éèêàâùûçÉÈÊÀÂÙÛÇ.:/_-'
                    . ' -c user_defined_dpi=300';

                $tdp = env('TESSDATA_PREFIX');
                if ($tdp) {
                    if ($isWindows) {
                        $cmd = 'set "TESSDATA_PREFIX=' . $tdp . '" && ' . $cmd;
                    } else {
                        $cmd = 'TESSDATA_PREFIX=' . escapeshellarg($tdp) . ' ' . $cmd;
                    }
                }
                $cmd .= $isWindows ? ' 2>&1' : ' 2>/dev/null';

                $out = @shell_exec($cmd);
                if (is_string($out)) {
                    $trimmed = trim($out);
                    if ($trimmed !== '' && !str_contains($trimmed, 'Error opening data file')) {
                        if ($source !== $fullPath && file_exists($source)) {
                            @unlink($source);
                        }
                        return $trimmed;
                    }
                }
            }
        }

        if ($source !== $fullPath && file_exists($source)) {
            @unlink($source);
        }

        return '';
    }

    private function preprocessImage(string $fullPath): string
    {
        if (!class_exists(\Imagick::class)) {
            $converted = $this->preprocessWithMagick($fullPath);
            return $converted ?: $fullPath;
        }

        try {
            $img = new \Imagick($fullPath);
            $img->setImageColorspace(\Imagick::COLORSPACE_GRAY);
            $img->deskewImage(0.4);
            $w = $img->getImageWidth();
            $h = $img->getImageHeight();
            $img->resizeImage((int)($w * 1.8), (int)($h * 1.8), \Imagick::FILTER_LANCZOS, 1);
            $img->contrastStretchImage(0.02, 0.02);
            $img->stripImage();

            $tmp = tempnam(sys_get_temp_dir(), 'ocr_') . '.tif';
            $img->writeImage($tmp);
            $img->clear();
            $img->destroy();

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
        if (!$hasBinary) {
            return null;
        }

        $tmp = tempnam(sys_get_temp_dir(), 'ocr_') . '.png';
        $cmd = sprintf(
            '"%s" %s -density 300 -resample 300x300 -deskew 40%% -resize 220%% -colorspace Gray -contrast-stretch 2%%x2%% -alpha remove -background white +repage -strip %s',
            $magick,
            escapeshellarg($fullPath),
            escapeshellarg($tmp)
        );
        @shell_exec($cmd);
        return file_exists($tmp) ? $tmp : null;
    }

    private function parseLines(string $text): array
    {
        $lines  = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $text)));
        $parsed = [];

        foreach ($lines as $line) {
            $clean = preg_replace('/[\|\[\]\(\)_]+/', ' ', $line);
            $clean = preg_replace('/[^\p{L}\d\.\-\s]/u', ' ', $clean);
            $clean = preg_replace('/\s+/', ' ', $clean);
            $clean = trim((string) $clean);
            if ($clean === '') {
                continue;
            }

            $tokens = preg_split('/\s+/', $clean);
            if (count($tokens) < 2) {
                continue;
            }

            $qtyToken = end($tokens);
            $qty      = null;
            $ordered  = null;

            // cas tableau : ref + titre + qtyCommandée + qtyLivrée
            if (count($tokens) >= 4 && is_numeric($qtyToken) && is_numeric($tokens[count($tokens) - 2])) {
                $qty     = (int) $qtyToken;                      // livré
                $ordered = (int) $tokens[count($tokens) - 2];    // commandé
                array_pop($tokens);
                array_pop($tokens);
            } elseif (is_numeric($qtyToken)) {
                $qty = (int) $qtyToken;
                array_pop($tokens);
            }

            if ($qty === null || $qty <= 0 || $qty > 10000) {
                continue;
            }

            $ref   = null;
            $first = $tokens[0];

            if (preg_match('/^(\d+)([A-Za-z\p{L}].*)$/u', $first, $m)) {
                $ref       = $m[1];
                $tokens[0] = trim($m[2]);
            } elseif (preg_match('/^[A-Za-z0-9]+$/', $first)) {
                $ref = array_shift($tokens);
            } else {
                foreach ($tokens as $i => $tok) {
                    if (preg_match('/(?=.*\d)(?=.*[A-Za-z\p{L}]).+/', $tok)) {
                        $ref = $tok;
                        unset($tokens[$i]);
                        break;
                    }
                }
            }

            $title = trim(implode(' ', $tokens));
            $title = str_ireplace(['gelmain'], ['gel a main'], $title);
            $title = trim(preg_replace('/\d+$/', '', $title));
            if ($title === '') {
                continue;
            }

            $parsed[] = [
                'reference'        => $ref,
                'title'            => $title,
                'quantity'         => $qty,
                'ordered_quantity' => $ordered,
            ];
        }

        return $parsed;
    }

    private function firstLine(string $text): ?string
    {
        $lines = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $text)));
        return $lines ? mb_substr(array_values($lines)[0], 0, 120) : null;
    }

    private function guessSupplierName(string $text): ?string
    {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $text))));

        $blacklist = [
            'bondelivraison', 'bon de livraison', 'bon de sortie', 'bon de reception',
            'detailsdelalivraison', 'details de la livraison', 'reference', 'date',
            'adresse', 'contact', 'email', 'e mail', 'destinataire', 'nomduclient',
            'nom du client', 'adresse de livraison', 'datedelivraison', 'signatureclient',
        ];

        foreach ($lines as $index => $line) {
            $normalized = $this->normalizeSupplierValue($line);
            if ($normalized === '' || in_array($normalized, $blacklist, true)) {
                continue;
            }

            $previous = $index > 0 ? $this->normalizeSupplierValue($lines[$index - 1]) : '';
            $next = $index < count($lines) - 1 ? $this->normalizeSupplierValue($lines[$index + 1]) : '';

            if (
                in_array($previous, ['bondelivraison', 'bon de livraison', 'bon', 'bon de reception'], true)
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
                && mb_strlen($line) <= 60
                && $normalized !== ''
                && !in_array($normalized, $blacklist, true)
                && !$this->looksLikeAddressOrContact($normalized)
            ) {
                return $line;
            }
        }
        return null;
    }

    private function guessSupplierEmail(string $text): ?string
    {
        if (preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $text, $m)) {
            return strtolower($m[0]);
        }
        return null;
    }

    private function guessDirection(string $text): string
    {
        $t = Str::lower($text);
        if (preg_match('/bon\s*de\s*livraison|bondelivraison|r[eé]ception|entree|entr[eé]/iu', $t)) {
            return 'in';
        }
        if (preg_match('/bon\s*de\s*sortie|bonsortie|sortie/iu', $t)) {
            return 'out';
        }
        return 'unknown';
    }

    private function guessType(string $text): string
    {
        $t = Str::lower($text);
        if (preg_match('/bon\s*de\s*livraison|bondelivraison/iu', $t)) {
            return 'bon_livraison';
        }
        if (preg_match('/bon\s*de\s*sortie|bonsortie/iu', $t)) {
            return 'bon_sortie';
        }
        return 'document';
    }

    private function findMatchingSupplier(?string $supplierName, ?string $supplierEmail = null): array
    {
        $normalizedName = $this->normalizeSupplierValue($supplierName);
        if ($normalizedName === '') {
            return ['status' => 'none'];
        }

        $suppliers = Supplier::query()
            ->select(['id', 'name', 'email'])
            ->get();

        $bestId = null;
        $bestScore = 0;

        foreach ($suppliers as $supplier) {
            if ($supplierEmail && $supplier->email && Str::lower((string) $supplier->email) === Str::lower((string) $supplierEmail)) {
                return [
                    'status' => 'exact',
                    'id' => (int) $supplier->id,
                    'name' => $supplier->name,
                    'email' => $supplier->email,
                    'score' => 100,
                ];
            }

            $candidate = $this->normalizeSupplierValue($supplier->name);
            if ($candidate === '') {
                continue;
            }

            if ($candidate === $normalizedName) {
                return [
                    'status' => 'exact',
                    'id' => (int) $supplier->id,
                    'name' => $supplier->name,
                    'email' => $supplier->email,
                    'score' => 100,
                ];
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
                $bestId = [
                    'id' => (int) $supplier->id,
                    'name' => $supplier->name,
                    'email' => $supplier->email,
                    'score' => $score,
                ];
            }
        }

        if ($bestScore >= 92 && is_array($bestId)) {
            return ['status' => 'exact', ...$bestId];
        }

        if ($bestScore >= 78 && is_array($bestId)) {
            return ['status' => 'candidate', ...$bestId];
        }

        return ['status' => 'none'];
    }

    private function normalizeSupplierValue(?string $value): string
    {
        $normalized = Str::of((string) $value)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->trim()
            ->value();

        if ($normalized === '') {
            return '';
        }

        $stopWords = [
            'ste', 'st', 'sarl', 'suarl', 'sa', 'sas', 'eurl', 'societe',
            'soc', 'company', 'co', 'ltd', 'limited', 'inc', 'groupe',
            'group', 'tunisie', 'tn',
        ];

        $parts = array_values(array_filter(
            preg_split('/\s+/', $normalized) ?: [],
            fn($part) => $part !== '' && !in_array($part, $stopWords, true)
        ));

        return implode(' ', $parts);
    }

    private function findSupplierIdFromHistory(?string $ocrSupplierName): ?int
    {
        $normalized = $this->normalizeSupplierValue($ocrSupplierName);
        if ($normalized === '') {
            return null;
        }

        $documents = Document::query()
            ->whereNotNull('supplier_id')
            ->whereNotNull('ocr_text')
            ->latest('id')
            ->limit(100)
            ->get(['supplier_id', 'ocr_text']);

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
}
