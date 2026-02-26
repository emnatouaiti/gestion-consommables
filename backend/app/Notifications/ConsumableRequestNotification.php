<?php

namespace App\Notifications;

use App\Models\ConsumableRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Schema;

class ConsumableRequestNotification extends Notification
{
    use Queueable;

    public function __construct(public ConsumableRequest $consumableRequest)
    {
    }

    public function via(object $notifiable): array
    {
        if (Schema::hasTable('notifications')) {
            return ['database'];
        }

        return [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $this->consumableRequest->user;
        return (new MailMessage)
            ->subject("Nouvelle demande de consommable")
            ->greeting("Bonjour {$notifiable->nomprenom},")
            ->line("Une nouvelle demande de consommable a été créée par {$user->nomprenom}.")
            ->line("Article : {$this->consumableRequest->item_name}")
            ->line("Quantité : {$this->consumableRequest->requested_quantity}")
            ->action("Consulter la demande", url('/consumable-requests'))
            ->line("Merci d'approuver ou de rejeter cette demande.");
    }

    public function toArray(object $notifiable): array
    {
        return [
            'consumable_request_id' => $this->consumableRequest->id,
            'item_name' => $this->consumableRequest->item_name,
            'requested_quantity' => $this->consumableRequest->requested_quantity,
            'user_id' => $this->consumableRequest->user_id,
            'url' => '/admin/validation-demandes',
        ];
    }
}
