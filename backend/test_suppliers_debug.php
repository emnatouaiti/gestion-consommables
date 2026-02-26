#!/usr/bin/env php
<?php
/**
 * Script de test pour les endpoints Suppliers
 * Usage: php artisan tinker < test.php
 */

use Illuminate\Support\Facades\Route;

// Test 1: Vérifier les tables
echo "=== Vérification des tables ===\n";
try {
    $suppliers = DB::table('suppliers')->count();
    echo "✓ Suppliers table: $suppliers records\n";
} catch (\Exception $e) {
    echo "✗ Suppliers table error: " . $e->getMessage() . "\n";
}

try {
    $reviews = DB::table('supplier_reviews')->count();
    echo "✓ Supplier_reviews table: $reviews records\n";
} catch (\Exception $e) {
    echo "✗ Supplier_reviews table error: " . $e->getMessage() . "\n";
}

try {
    $pivot = DB::table('product_supplier')->count();
    echo "✓ Product_supplier table: $pivot records\n";
} catch (\Exception $e) {
    echo "✗ Product_supplier table error: " . $e->getMessage() . "\n";
}

// Test 2: Premier fournisseur
echo "\n=== Chargement premier fournisseur ===\n";
try {
    $supplier = \App\Models\Supplier::with('products', 'reviews.user')->first();
    if ($supplier) {
        echo "✓ Supplier: {$supplier->name}\n";
        echo "  - Products: " . $supplier->products->count() . "\n";
        echo "  - Reviews: " . $supplier->reviews->count() . "\n";
        if ($supplier->reviews->count() > 0) {
            $first_review = $supplier->reviews->first();
            echo "  - First review user: " . ($first_review->user?->name ?? 'null') . "\n";
        }
    } else {
        echo "✗ Aucun fournisseur trouvé\n";
    }
} catch (\Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "  File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "  Stack: " . substr($e->getTraceAsString(), 0, 200) . "\n";
}

// Test 3: Contrôleur directement
echo "\n=== Test du contrôleur ===\n";
try {
    $supplier = \App\Models\Supplier::first();
    if ($supplier) {
        $controller = new \App\Http\Controllers\API\SupplierController();
        $response = $controller->show($supplier);

        // Si c'est une réponse JsonResponse
        if (method_exists($response, 'getData')) {
            $data = $response->getData();
            echo "✓ Contrôleur response OK\n";
            echo "  - Products: " . (isset($data->products) ? count($data->products) : 'N/A') . "\n";
            echo "  - Reviews: " . (isset($data->reviews) ? count($data->reviews) : 'N/A') . "\n";
        } else {
            echo "✓ Contrôleur response OK (Model)\n";
            echo "  - Products: " . $response->products->count() . "\n";
            echo "  - Reviews: " . $response->reviews->count() . "\n";
        }
    }
} catch (\Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "  File: " . $e->getFile() . ":" . $e->getLine() . "\n";
}

echo "\n✓ Tests complétés\n";
?>
