<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        if ($user = $request->user()) {
            // Évite d'écrire trop souvent : seulement si plus de 60s
            $last = $user->last_seen_at ? now()->parse($user->last_seen_at) : null;
            if (!$last || $last->lt(now()->subMinute())) {
                $user->forceFill(['last_seen_at' => now()])->saveQuietly();
            }
        }

        return $response;
    }
}
