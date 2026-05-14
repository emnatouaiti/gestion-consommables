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
        // Create an admin user
        User::factory()->create([
            'nomprenom' => 'Admin User',
            'email' => 'admin@example.com',
            'role' => 'Administrateur',
        ]);

        // Also keep a regular test user
        User::factory()->create([
            'nomprenom' => 'Test User',
            'email' => 'test@example.com',
            'role' => 'Utilisateur',
        ]);
    }
}
