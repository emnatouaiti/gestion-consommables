<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$users = User::with('role')->get();
$data = [];
foreach ($users as $user) {
    if (!$user->role) continue;
    $data[] = [
        'id' => $user->id,
        'nomprenom' => $user->nomprenom,
        'email' => $user->email,
        'role' => $user->role->name,
        'role_id' => $user->role_id
    ];
}
echo json_encode($data, JSON_PRETTY_PRINT);
