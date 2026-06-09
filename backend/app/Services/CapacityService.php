<?php

namespace App\Services;

use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseRoom;
use App\Models\WarehouseLocation;
use App\Models\WarehouseCabinet;
use App\Notifications\CapacityAlertNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Cache;

class CapacityService
{
    /**
     * Check if a specific storage unit is approaching or has reached its capacity
     * and notify responsible users if necessary.
     */
    public function checkAndNotify($model): void
    {
        if (!$model->capacity_units || $model->capacity_units <= 0) {
            return;
        }

        $threshold = 0.90; // 90%
        $percentage = ($model->current_units / $model->capacity_units);

        if ($percentage >= $threshold) {
            $type = $this->getModelType($model);
            $name = $model->name ?? ($model->code ?? 'Unité #' . $model->id);

            // Avoid spamming notifications (max once every 12 hours per unit)
            $cacheKey = "capacity_alert_{$type}_{$model->id}";
            if (Cache::has($cacheKey)) {
                return;
            }

            $alert = [
                'type' => $type,
                'name' => $name,
                'current' => $model->current_units,
                'capacity' => $model->capacity_units,
                'percentage' => round($percentage * 100, 1)
            ];

            $users = User::whereHas('role', function($q) {
                $q->whereIn('name', ['Administrateur', 'Responsable', 'Responsable de stock', 'admin', 'responsable']);
            })->get();

            if ($users->count() > 0) {
                Notification::send($users, new CapacityAlertNotification([$alert]));
                Cache::put($cacheKey, true, now()->addHours(12));
            }
        }
    }

    private function getModelType($model): string
    {
        if ($model instanceof WarehouseLocation) return 'Emplacement';
        if ($model instanceof WarehouseCabinet) return 'Armoire';
        return 'Espace de stockage';
    }
}
