<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$p = App\Models\Product::with('suppliers')->latest()->first();
echo json_encode(['id' => $p->id, 'suppliers' => $p->suppliers->pluck('id')]);
