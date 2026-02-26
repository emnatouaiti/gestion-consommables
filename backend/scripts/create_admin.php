<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

$email = 'admin@example.com';
$plain = 'admin123';

// Use direct DB queries to avoid model global scopes (e.g. SoftDeletes) causing missing column errors
$existing = DB::table('users')->where('email', $email)->first();
if (!$existing) {
    $id = DB::table('users')->insertGetId([
        'nomprenom' => 'Administrateur',
        'email' => $email,
        'password' => Hash::make($plain),
        'role' => 'Administrateur',
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s'),
    ]);
    echo "Created user {$email}\n";
} else {
    DB::table('users')->where('id', $existing->id)->update([
        'password' => Hash::make($plain),
        'role' => 'Administrateur',
        'updated_at' => date('Y-m-d H:i:s'),
    ]);
    $id = $existing->id;
    echo "Updated password for {$email}\n";
}

// Try to load the Eloquent model without global scopes to assign role if possible
$user = null;
try {
    $user = User::withoutGlobalScopes()->where('id', $id)->first();
} catch (\Throwable $e) {
    // ignore: model may still error if schema mismatches; role assignment will be skipped
}

if ($user && class_exists(\Spatie\Permission\Models\Role::class) && \Spatie\Permission\Models\Role::where('name','Administrateur')->exists()) {
    $user->assignRole('Administrateur');
    echo "Assigned role Administrateur to {$email}\n";
} else {
    if (!$user) {
        echo "User model not accessible; role not assigned.\n";
    } else {
        echo "Role Administrateur not found; please run seeders.\n";
    }
}

echo "Done. Credentials: {$email} / {$plain}\n";

// Forget Spatie permission cache to ensure role checks are up-to-date
try {
    if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) {
        \Spatie\Permission\PermissionRegistrar::forgetCachedPermissions();
        echo "Cleared permission cache.\n";
    }
} catch (\Throwable $e) {
    // ignore
}
