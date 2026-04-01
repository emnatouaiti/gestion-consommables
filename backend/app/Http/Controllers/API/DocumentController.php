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
        $supplierName         = $ocrText !== '' ? $this->guessSupplierName($ocrText) : null;
        $supplierEmail        = $ocrText !== '' ? $this->guessSupplierEmail($ocrText) : null;
        $supplierId           = $request->supplier_id;
        $allowAutoSupplier    = $request->boolean('auto_create_supplier', true);

        if (!$supplierId && $supplierEmail) {
            $supplierId = Supplier::whereRaw('LOWER(email) = ?', [Str::lower($supplierEmail)])->value('id');
        }
        if (!$supplierId && $supplierName) {
            $supplierId = Supplier::whereRaw('LOWER(name) = ?', [Str::lower($supplierName)])->value('id');
        }

        if (!$supplierId && ($supplierName || $supplierEmail)) {
            if (!$allowAutoSupplier) {
                return response()->json([
                    'message' => 'Fournisseur trouvé par OCR mais la création automatique est désactivée. Confirmez avant de persister.',
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

        foreach ($prepareActions as $action) {
            $product = $action['product'];
            if (!$product) {
                $catId = $action['category_id'];
                $product = Product::create([
                    'status'        => 'active',
                    'title'         => $action['title'],
                    'reference'     => $action['reference'] !== '' ? $action['reference'] : strtoupper(Str::slug($action['title'])) . '-' . Str::random(4),
                    'seuil_min'     => 0,
                    'stock_quantity'=> 0,
                    'categorie_id'  => $catId,
                    'supplier_id'   => $document->supplier_id,
                    'photo'         => $document->path,
                ]);
            }

            $quantity = $action['quantity'];
            $dir = $action['direction'];
            if ($product && $quantity > 0) {
                if ($dir === 'in') {
                    $product->increment('stock_quantity', $quantity);
                } elseif ($dir === 'out') {
                    $product->decrement('stock_quantity', $quantity);
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
        foreach ($lines as $line) {
            if (preg_match('/^[\p{L}][\p{L}\s\-\.\d@]+$/u', $line) && mb_strlen($line) <= 60) {
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
}


