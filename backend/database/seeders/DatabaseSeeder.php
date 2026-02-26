<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);
        // User::factory(10)->create();

        // Create an admin user
        $admin = User::factory()->create([
            'nomprenom' => 'Admin User',
            'email' => 'admin@example.com',
        ]);

        // Assign Administrateur role if exists
        if (\Spatie\Permission\Models\Role::where('name', 'Administrateur')->exists()) {
            $admin->assignRole('Administrateur');
        }

        // Also keep a regular test user
        User::factory()->create([
            'nomprenom' => 'Test User',
            'email' => 'test@example.com',
        ]);
    }
}
