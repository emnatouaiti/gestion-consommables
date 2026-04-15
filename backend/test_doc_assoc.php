<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\StockMovement;
use App\Models\Document;
use Illuminate\Support\Facades\DB;

try {
    DB::beginTransaction();
    
    $m = StockMovement::create([
        'movement_type' => 'in',
        'reference' => 'TEST-AUTO-DOC-' . uniqid(),
        'in_image_path' => 'stock-movements/in/test-auto.pdf',
        'status' => 'draft'
    ]);
    
    $m->lines()->create(['product_id' => 1, 'quantity' => 5]);
    
    // Trigger the same logic as in Controller
    $imagePath = $m->in_image_path ?: $m->out_image_path;
    if ($imagePath) {
        $pids = $m->lines()->pluck('product_id')->unique();
        foreach ($pids as $pid) {
            Document::create([
                'product_id' => $pid,
                'path' => $imagePath,
                'title' => 'Test Auto Doc',
                'direction' => 'in',
                'status' => 'applied'
            ]);
        }
    }
    
    $count = Document::where('path', 'stock-movements/in/test-auto.pdf')->count();
    echo "SUCCESS: Created $count documents for path test-auto.pdf\n";
    
    DB::commit();
} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
