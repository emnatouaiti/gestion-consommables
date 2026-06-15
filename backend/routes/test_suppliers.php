<?php
/**
 * Test script pour vÃrifier les endpoints des fournisseurs
 * Ã€ utiliser avec php artisan tinker ou via une route
 */

// Pour faire des tests rapides:
// php artisan tinker
// >>> Artisan::call('migrate:fresh'); // Optionnel
// >>> include 'routes/test_suppliers.php';

echo "=== Test Suppliers API ===\n";

// VÃrifier la structure de la table
DB::statement('DESCRIBE supplier_reviews') ? print "aœ" Table supplier_reviews OK\n" : print "aœ- Table supplier_reviews manquante\n";
DB::statement('DESCRIBE product_supplier') ? print "aœ" Table product_supplier OK\n" : print "aœ- Table product_supplier manquante\n";

// Test des relations
$supplier = \App\Models\Supplier::first();
if ($supplier) {
    echo "\n=== Test avec Supplier ID {$supplier->id} ===\n";

    // Test products relation
    $products = $supplier->products;
    echo "aœ" Products count: " . count($products) . "\n";

    // Test reviews relation
    $reviews = $supplier->reviews;
    echo "aœ" Reviews count: " . count($reviews) . "\n";

    if (count($reviews) > 0) {
        $review = $reviews->first();
        echo "  - Review User: " . $review->user?->name ?? 'null' . "\n";
    }
} else {
    echo "aœ- Aucun fournisseur trouvÃ\n";
}

echo "\n=== Test Produit avec Suppliers ===\n";
$product = \App\Models\Product::first();
if ($product) {
    echo "aœ" Product: {$product->title}\n";
    $suppliers = $product->suppliers;
    echo "aœ" Suppliers count: " . count($suppliers) . "\n";
    foreach ($suppliers as $s) {
        echo "  - {$s->name}\n";
    }
} else {
    echo "aœ- Aucun produit trouvÃ\n";
}

echo "\naœ" Tests complÃtÃs\n";
