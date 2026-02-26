<?php

namespace Tests\Feature;

use App\Models\ConsumableRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConsumableRequestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        \Spatie\Permission\Models\Role::create(['name' => 'directeur']);
        \Spatie\Permission\Models\Role::create(['name' => 'responsable']);
        \Spatie\Permission\Models\Role::create(['name' => 'agent']);
        \Spatie\Permission\Models\Role::create(['name' => 'utilisateur']);
        \Spatie\Permission\Models\Role::create(['name' => 'employee']);
        \Spatie\Permission\Models\Role::create(['name' => 'pdg']);
    }

    public function test_user_can_create_consumable_request(): void
    {
        $user = User::factory()->create();
        $user->assignRole('utilisateur');

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/consumable-requests', [
            'item_name' => 'Papier A4',
            'requested_quantity' => 100,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['id', 'user_id', 'item_name', 'requested_quantity', 'status'])
            ->assertJson([
                'item_name' => 'Papier A4',
                'requested_quantity' => 100,
                'status' => 'pending'
            ]);

        $this->assertDatabaseHas('consumable_requests', [
            'item_name' => 'Papier A4',
            'requested_quantity' => 100,
        ]);
    }

    public function test_responsable_cannot_approve_request(): void
    {
        $user = User::factory()->create();
        $responsable = User::factory()->create();
        $responsable->assignRole('responsable');

        $request = ConsumableRequest::create([
            'user_id' => $user->id,
            'item_name' => 'Stylos',
            'requested_quantity' => 50,
            'status' => 'pending'
        ]);

        $response = $this->actingAs($responsable, 'sanctum')->putJson("/api/consumable-requests/{$request->id}/approve");

        $response->assertStatus(403);
    }

    public function test_directeur_approves_full_quantity_for_pdg_requester(): void
    {
        $user = User::factory()->create(['service' => 'Direction', 'poste' => 'PDG']);
        $user->assignRole('pdg');

        $directeur = User::factory()->create();
        $directeur->assignRole('directeur');

        $request = ConsumableRequest::create([
            'user_id' => $user->id,
            'item_name' => 'Cahiers',
            'requested_quantity' => 100,
            'status' => 'pending'
        ]);

        $this->actingAs($directeur, 'sanctum')->putJson("/api/consumable-requests/{$request->id}/approve");

        $this->assertDatabaseHas('consumable_requests', [
            'id' => $request->id,
            'approved_quantity' => 100,
            'status' => 'approved'
        ]);
    }

    public function test_directeur_caps_quantity_to_two_for_normal_employee(): void
    {
        $user = User::factory()->create(['service' => 'Operations', 'poste' => 'Employe']);
        $user->assignRole('employee');

        $directeur = User::factory()->create();
        $directeur->assignRole('directeur');

        $request = ConsumableRequest::create([
            'user_id' => $user->id,
            'item_name' => 'Papier',
            'requested_quantity' => 3,
            'status' => 'pending'
        ]);

        $this->actingAs($directeur, 'sanctum')->putJson("/api/consumable-requests/{$request->id}/approve");

        $this->assertDatabaseHas('consumable_requests', [
            'id' => $request->id,
            'approved_quantity' => 2,
            'status' => 'approved'
        ]);
    }

    public function test_user_cannot_approve_request(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        $request = ConsumableRequest::create([
            'user_id' => $user1->id,
            'item_name' => 'Test',
            'requested_quantity' => 50,
            'status' => 'pending'
        ]);

        $response = $this->actingAs($user2, 'sanctum')->putJson("/api/consumable-requests/{$request->id}/approve");

        $response->assertStatus(403);
    }

    public function test_unauthenticated_user_cannot_create_request(): void
    {
        $response = $this->postJson('/api/consumable-requests', [
            'item_name' => 'Test',
            'requested_quantity' => 50,
        ]);

        $response->assertStatus(401);
    }

    public function test_directeur_sees_all_requests(): void
    {
        $directeur = User::factory()->create();
        $directeur->assignRole('directeur');

        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        ConsumableRequest::create([
            'user_id' => $user1->id,
            'item_name' => 'Item 1',
            'requested_quantity' => 10,
        ]);

        ConsumableRequest::create([
            'user_id' => $user2->id,
            'item_name' => 'Item 2',
            'requested_quantity' => 20,
        ]);

        $response = $this->actingAs($directeur, 'sanctum')->getJson('/api/consumable-requests');

        $response->assertStatus(200)
            ->assertJsonCount(2);
    }

    public function test_employee_sees_only_own_requests(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        ConsumableRequest::create([
            'user_id' => $user1->id,
            'item_name' => 'Item 1',
            'requested_quantity' => 10,
        ]);

        ConsumableRequest::create([
            'user_id' => $user2->id,
            'item_name' => 'Item 2',
            'requested_quantity' => 20,
        ]);

        $response = $this->actingAs($user1, 'sanctum')->getJson('/api/consumable-requests');

        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJson([['item_name' => 'Item 1']]);
    }
}
