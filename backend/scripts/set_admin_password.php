<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'admin@example.com';
$new = 'Admin@1234';

$user = User::where('email', $email)->first();
if (!$user) {
    echo "User $email not found\n";
    exit(1);
}

$user->password = Hash::make($new);
$user->save();

echo "Password for $email set to: $new\n";
