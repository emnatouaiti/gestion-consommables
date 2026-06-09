<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $code;
    public $expiresAt;

    /**
     * Create a new notification instance.
     */
    public function __construct($code)
    {
        $this->code = $code;
        $this->expiresAt = now()->addMinutes(15);
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via($notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Réinitialisation de votre mot de passe - ETAP')
            ->greeting('Bonjour,')
            ->line('Vous avez demandé une réinitialisation de votre mot de passe. Voici votre code :')
            ->line('')
            ->line('**Code de vérification : ' . $this->code . '**')
            ->line('')
            ->line('Ce code expirera dans **15 minutes**.')
            ->line('')
            ->line('Si vous n\'avez pas fait cette demande, ignorez cet email.')
            ->salutation('Cordialement,')
            ->salutation('L\'équipe ETAP');
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray($notifiable): array
    {
        return [
            'code' => $this->code,
            'expires_at' => $this->expiresAt,
        ];
    }
}
