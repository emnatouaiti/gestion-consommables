<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ProductExpirationAlert extends Notification implements ShouldQueue
{
    use Queueable;

    protected $expiringSoon;
    protected $expired;

    /**
     * Create a new notification instance.
     */
    public function __construct(array $expiringSoon, array $expired)
    {
        $this->expiringSoon = $expiringSoon;
        $this->expired = $expired;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $total = count($this->expiringSoon) + count($this->expired);

        $mail = (new MailMessage)
                    ->subject("Alerte Stock : $total lot(s) avec des problÃ¨mes d'expiration")
                    ->greeting("Bonjour {$notifiable->name},")
                    ->line("Ceci est un rÃ©capitulatif automatique concernant les dates d'expiration de vos stocks de consommables.")
                    ->line("Nombre de lots expirÃ©s : " . count($this->expired))
                    ->line("Nombre de lots expirant dans les 7 prochains jours : " . count($this->expiringSoon))
                    ->action('Consulter le Dashboard', url(config('app.frontend_url', 'http://localhost:4200') . '/dashboard'));

        if (count($this->expired) > 0) {
            $mail->line("\n**Lots ExpirÃ©s :**");
            foreach (array_slice($this->expired, 0, 5) as $item) {
                $stock = $item['stock'];
                $productName = $stock->product->title ?? 'Produit inconnu';
                $batch = $stock->batch_number ?: 'Sans lot';
                $location = $this->formatStockLocation($stock);
                
                $mail->line("- **{$productName}** (Lot: {$batch})");
                $mail->line("  Statut: ExpirÃ© depuis {$item['days']} jour(s) ({$stock->quantity} unitÃ©s)");
                if ($location) $mail->line("  ðŸ“ Emplacement: {$location}");
            }
            if (count($this->expired) > 5) {
                $mail->line("- et " . (count($this->expired) - 5) . " autre(s)...");
            }
        }

        if (count($this->expiringSoon) > 0) {
            $mail->line("\n**Lots expirant bientÃ´t :**");
            foreach (array_slice($this->expiringSoon, 0, 5) as $item) {
                $stock = $item['stock'];
                $productName = $stock->product->title ?? 'Produit inconnu';
                $batch = $stock->batch_number ?: 'Sans lot';
                $location = $this->formatStockLocation($stock);
                
                $mail->line("- **{$productName}** (Lot: {$batch})");
                $mail->line("  Statut: Expire dans {$item['days']} jour(s) ({$stock->quantity} unitÃ©s)");
                if ($location) $mail->line("  ðŸ“ Emplacement: {$location}");
            }
            if (count($this->expiringSoon) > 5) {
                $mail->line("- et " . (count($this->expiringSoon) - 5) . " autre(s)...");
            }
        }

        return $mail;
    }

    /**
     * Construit une chaÃ®ne lisible de l'emplacement du stock
     */
    private function formatStockLocation($stock): string
    {
        $parts = [];
        
        // Via Warehouse Location (Emplacement prÃ©cis)
        if ($stock->warehouseLocation) {
            $loc = $stock->warehouseLocation;
            if ($loc->room?->warehouse) $parts[] = $loc->room->warehouse->name;
            if ($loc->room) $parts[] = $loc->room->name;
            $parts[] = $loc->name ?: $loc->code;
        } 
        // Sinon via Cabinet (Armoire)
        elseif ($stock->warehouseCabinet) {
            $cab = $stock->warehouseCabinet;
            if ($cab->room?->warehouse) $parts[] = $cab->room->warehouse->name;
            if ($cab->room) $parts[] = $cab->room->name;
            $parts[] = "Armoire: " . $cab->name;
        }

        return !empty($parts) ? implode(' > ', $parts) : '';
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'expiration_alert',
            'message' => count($this->expired) . ' lot(s) expirÃ©(s) et ' . count($this->expiringSoon) . ' expirant bientÃ´t.',
            'expiring_count' => count($this->expiringSoon),
            'expired_count' => count($this->expired)
        ];
    }
}
