<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // create permissions
        $permissions = [
            'view users',
            'create users',
            'edit users',
            'delete users',
            'view roles',
            'manage settings',
            'view audit logs',
            'validate actions' // For "Validateur" role
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // create roles and assign created permissions

        // User
        $role = Role::firstOrCreate(['name' => 'Utilisateur']);
        // Users can maybe view their own profile, handled by logic, specific permissions can be added here if needed

        // Manager
        $role = Role::firstOrCreate(['name' => 'Gestionnaire']);
        $role->givePermissionTo(['view users', 'create users', 'edit users']);

        // Validator
        $role = Role::firstOrCreate(['name' => 'Validateur']);
        $role->givePermissionTo(['view users', 'validate actions']);

        // Admin
        $role = Role::firstOrCreate(['name' => 'Administrateur']);
        $role->givePermissionTo(Permission::all());
    }
}
