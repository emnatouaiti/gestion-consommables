<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Mail\NewUserCreated;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;

class UserManagementController extends Controller
{
    private function normalizeRoleNames($rolesInput): array
    {
        if ($rolesInput === null || $rolesInput === '') {
            return [];
        }

        $items = is_array($rolesInput) ? $rolesInput : [$rolesInput];

        return collect($items)
            ->map(function ($role) {
                if (is_array($role) && isset($role['name'])) {
                    return $role['name'];
                }
                if (is_object($role) && isset($role->name)) {
                    return $role->name;
                }
                return is_string($role) ? trim($role) : null;
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function index(Request $request)
{
    $perPage = $request->get('per_page', 20);
    $q = trim($request->get('q', ''));
    $status = $request->get('status', 'active');

    $query = User::with('roles', 'depot');

    // 🔥 filtrer explicitement les actifs
    if ($status === 'active') {
        $query->whereNull('deleted_at');
    } elseif ($status === 'archived') {
        $query->onlyTrashed();
    } elseif ($status === 'all') {
        $query->withTrashed();
    }

    // 🔥 recherche seulement si non vide
    if (!empty($q)) {
        $query->where(function ($sub) use ($q) {
            $sub->where('nomprenom', 'like', "%{$q}%")
                ->orWhere('email', 'like', "%{$q}%");
        });
    }

    // 🔒 Restriction Directeur & Administrateur : ne voir que son siège + tous les Responsables/Agents
    $currentUser = auth()->user();
    if ($currentUser && ($currentUser->hasRole('Directeur') || $currentUser->hasRole('Administrateur'))) {
        if (!empty($currentUser->siege) && $currentUser->siege !== 'Non defini') {
            $query->where(function($sub) use ($currentUser) {
                $sub->where('siege', $currentUser->siege)
                    ->orWhereIn('role', ['Responsable', 'Agent']);
            });
        }
    }

    return response()->json($query->paginate($perPage));
}


    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nomprenom' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'service' => 'nullable|string|max:255',
            'poste' => 'nullable|string|max:255',
            'siege' => 'nullable|string|max:255',
            'depot_id' => 'nullable|exists:warehouses,id',
            'roles' => 'nullable',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $roleNames = $this->normalizeRoleNames($request->input('roles'));
        if (empty($roleNames)) {
            $roleNames = ['Utilisateur'];
        }

        $validRoleNames = Role::whereIn('name', $roleNames)->pluck('name')->toArray();
        if (empty($validRoleNames)) {
            $validRoleNames = ['Utilisateur'];
        }

        $plain = bin2hex(random_bytes(4));
        $primaryRole = strtolower($validRoleNames[0]);
        $isResponsableOrAgent = in_array($primaryRole, ['responsable', 'agent']);

        $userData = [
            'nomprenom' => $request->nomprenom,
            'email' => $request->email,
            'password' => Hash::make($plain),
            'role' => $validRoleNames[0],
        ];

        if ($isResponsableOrAgent) {
            $userData['depot_id'] = $request->input('depot_id');
            $userData['service'] = null;
            $userData['poste'] = null;
            $userData['siege'] = null;
        } else {
            $userData['service'] = $request->input('service', 'Non defini');
            $userData['poste'] = $request->input('poste', 'Non defini');
            
            // 🔒 Restriction Directeur & Administrateur : forcer son siège
            $currentUser = auth()->user();
            if ($currentUser && ($currentUser->hasRole('Directeur') || $currentUser->hasRole('Administrateur'))) {
                if (!empty($currentUser->siege) && $currentUser->siege !== 'Non defini') {
                    $userData['siege'] = $currentUser->siege;
                } else {
                    $userData['siege'] = $request->input('siege', 'Non defini');
                }
            } else {
                $userData['siege'] = $request->input('siege', 'Non defini');
            }
            
            $userData['depot_id'] = null;
        }

        $user = User::create($userData);

        $user->syncRoles($validRoleNames);

        try {
            Mail::to($user->email)->send(new NewUserCreated($user, $plain));
        } catch (\Exception $e) {
            \Log::error('Failed to send new user email: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Utilisateur cree',
            'user' => $user->load('roles', 'depot')
        ]);
    }

    public function show($id)
    {
        $user = User::with('roles', 'depot')->findOrFail($id);
        return response()->json($user);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $data = $request->only(['nomprenom', 'email', 'adresse', 'telephone', 'service', 'poste', 'siege', 'depot_id']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        if ($request->has('roles')) {
            $roleNames = $this->normalizeRoleNames($request->input('roles'));
            if (empty($roleNames)) {
                $roleNames = ['Utilisateur'];
            }

            $validRoleNames = Role::whereIn('name', $roleNames)->pluck('name')->toArray();
            if (empty($validRoleNames)) {
                $validRoleNames = ['Utilisateur'];
            }

            $primaryRole = strtolower($validRoleNames[0]);
            $isResponsableOrAgent = in_array($primaryRole, ['responsable', 'agent']);

            if ($isResponsableOrAgent) {
                $data['depot_id'] = $request->input('depot_id');
                $data['service'] = null;
                $data['poste'] = null;
                $data['siege'] = null;
            } else {
                $data['service'] = $request->input('service', 'Non defini');
                $data['poste'] = $request->input('poste', 'Non defini');
                $data['siege'] = $request->input('siege', 'Non defini');
                $data['depot_id'] = null;
            }

            $user->syncRoles($validRoleNames);
            $user->update(['role' => $validRoleNames[0]]);
        }

        return response()->json([
            'message' => 'Utilisateur mis a jour',
            'user' => $user->load('roles', 'depot')
        ]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();
        return response()->json(['message' => 'Utilisateur archive']);
    }

    public function restore($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();
        return response()->json(['message' => 'Utilisateur restaure', 'user' => $user->load('roles', 'depot')]);
    }

    public function forceDestroy($id)
    {
        $user = User::withTrashed()->findOrFail($id);
        $user->forceDelete();
        return response()->json(['message' => 'Utilisateur supprime definitivement']);
    }

    public function roles()
    {
        return response()->json(
            Role::query()
                ->select(['id', 'name'])
                ->orderBy('name')
                ->get()
        );
    }
}
