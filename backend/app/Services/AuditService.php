<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Request;

class AuditService
{
    /**
     * Log an action to the audit logs.
     *
     * @param mixed $user The user performing the action (optional, defaults to auth user)
     * @param string $action The name of the action performed
     * @param string|null $description Optional description of the action
     * @param array $metadata Optional metadata to include in description (as JSON)
     * @return AuditLog
     */
    public static function log($user, string $action, ?string $description = null, array $metadata = [])
    {
        $userId = $user ? $user->id : (auth()->check() ? auth()->id() : null);

        if (!empty($metadata)) {
            $description .= ' ' . json_encode($metadata);
        }

        return AuditLog::create([
            'user_id' => $userId,
            'action' => $action,
            'description' => trim($description),
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);
    }
}
