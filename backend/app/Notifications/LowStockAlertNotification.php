<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LowStockAlertNotification extends Notification
{
    use Queueable;

    protected $lowStockProducts;

    public function __construct($lowStockProducts)
    {
        $this->lowStockProducts = $lowStockProducts;
    }

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count = count($this->lowStockProducts);
        $mail = (new MailMessage)
            ->subject("âš ï¸ Alerte Stock Critique : $count produit(s) en rupture ou presque")
            ->greeting("Bonjour {$notifiable->nomprenom},")
            ->line("Certains produits ont atteint leur seuil de stock minimum. Une commande de rÃ©approvisionnement est probablement nÃ©cessaire.")
            ->line("**Liste des produits concernÃ©s :**");

        foreach (array_slice($this->lowStockProducts, 0, 10) as $item) {
            $mail->line("- **{$item['title']}** : Stock actuel {$item['current']} (Seuil min: {$item['min']})");
        }

        if ($count > 10) {
            $mail->line("- ... et " . ($count - 10) . " autres produits.");
        }

        return $mail
            ->action('GÃ©rer le stock', url(config('app.frontend_url', 'http://localhost:4200') . '/gerer-produits'))
            ->line('Merci de vÃ©rifier ces niveaux de stock rapidement.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'low_stock_alert',
            'message' => count($this->lowStockProducts) . ' produits sont en stock critique.',
            'count' => count($this->lowStockProducts)
        ];
    }
}
