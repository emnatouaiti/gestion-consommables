<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use App\Models\Role;

$roles = Role::all();
$data = [];
foreach ($roles as $role) {
    $data[] = [
        'id' => $role->id,
        'name' => $role->name,
        'hex' => bin2hex($role->name)
    ];
}
echo json_encode($data, JSON_PRETTY_PRINT);
