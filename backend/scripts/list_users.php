<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$users = User::all();
if ($users->isEmpty()) {
    echo "No users found\n";
    exit(0);
}

foreach ($users as $u) {
    echo sprintf("%d | %s | %s | %s\n", $u->id, $u->nomprenom ?? '-', $u->email, $u->created_at);
}
