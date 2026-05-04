<?php

namespace App\Console\Commands;

use App\Services\ExpirationManagementService;
use Illuminate\Console\Command;

/**
 * Commande Artisan pour scanner et gérer les expirations
 *
 * Usage:
 *   php artisan expirations:check              - Vérifier toutes les expirations
 *   php artisan expirations:check --verbose    - Afficher plus de détails
 *   php artisan expirations:cleanup --months=12 - Nettoyer les vieux enregistrements
 */
class CheckExpirationsCommand extends Command
{
    protected $signature = 'expirations:process {--verbose : Afficher les détails} {--days-before=7 : Jours avant alerte}';
    protected $description = 'Vérifier tous les produits pour les expirations et créer les alertes';

    public function handle(ExpirationManagementService $expirationService): int
    {
        $this->info('🔍 Début du scan des expirations...');

        // Configurer le service
        $expirationService->setAlertDaysBefore($this->option('days-before'));

        // Lancer le scan
        $metrics = $expirationService->checkAllExpirations();

        // Afficher les résultats
        $this->newLine();
        $this->info('✅ Scan complété!');
        $this->table(
            ['Métrique', 'Nombre'],
            [
                ['Alertes 7 jours avant', $metrics['alerts_7days']],
                ['Alertes jour d\'expiration', $metrics['alerts_expired']],
                ['Produits bloqués', $metrics['blocked']],
                ['Erreurs', $metrics['errors']],
            ]
        );

        if ($this->option('verbose')) {
            $this->newLine();
            $this->info('📊 Détails supplémentaires:');

            $expiring = $expirationService->getExpiringProducts($this->option('days-before'));
            $expired = $expirationService->getExpiredProducts();

            $this->line("  • Produits expirant bientôt: {$expiring->count()}");
            $this->line("  • Produits expiréés: {$expired->total()}");
        }

        return Command::SUCCESS;
    }
}
