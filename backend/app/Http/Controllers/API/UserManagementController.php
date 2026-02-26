<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Mail\NewUserCreated;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

    $query = User::with('roles');

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

    return response()->json($query->paginate($perPage));
}


    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nomprenom' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
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

        $user = User::create([
            'nomprenom' => $request->nomprenom,
            'email' => $request->email,
            'password' => Hash::make($plain),
            'role' => $validRoleNames[0],
        ]);

        $user->syncRoles($validRoleNames);

        try {
            Mail::to($user->email)->send(new NewUserCreated($user, $plain));
        } catch (\Exception $e) {
            \Log::error('Failed to send new user email: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Utilisateur cree',
            'user' => $user->load('roles')
        ]);
    }

    public function show($id)
    {
        $user = User::with('roles')->findOrFail($id);
        return response()->json($user);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $data = $request->only(['nomprenom', 'email', 'adresse', 'telephone']);

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

            $user->syncRoles($validRoleNames);
            $user->update(['role' => $validRoleNames[0]]);
        }

        return response()->json([
            'message' => 'Utilisateur mis a jour',
            'user' => $user->load('roles')
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
        return response()->json(['message' => 'Utilisateur restaure', 'user' => $user->load('roles')]);
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
