<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckStorageCapacity extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'capacity:alert';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check storage capacities and send alerts if limits are approaching';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $alerts = [];
        $threshold = 0.90; // 90%


        // Check Cabinets
        $cabinets = \App\Models\WarehouseCabinet::with('room.warehouse')->whereNotNull('capacity_units')->where('capacity_units', '>', 0)->get();
        foreach ($cabinets as $cabinet) {
            if ($cabinet->current_units >= ($cabinet->capacity_units * $threshold)) {
                $path = ($cabinet->room->warehouse->name ?? '?') . ' > ' . ($cabinet->room->name ?? '?') . ' > ' . $cabinet->name;
                $alerts[] = [
                    'type' => 'Armoire',
                    'name' => $path,
                    'current' => $cabinet->current_units,
                    'capacity' => $cabinet->capacity_units,
                    'percentage' => round(($cabinet->current_units / $cabinet->capacity_units) * 100, 1)
                ];
            }
        }

        // Check Locations
        $locations = \App\Models\WarehouseLocation::with('room.warehouse')->whereNotNull('capacity_units')->where('capacity_units', '>', 0)->get();
        foreach ($locations as $loc) {
            if ($loc->current_units >= ($loc->capacity_units * $threshold)) {
                $path = ($loc->room->warehouse->name ?? '?') . ' > ' . ($loc->room->name ?? '?') . ' > ' . ($loc->name ?: $loc->code);
                $alerts[] = [
                    'type' => 'Emplacement',
                    'name' => $path,
                    'current' => $loc->current_units,
                    'capacity' => $loc->capacity_units,
                    'percentage' => round(($loc->current_units / $loc->capacity_units) * 100, 1)
                ];
            }
        }

        if (count($alerts) > 0) {
            $users = \App\Models\User::whereHas('role', function($q) {
                $q->whereRaw("LOWER(name) IN (?, ?, ?, ?, ?)", [
                    'administrateur', 
                    'responsable de stock', 
                    'responsable', 
                    'gestionnaire', 
                    'validateur'
                ]);
            })->get();

            if ($users->isEmpty()) {
                $this->error("Aucun utilisateur responsable trouvé.");
                \Illuminate\Support\Facades\Log::warning("Alerte Capacité : Aucun utilisateur trouvé avec les rôles administratifs.");
            } else {
                \Illuminate\Support\Facades\Log::info("Envoi d'alertes capacité à : " . $users->pluck('email')->implode(', '));
                \Illuminate\Support\Facades\Notification::send($users, new \App\Notifications\CapacityAlertNotification($alerts));
                $this->info(count($alerts) . ' alerts found. Notifications envoyées.');
            }
        } else {
            $this->info('No capacity alerts.');
            \Illuminate\Support\Facades\Log::info("Scan Capacité : Tout est normal.");
        }
    }
}
