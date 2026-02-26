<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\User;

$email = 'emna@gmail.com';
$user = User::where('email', $email)->first();
if (!$user) {
    echo "User not found: {$email}\n";
    exit(1);
}

echo "User id: {$user->id}, email: {$user->email}\n";
$rows = DB::table('model_has_roles')->where('model_id', $user->id)->get();
if ($rows->isEmpty()) {
    echo "No roles assigned to user {$email}\n";
} else {
    foreach ($rows as $r) {
        echo json_encode((array)$r) . "\n";
    }
}

// Also show roles table entries
$roles = DB::table('roles')->get();
echo "\nRoles in DB:\n";
foreach ($roles as $role) {
    echo json_encode((array)$role) . "\n";
}
