<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Str;

$email = 'emnatouaiti56@gmail.com'; // Role: Responsable
$user = User::where('email', $email)->first();

if (!$user) {
    die("User not found\n");
}

$user->load('role');
echo "User: " . $user->nomprenom . "\n";
echo "Role from relation: '" . ($user->role?->name) . "'\n";

$role_middleware_string = 'Administrateur|Directeur|Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent|Validateur';

$roles = collect(explode('|', $role_middleware_string))
    ->map(fn ($r) => trim($r))
    ->filter()
    ->values()
    ->all();

echo "Allowed roles: " . implode(', ', $roles) . "\n";

$hasRole = false;
$userRole = Str::lower($user->role?->name ?? '');
echo "User role (lower): '$userRole'\n";

foreach ($roles as $role) {
    $target = Str::lower($role);
    if ($userRole === $target) {
        $hasRole = true;
        echo "Match found: '$userRole' === '$target'\n";
        break;
    }
}

if ($hasRole) {
    echo "Access Granted\n";
} else {
    echo "Access Denied\n";
}
