<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CapacityAlertNotification extends Notification
{
    use Queueable;

    protected array $alerts;

    /**
     * Create a new notification instance.
     */
    public function __construct(array $alerts)
    {
        $this->alerts = $alerts;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('️ Alerte de Capacite de Stockage')
            ->greeting('Bonjour ' . $notifiable->name . ',')
            ->line('Certains de vos espaces de stockage ont atteint ou depasse 90% de leur capacite maximale.')
            ->line('Voici le detail :');

        foreach ($this->alerts as $alert) {
            $message->line("- **{$alert['type']} : {$alert['name']}** - Utilise : {$alert['current']} / {$alert['capacity']} ({$alert['percentage']}%)");
        }

        return $message
            ->action('Voir les depots', url('/warehouses'))
            ->line('Merci de faire le necessaire pour liberer de l\'espace.');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'capacity_alert',
            'title' => 'Alerte de Capacite de Stockage',
            'message' => count($this->alerts) . ' espace(s) de stockage sont proches de leur capacite maximale.',
            'alerts' => $this->alerts,
            'action_url' => '/warehouses'
        ];
    }
}
