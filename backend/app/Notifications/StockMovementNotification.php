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
        $channels = ['database', 'mail'];
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $statusLabel = $this->movement->status === 'pending_validation' ? 'EN ATTENTE DE VALIDATION' : 'EXECUTE';
        $typeLabel = strtoupper($this->movement->movement_type);
        $creator = $this->movement->creator->nomprenom ?? 'Un agent';

        $mail = (new MailMessage)
            ->subject("[$statusLabel] Mouvement de stock : {$this->movement->reference}")
            ->greeting("Bonjour {$notifiable->nomprenom},")
            ->line("Un nouveau mouvement de stock a ete enregistre par **$creator**.")
            ->line("**Reference :** {$this->movement->reference}")
            ->line("**Type :** $typeLabel")
            ->line("**Statut actuel :** $statusLabel");

        if ($this->movement->status === 'pending_validation') {
            $mail->line("Ce mouvement necessite votre validation pour impacter les stocks physiques.")
                ->action('Valider le mouvement', url(config('app.frontend_url', 'http://localhost:4200') . '/validation-mouvements'));
        } else {
            $mail->action('Consulter le mouvement', url(config('app.frontend_url', 'http://localhost:4200') . '/mouvements-stock'));
        }

        return $mail->line('Merci d\'utiliser notre plateforme de gestion.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'stock_movement',
            'movement_id' => $this->movement->id,
            'movement_type' => $this->movement->movement_type,
            'reference' => $this->movement->reference,
            'status' => $this->movement->status,
            'creator' => $this->movement->creator->nomprenom ?? 'Un agent',
            'url' => '/validation-mouvements',
            'title' => 'Validation de mouvement',
            'message' => "Mouvement {$this->movement->reference} en attente par " . ($this->movement->creator->nomprenom ?? 'un agent'),
        ];
    }
}
