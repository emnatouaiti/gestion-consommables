<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->handle($request = Illuminate\Http\Request::capture());

$stocks = \App\Models\ProductStock::with('warehouseLocation', 'warehouseCabinet')->get();

echo "Total stocks: " . $stocks->count() . "\n\n";

foreach ($stocks as $stock) {
    echo "Stock ID: " . $stock->id . "\n";
    echo "warehouse_location_id: " . ($stock->warehouse_location_id ?? 'null') . "\n";
    echo "cabinet_id: " . ($stock->cabinet_id ?? 'null') . "\n";

    if ($stock->warehouseLocation) {
        echo "Location Code: " . $stock->warehouseLocation->code . "\n";
        echo "Location Name: " . $stock->warehouseLocation->name . "\n";
    } else {
        echo "Location: null\n";
    }

    if ($stock->warehouseCabinet) {
        echo "Cabinet Code: " . $stock->warehouseCabinet->code . "\n";
        echo "Cabinet Name: " . $stock->warehouseCabinet->name . "\n";
    } else {
        echo "Cabinet: null\n";
    }
    echo "---\n\n";
}
