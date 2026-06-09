<?php

namespace App\Http\Controllers\Users;

use App\Http\Controllers\Controller;
use App\Mail\NewUserCreated;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class UserManagementController extends Controller
{

    public function index(Request $request)
{
    $perPage = $request->get('per_page', 20);
    $q = trim($request->get('q', ''));
    $status = $request->get('status', 'active');

    $query = User::with('role', 'depot');

    // filtrer explicitement les actifs
    if ($status === 'active') {
        $query->whereNull('deleted_at');
    } elseif ($status === 'archived') {
        $query->onlyTrashed();
    } elseif ($status === 'all') {
        $query->withTrashed();
    }

    // recherche seulement si non vide
    if (!empty($q)) {
        $query->where(function ($sub) use ($q) {
            $sub->where('nomprenom', 'like', "%{$q}%")
                ->orWhere('email', 'like', "%{$q}%");
        });
    }

    // Restriction : Les Admins voient tout. Les Directeurs ne voient que leur siège + staff stock.
    $currentUser = auth()->user();

    // Ne filtrer que si l'utilisateur a un siège défini
    if (!$currentUser->hasRole('administrateur') && !empty($currentUser->siege) && $currentUser->siege !== 'Non defini') {
        $query->where(function($sub) use ($currentUser) {
            $sub->where('siege', $currentUser->siege)
                ->orWhereHas('role', function($q) {
                    $q->whereIn('name', ['Responsable', 'Agent', 'Responsable de stock', 'Agent de stock']);
                });
        });
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

        $rolesInput = $request->input('roles');
        $roleName = 'Utilisateur';

        if ($rolesInput) {
            if (is_array($rolesInput) && count($rolesInput) > 0) {
                $roleName = is_array($rolesInput[0]) ? ($rolesInput[0]['name'] ?? 'Utilisateur') : $rolesInput[0];
            } else if (is_string($rolesInput)) {
                $roleName = $rolesInput;
            }
        }

        $plain = bin2hex(random_bytes(4));
        $primaryRole = strtolower($roleName);
        $isResponsableOrAgent = in_array($primaryRole, ['responsable', 'agent', 'responsable de stock', 'agent de stock']);

        $userData = [
            'nomprenom' => $request->nomprenom,
            'email' => $request->email,
            'password' => Hash::make($plain),
        ];

        $roleRecord = \App\Models\Role::whereRaw('LOWER(name) = ?', [strtolower(trim($roleName))])->first();
        if ($roleRecord) {
            $userData['role_id'] = $roleRecord->id;
        }

        if ($isResponsableOrAgent) {
            $userData['depot_id'] = $request->input('depot_id');
            $userData['service'] = null;
            $userData['poste'] = null;
            $userData['siege'] = null;
        } else {
            $userData['service'] = $request->input('service', 'Non défini');
            $userData['poste'] = $request->input('poste', 'Non défini');

            // Restriction Directeur & Administrateur : forcer son siège
            $currentUser = auth()->user();
            if ($currentUser && (($currentUser->role?->name ?? '') === 'Directeur' || ($currentUser->role?->name ?? '') === 'Administrateur')) {
                if (!empty($currentUser->siege) && $currentUser->siege !== 'Non défini') {
                    $userData['siege'] = $currentUser->siege;
                } else {
                    $userData['siege'] = $request->input('siege', 'Non défini');
                }
            } else {
                $userData['siege'] = $request->input('siege', 'Non défini');
            }

            $userData['depot_id'] = null;
        }

        $user = User::create($userData);


        try {
            Mail::to($user->email)->send(new NewUserCreated($user, $plain));
        } catch (\Exception $e) {
            \Log::error('Failed to send new user email: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Utilisateur créé',
            'user' => $user->load('depot')
        ]);
    }

    public function show($id)
    {
        $user = User::with('depot')->findOrFail($id);
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

            $roleName = 'Utilisateur';
            if (is_array($request->roles) && count($request->roles) > 0) {
                $roleName = is_array($request->roles[0]) ? ($request->roles[0]['name'] ?? 'Utilisateur') : $request->roles[0];
            } else if (is_string($request->roles)) {
                $roleName = $request->roles;
            }

            $primaryRole = strtolower($roleName);
            $isResponsableOrAgent = in_array($primaryRole, ['responsable', 'agent', 'responsable de stock', 'agent de stock']);

            $roleRecord = \App\Models\Role::whereRaw('LOWER(name) = ?', [strtolower(trim($roleName))])->first();
            if ($roleRecord) {
                $user->update(['role_id' => $roleRecord->id]);
            }

        return response()->json([
            'message' => 'Utilisateur mis à jour',
            'user' => $user->load('depot')
        ]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();
        return response()->json(['message' => 'Utilisateur archivé']);
    }

    public function restore($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();
        return response()->json(['message' => 'Utilisateur restauré', 'user' => $user->load('depot')]);
    }

    public function forceDestroy($id)
    {
        $user = User::withTrashed()->findOrFail($id);
        $user->forceDelete();
        return response()->json(['message' => 'Utilisateur supprimé définitivement']);
    }

    public function roles()
    {
        try {
            $roles = \App\Models\Role::all(['id', 'name']);
            if ($roles->isEmpty()) {
                return response()->json([
                    ['id' => 1, 'name' => 'Administrateur'],
                    ['id' => 2, 'name' => 'Directeur'],
                    ['id' => 3, 'name' => 'Responsable'],
                    ['id' => 4, 'name' => 'Agent'],
                    ['id' => 5, 'name' => 'Utilisateur'],
                    ['id' => 6, 'name' => 'Responsable de stock'],
                    ['id' => 7, 'name' => 'Agent de stock'],
                    ['id' => 8, 'name' => 'Gestionnaire'],
                    ['id' => 9, 'name' => 'Validateur'],
                ]);
            }
            return response()->json($roles);
        } catch (\Exception $e) {
            return response()->json([
                ['id' => 1, 'name' => 'Administrateur'],
                ['id' => 2, 'name' => 'Directeur'],
                ['id' => 3, 'name' => 'Responsable'],
                ['id' => 4, 'name' => 'Agent'],
                ['id' => 5, 'name' => 'Utilisateur'],
                ['id' => 6, 'name' => 'Responsable de stock'],
                ['id' => 7, 'name' => 'Agent de stock'],
                ['id' => 8, 'name' => 'Gestionnaire'],
                ['id' => 9, 'name' => 'Validateur'],
            ]);
        }
    }
}




