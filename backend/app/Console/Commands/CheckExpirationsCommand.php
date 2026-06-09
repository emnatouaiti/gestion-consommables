<?php

namespace App\Console\Commands;

use App\Services\ExpirationManagementService;
use Illuminate\Console\Command;

/**
 * Commande Artisan pour scanner et gÃrer les expirations
 *
 * Usage:
 *   php artisan expirations:check              - VÃrifier toutes les expirations
 *   php artisan expirations:check --verbose    - Afficher plus de dÃtails
 *   php artisan expirations:cleanup --months=12 - Nettoyer les vieux enregistrements
 */
class CheckExpirationsCommand extends Command
{
    protected $signature = 'expirations:process {--verbose : Afficher les dÃtails} {--days-before=7 : Jours avant alerte}';
    protected $description = 'VÃrifier tous les produits pour les expirations et crÃer les alertes';

    public function handle(ExpirationManagementService $expirationService): int
    {
        $this->info('ðŸ” DÃbut du scan des expirations...');

        // Configurer le service
        $expirationService->setAlertDaysBefore($this->option('days-before'));

        // Lancer le scan
        $metrics = $expirationService->checkAllExpirations();

        // Afficher les rÃsultats
        $this->newLine();
        $this->info('âœ… Scan complÃtÃ!');
        $this->table(
            ['MÃtrique', 'Nombre'],
            [
                ['Alertes 7 jours avant', $metrics['alerts_7days']],
                ['Alertes jour d\'expiration', $metrics['alerts_expired']],
                ['Produits bloquÃs', $metrics['blocked']],
                ['Erreurs', $metrics['errors']],
            ]
        );

        if ($this->option('verbose')) {
            $this->newLine();
            $this->info('ðŸ“Š DÃtails supplÃmentaires:');

            $expiring = $expirationService->getExpiringProducts($this->option('days-before'));
            $expired = $expirationService->getExpiredProducts();

            $this->line("  â€¢ Produits expirant bientÃ´t: {$expiring->count()}");
            $this->line("  â€¢ Produits expirÃÃs: {$expired->total()}");
        }

        return Command::SUCCESS;
    }
}
