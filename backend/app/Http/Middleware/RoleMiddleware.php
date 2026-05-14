<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \\Closure(\\Illuminate\\Http\\Request): (\\Symfony\\Component\\HttpFoundation\\Response)  $next
     */
    public function handle(Request $request, Closure $next, $role)
    {
        $user = $request->user();
        $roles = collect(explode('|', (string) $role))
            ->map(fn ($r) => trim($r))
            ->filter()
            ->values()
            ->all();

        // Ensure the role relationship is loaded so hasAnyRole() can access role->name
        if ($user && !$user->relationLoaded('role')) {
            $user->loadMissing('role');
        }

        if (!$user || (count($roles) > 0 && !$user->hasAnyRole($roles))) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        return $next($request);
    }
}
