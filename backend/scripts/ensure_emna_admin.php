<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'emna@gmail.com';
$plain = 'Admin@1234';

$user = User::where('email', $email)->first();
if (!$user) {
    $user = User::create([
        'nomprenom' => 'Emna Admin',
        'email' => $email,
        'password' => Hash::make($plain),
    ]);
    echo "Created user {$email}\n";
} else {
    $user->password = Hash::make($plain);
    $user->save();
    echo "Updated password for {$email}\n";
}

// Assign role Administrateur if exists
if (class_exists(\Spatie\Permission\Models\Role::class) && \Spatie\Permission\Models\Role::where('name','Administrateur')->exists()) {
    $user->assignRole('Administrateur');
    echo "Assigned role Administrateur to {$email}\n";
} else {
    echo "Role Administrateur not found; please run seeders.\n";
}

echo "Done. Credentials: {$email} / {$plain}\n";
