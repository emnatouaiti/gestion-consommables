<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Product;

$p = Product::where('title', 'like', '%carrorios%')->first();
if ($p) {
    echo "Product ID: " . $p->id . "\n";
    echo "Title: " . $p->title . "\n";
    echo "Status: " . $p->status . "\n";
    echo "Stock Quantity: " . $p->stock_quantity . "\n";
    echo "WH Location ID: " . ($p->warehouse_location_id ?: 'NULL') . "\n";
    echo "Stocks Count: " . $p->stocks()->count() . "\n";
    foreach ($p->stocks as $s) {
        echo " - Stock ID: " . $s->id . ", Qty: " . $s->quantity . ", Loc ID: " . ($s->warehouse_location_id ?: 'NULL') . ", Cab ID: " . ($s->cabinet_id ?: 'NULL') . "\n";
        $loc = $s->warehouseLocation;
        $cab = $s->warehouseCabinet;
        $room = ($loc ? $loc->room : ($cab ? $cab->room : null));
        $wh = ($room ? $room->warehouse : null);
        
        echo "   Room: " . ($room ? $room->name : 'N/A') . " (ID: " . ($room ? $room->id : 'N/A') . ")\n";
        echo "   WH: " . ($wh ? $wh->name : 'N/A') . " (ID: " . ($wh ? $wh->id : 'N/A') . ")\n";
    }
} else {
    echo "Product 'carrorios' not found\n";
}
