<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Schema;

class PendingRequestReminderNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $roleLabel,
        public int $count,
        public string $targetUrl
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['mail'];
        if (Schema::hasTable('notifications')) {
            $channels[] = 'database';
        }
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Rappel: {$this->count} demande(s) en attente depuis plus de 2 jours")
            ->greeting("Bonjour {$notifiable->nomprenom},")
            ->line("Rappel automatique: vous avez {$this->count} demande(s) en attente de validation/traitement depuis plus de 2 jours.")
            ->line("Profil concerné: {$this->roleLabel}.")
            ->action('Ouvrir les demandes', $this->targetUrl)
            ->salutation("Cordialement,\nL'équipe");
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'pending_requests_reminder',
            'count' => $this->count,
            'role' => $this->roleLabel,
            'url' => $this->targetUrl,
        ];
    }
}

