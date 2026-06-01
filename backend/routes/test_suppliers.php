<?php
/**
 * Test script pour vÃ©rifier les endpoints des fournisseurs
 * Ã€ utiliser avec php artisan tinker ou via une route
 */

// Pour faire des tests rapides:
// php artisan tinker
// >>> Artisan::call('migrate:fresh'); // Optionnel
// >>> include 'routes/test_suppliers.php';

echo "=== Test Suppliers API ===\n";

// VÃ©rifier la structure de la table
DB::statement('DESCRIBE supplier_reviews') ? print "âœ“ Table supplier_reviews OK\n" : print "âœ— Table supplier_reviews manquante\n";
DB::statement('DESCRIBE product_supplier') ? print "âœ“ Table product_supplier OK\n" : print "âœ— Table product_supplier manquante\n";

// Test des relations
$supplier = \App\Models\Supplier::first();
if ($supplier) {
    echo "\n=== Test avec Supplier ID {$supplier->id} ===\n";

    // Test products relation
    $products = $supplier->products;
    echo "âœ“ Products count: " . count($products) . "\n";

    // Test reviews relation
    $reviews = $supplier->reviews;
    echo "âœ“ Reviews count: " . count($reviews) . "\n";

    if (count($reviews) > 0) {
        $review = $reviews->first();
        echo "  - Review User: " . $review->user?->name ?? 'null' . "\n";
    }
} else {
    echo "âœ— Aucun fournisseur trouvÃ©\n";
}

echo "\n=== Test Produit avec Suppliers ===\n";
$product = \App\Models\Product::first();
if ($product) {
    echo "âœ“ Product: {$product->title}\n";
    $suppliers = $product->suppliers;
    echo "âœ“ Suppliers count: " . count($suppliers) . "\n";
    foreach ($suppliers as $s) {
        echo "  - {$s->name}\n";
    }
} else {
    echo "âœ— Aucun produit trouvÃ©\n";
}

echo "\nâœ“ Tests complÃ©tÃ©s\n";
