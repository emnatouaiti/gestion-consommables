<?php

namespace App\Console\Commands;

use App\Services\ExpirationManagementService;
use Illuminate\Console\Command;

/**
 * Commande Artisan pour scanner et gÃ©rer les expirations
 *
 * Usage:
 *   php artisan expirations:check              - VÃ©rifier toutes les expirations
 *   php artisan expirations:check --verbose    - Afficher plus de dÃ©tails
 *   php artisan expirations:cleanup --months=12 - Nettoyer les vieux enregistrements
 */
class CheckExpirationsCommand extends Command
{
    protected $signature = 'expirations:process {--verbose : Afficher les dÃ©tails} {--days-before=7 : Jours avant alerte}';
    protected $description = 'VÃ©rifier tous les produits pour les expirations et crÃ©er les alertes';

    public function handle(ExpirationManagementService $expirationService): int
    {
        $this->info('ðŸ” DÃ©but du scan des expirations...');

        // Configurer le service
        $expirationService->setAlertDaysBefore($this->option('days-before'));

        // Lancer le scan
        $metrics = $expirationService->checkAllExpirations();

        // Afficher les rÃ©sultats
        $this->newLine();
        $this->info('âœ… Scan complÃ©tÃ©!');
        $this->table(
            ['MÃ©trique', 'Nombre'],
            [
                ['Alertes 7 jours avant', $metrics['alerts_7days']],
                ['Alertes jour d\'expiration', $metrics['alerts_expired']],
                ['Produits bloquÃ©s', $metrics['blocked']],
                ['Erreurs', $metrics['errors']],
            ]
        );

        if ($this->option('verbose')) {
            $this->newLine();
            $this->info('ðŸ“Š DÃ©tails supplÃ©mentaires:');

            $expiring = $expirationService->getExpiringProducts($this->option('days-before'));
            $expired = $expirationService->getExpiredProducts();

            $this->line("  â€¢ Produits expirant bientÃ´t: {$expiring->count()}");
            $this->line("  â€¢ Produits expirÃ©Ã©s: {$expired->total()}");
        }

        return Command::SUCCESS;
    }
}
