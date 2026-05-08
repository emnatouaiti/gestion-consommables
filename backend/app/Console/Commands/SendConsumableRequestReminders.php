<?php

namespace App\Console\Commands;

use App\Models\ConsumableRequest;
use App\Models\User;
use App\Notifications\PendingRequestReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendConsumableRequestReminders extends Command
{
    protected $signature = 'consumable-requests:send-reminders';
    protected $description = 'Envoie des rappels email pour les demandes en attente depuis plus de 2 jours';

    public function handle(): int
    {
        $threshold = Carbon::now()->subDays(2);
        $frontend = rtrim((string) config('app.frontend_url', 'http://localhost:4200'), '/');

        // Rappel directeurs (pending + validated_by_manager)
        $staleForDirectors = ConsumableRequest::query()
            ->with('user')
            ->whereIn('status', ['pending', 'validated_by_manager'])
            ->where('created_at', '<=', $threshold)
            ->get()
            ->groupBy(fn($r) => ($r->user?->service ?? '-') . '|' . ($r->user?->siege ?? '-'));

        foreach ($staleForDirectors as $groupKey => $requests) {
            [$service, $siege] = explode('|', (string) $groupKey);
            $directors = User::query()
                ->where(function ($q) {
                    $q->whereHas('roles', fn($r) => $r->whereRaw('LOWER(name) IN (?, ?, ?)', ['directeur', 'durecteur', 'director']))
                      ->orWhereRaw('LOWER(poste) IN (?, ?, ?)', ['directeur', 'durecteur', 'director'])
                      ->orWhereRaw('LOWER(role) IN (?, ?, ?)', ['directeur', 'durecteur', 'director']);
                })
                ->where('service', $service)
                ->where('siege', $siege)
                ->get();

            foreach ($directors as $director) {
                $director->notify(new PendingRequestReminderNotification(
                    'Directeur',
                    $requests->count(),
                    $frontend . '/admin/validation-demandes'
                ));
            }
        }

        // Rappel responsables (approved_pending_exit)
        $staleForManagers = ConsumableRequest::query()
            ->where('status', 'approved_pending_exit')
            ->whereNotNull('depot_id')
            ->where('updated_at', '<=', $threshold)
            ->get()
            ->groupBy('depot_id');

        foreach ($staleForManagers as $depotId => $requests) {
            $managers = User::query()
                ->where('depot_id', $depotId)
                ->where(function ($q) {
                    $q->whereHas('roles', fn($r) => $r->whereRaw('LOWER(name) IN (?, ?, ?, ?)', ['responsable de stock', 'responsable', 'agent de stock', 'agent']))
                      ->orWhereRaw('LOWER(role) IN (?, ?, ?, ?)', ['responsable de stock', 'responsable', 'agent de stock', 'agent']);
                })
                ->get();

            foreach ($managers as $manager) {
                $manager->notify(new PendingRequestReminderNotification(
                    'Responsable',
                    $requests->count(),
                    $frontend . '/admin/validation-demandes'
                ));
            }
        }

        $this->info('Rappels demandes consommables envoyés.');
        return self::SUCCESS;
    }
}

