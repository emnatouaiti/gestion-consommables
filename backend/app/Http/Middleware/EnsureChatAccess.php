<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class EnsureChatAccess
{
    public function handle(Request $request, Closure $next)
    {
        $auth = $request->user();
        if (!$auth) {
            abort(401, 'Unauthenticated');
        }

        $targetId = $request->route('user') ?? $request->input('receiver_id') ?? $request->input('user_id');
        if (!$targetId) {
            return $next($request);
        }

        $target = User::find($targetId);
        if (!$target) {
            abort(404, 'User not found');
        }

        if (!$this->canChat($auth, $target)) {
            abort(403, 'You are not allowed to chat with this user');
        }

        return $next($request);
    }

    private function canChat(User $auth, User $target): bool
    {
        $authRole = $this->normalizeRole($auth);
        $targetRole = $this->normalizeRole($target);

        if ($authRole === 'admin') {
            return true;
        }

        if ($authRole === 'manager') {
            return in_array($targetRole, ['employee', 'manager', 'admin'], true);
        }

        if ($authRole === 'employee') {
            return in_array($targetRole, ['manager', 'admin'], true);
        }

        return false;
    }

    private function normalizeRole(User $user): string
    {
        $role = strtolower((string) ($user->role ?? ''));
        if (in_array($role, ['admin', 'administrateur'], true)) {
            return 'admin';
        }
        if (in_array($role, ['manager', 'responsable', 'gestionnaire', 'directeur', 'validateur'], true)) {
            return 'manager';
        }
        if (in_array($role, ['employee', 'employe', 'agent', 'utilisateur'], true)) {
            return 'employee';
        }
        return $role;
    }
}
