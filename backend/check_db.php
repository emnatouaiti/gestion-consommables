<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$reqs = App\Models\ConsumableRequest::latest()->take(10)->get();
foreach($reqs as $r) {
    echo "ID:{$r->id} | Batch:{$r->batch_code} | Item:{$r->item_name} | Status:{$r->status} | Qty:{$r->approved_quantity}\n";
}
