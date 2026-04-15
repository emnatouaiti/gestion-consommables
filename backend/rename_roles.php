<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Spatie\Permission\Models\Role;

$r = Role::where('name', 'Responsable')->first();
if ($r) { $r->name = 'Responsable de stock'; $r->save(); echo "Updated Responsable\n"; }
else { echo "Responsable not found\n"; }

$a = Role::where('name', 'Agent')->first();
if ($a) { $a->name = 'Agent de stock'; $a->save(); echo "Updated Agent\n"; }
else { echo "Agent not found\n"; }

echo "Done.\n";
