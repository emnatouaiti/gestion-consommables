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
            ->subject('âš ï¸ Alerte de CapacitÃ© de Stockage')
            ->greeting('Bonjour ' . $notifiable->name . ',')
            ->line('Certains de vos espaces de stockage ont atteint ou dÃ©passÃ© 90% de leur capacitÃ© maximale.')
            ->line('Voici le dÃ©tail :');

        foreach ($this->alerts as $alert) {
            $message->line("- **{$alert['type']} : {$alert['name']}** - UtilisÃ© : {$alert['current']} / {$alert['capacity']} ({$alert['percentage']}%)");
        }

        return $message
            ->action('Voir les dÃ©pÃ´ts', url('/warehouses'))
            ->line('Merci de faire le nÃ©cessaire pour libÃ©rer de l\'espace.');
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
            'title' => 'Alerte de CapacitÃ© de Stockage',
            'message' => count($this->alerts) . ' espace(s) de stockage sont proches de leur capacitÃ© maximale.',
            'alerts' => $this->alerts,
            'action_url' => '/warehouses'
        ];
    }
}
