<?php
/**
 * Test script pour vérifier les endpoints des fournisseurs
 * À utiliser avec php artisan tinker ou via une route
 */

// Pour faire des tests rapides:
// php artisan tinker
// >>> Artisan::call('migrate:fresh'); // Optionnel
// >>> include 'routes/test_suppliers.php';

echo "=== Test Suppliers API ===\n";

// Vérifier la structure de la table
DB::statement('DESCRIBE supplier_reviews') ? print "✓ Table supplier_reviews OK\n" : print "✗ Table supplier_reviews manquante\n";
DB::statement('DESCRIBE product_supplier') ? print "✓ Table product_supplier OK\n" : print "✗ Table product_supplier manquante\n";

// Test des relations
$supplier = \App\Models\Supplier::first();
if ($supplier) {
    echo "\n=== Test avec Supplier ID {$supplier->id} ===\n";

    // Test products relation
    $products = $supplier->products;
    echo "✓ Products count: " . count($products) . "\n";

    // Test reviews relation
    $reviews = $supplier->reviews;
    echo "✓ Reviews count: " . count($reviews) . "\n";

    if (count($reviews) > 0) {
        $review = $reviews->first();
        echo "  - Review User: " . $review->user?->name ?? 'null' . "\n";
    }
} else {
    echo "✗ Aucun fournisseur trouvé\n";
}

echo "\n=== Test Produit avec Suppliers ===\n";
$product = \App\Models\Product::first();
if ($product) {
    echo "✓ Product: {$product->title}\n";
    $suppliers = $product->suppliers;
    echo "✓ Suppliers count: " . count($suppliers) . "\n";
    foreach ($suppliers as $s) {
        echo "  - {$s->name}\n";
    }
} else {
    echo "✗ Aucun produit trouvé\n";
}

echo "\n✓ Tests complétés\n";
