<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Spatie\Permission\Models\Role;

$roles = ['Administrateur', 'Agent', 'Responsable', 'Directeur', 'Employé', 'Utilisateur'];

foreach ($roles as $roleName) {
    if (!Role::where('name', $roleName)->exists()) {
        Role::create(['name' => $roleName, 'guard_name' => 'web']);
        echo "Created role: $roleName\n";
    } else {
        echo "Role exists: $roleName\n";
    }
}
echo "Done.\n";
