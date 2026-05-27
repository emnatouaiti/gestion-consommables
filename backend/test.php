<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$c = app()->make(\App\Http\Controllers\API\ProductStockController::class);
dump($c->getProductStocks(\App\Models\Product::find(5))->getData(true));
