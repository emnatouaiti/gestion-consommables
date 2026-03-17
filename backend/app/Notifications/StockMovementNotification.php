<?php

namespace App\Notifications;

use App\Models\StockMovement;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Schema;

class StockMovementNotification extends Notification
{
    use Queueable;

    public function __construct(public StockMovement $movement)
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
        return (new MailMessage)
            ->subject('Mouvement de stock enregistre')
            ->line("Un mouvement de stock ({$this->movement->type}) a ete enregistre.")
            ->action('Voir mouvements', url('/admin/mouvements-stock'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'movement_id' => $this->movement->id,
            'type' => $this->movement->type,
            'reference' => $this->movement->reference,
            'related_request_id' => $this->movement->related_request_id,
            'url' => '/admin/mouvements-stock',
        ];
    }
}
