<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductStock;
use App\Models\ExpirationEvent;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Pagination\Paginator;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Service pour gérer le cycle de vie des produits en rapport avec l'expiration
 *
 * Responsabilités:
 * - Détecter les produits expirant bientôt (7 jours)
 * - Marquer les produits périmés
 * - Créer les alertes d'expiration
 * - Bloquer la consommation de produits expirés
 * - Auditer les actions sur les produits expirés
 */
class ExpirationManagementService
{
    /**
     * Paramètres de configuration
     */
    private int $alertDaysBefore = 7;  // Alerte 7 jours avant
    private int $blockDaysAfter = 1;   // Bloquer après 1 jour d'expiration

    public function setAlertDaysBefore(int $days): self
    {
        $this->alertDaysBefore = $days;
        return $this;
    }

    public function setBlockDaysAfter(int $days): self
    {
        $this->blockDaysAfter = $days;
        return $this;
    }

    /* ============ DÉTECTION & ALERTES ============ */

    /**
     * Scanner tous les produits et détecter les expirations
     * À exécuter via un scheduler (cron job)
     */
    public function checkAllExpirations(): array
    {
        $metrics = [
            'alerts_7days' => 0,
            'alerts_expired' => 0,
            'blocked' => 0,
            'errors' => 0,
        ];

        $stocksWithExpiration = ProductStock::whereNotNull('expiration_date')
            ->where('batch_status', '!=', 'expired')
            ->where('quantity', '>', 0)
            ->get();

        foreach ($stocksWithExpiration as $stock) {
            try {
                $this->checkExpirationStatus($stock);

                // Compter les alertes
                if ($this->isExpiringSoon($stock->expiration_date)) {
                    $metrics['alerts_7days']++;
                } elseif ($this->isExpired($stock->expiration_date)) {
                    $metrics['alerts_expired']++;
                    $metrics['blocked']++;
                }
            } catch (\Exception $e) {
                $metrics['errors']++;
                \Log::error('ExpirationCheck Error for stock ' . $stock->id . ': ' . $e->getMessage());
            }
        }

        return $metrics;
    }

    /**
     * Vérifier le statut d'un stock particulier
     */
    public function checkExpirationStatus(ProductStock $stock): void
    {
        $expirationDate = $stock->expiration_date;
        $today = Carbon::now()->startOfDay();

        // Déjà expiré - créer événement et bloquer
        if ($expirationDate < $today) {
            if ($stock->batch_status !== 'expired') {
                $this->markAsExpired($stock, 'Période expiration dépassée');
            }
        }
        // Expiration très bientôt (7 jours) - alerte
        elseif ($expirationDate <= $today->addDays($this->alertDaysBefore)) {
            $this->createExpirationAlert($stock, 'alert_7days',
                "{$stock->batch_number}: Expiration dans " . $expirationDate->diffInDays($today) . " jours");
        }
        // Jour de l'expiration - alerte forte
        elseif ($expirationDate->isToday()) {
            $this->createExpirationAlert($stock, 'alert_expired',
                "{$stock->batch_number}: C'EST LE DERNIER JOUR!");
        }

        $stock->update(['last_expiration_check' => now()]);
    }

    /**
     * Vérifie si un produit est en train d'expirer (dans 7 jours)
     */
    public function isExpiringSoon(?\DateTime $expirationDate, int $daysBefore = null): bool
    {
        if (!$expirationDate) {
            return false;
        }

        $daysBefore = $daysBefore ?? $this->alertDaysBefore;
        $threshold = Carbon::now()->addDays($daysBefore);

        return Carbon::instance($expirationDate) <= $threshold
            && Carbon::instance($expirationDate) > Carbon::now();
    }

    /**
     * Vérifie si un produit est expiré
     */
    public function isExpired(?\DateTime $expirationDate): bool
    {
        if (!$expirationDate) {
            return false;
        }

        return Carbon::instance($expirationDate) < Carbon::now();
    }

    /* ============ ACTIONS SUR PRODUITS EXPIRÉÉS ============ */

    /**
     * Action 1: CRÉER UNE ALERTE (notification)
     */
    public function createExpirationAlert(
        ProductStock $stock,
        string $eventType = 'alert_expired',
        string $details = null
    ): ExpirationEvent {
        // Chercher si une alerte existe déjà - eviter les doublons
        $existing = ExpirationEvent::where('product_stock_id', $stock->id)
            ->where('event_type', $eventType)
            ->where('status', 'pending')
            ->where('created_at', '>=', now()->subHours(12))
            ->first();

        if ($existing) {
            return $existing;
        }

        $event = ExpirationEvent::create([
            'product_id' => $stock->product_id,
            'product_stock_id' => $stock->id,
            'batch_number' => $stock->batch_number,
            'expiration_date' => $stock->expiration_date,
            'quantity_affected' => $stock->quantity,
            'event_type' => $eventType,
            'status' => 'pending',
            'action_details' => $details ?? "Alerte automatique pour {$stock->batch_number}",
            'created_by' => 1, // Système
        ]);

        // Dispatcher une notification (à implémenter)
        // event(new ProductExpirationAlert($event));

        return $event;
    }

    /**
     * Action 2: BLOQUER LA CONSOMMATION
     * Les produits expirés ne peuvent plus être consommés
     */
    public function blockFromConsumption(ProductStock $stock, string $reason = null): ExpirationEvent
    {
        return ExpirationEvent::create([
            'product_id' => $stock->product_id,
            'product_stock_id' => $stock->id,
            'batch_number' => $stock->batch_number,
            'expiration_date' => $stock->expiration_date,
            'quantity_affected' => $stock->quantity,
            'event_type' => 'blocked_from_consumption',
            'status' => 'pending',
            'action_details' => $reason ?? "Produit expiré - consommation bloquée",
            'created_by' => 1,
        ]);
    }

    /**
     * Action 3: MARQUER COMME EXPIRÉ
     * Change le statut du batch et archive
     */
    public function markAsExpired(
        ProductStock $stock,
        string $reason = null,
        ?int $userId = null
    ): ExpirationEvent {
        // Mettre à jour le stock
        $stock->update([
            'batch_status' => 'expired',
            'last_expiration_check' => now(),
        ]);

        // Créer l'événement dans l'historique
        $event = ExpirationEvent::create([
            'product_id' => $stock->product_id,
            'product_stock_id' => $stock->id,
            'batch_number' => $stock->batch_number,
            'expiration_date' => $stock->expiration_date,
            'quantity_affected' => $stock->quantity,
            'event_type' => 'marked_as_expired',
            'status' => 'acknowledged', // Auto-acknowledged par le système
            'action_details' => $reason ?? 'Marqué automatiquement comme expiré',
            'created_by' => $userId ?? 1,
            'acknowledged_by' => $userId ?? 1,
            'acknowledged_at' => now(),
        ]);

        return $event;
    }

    /**
     * OVERRIDE ADMIN: Consommer un produit expiré (urgence)
     * Nécessite l'autorisation d'un admin
     */
    public function forceConsumeExpired(
        ProductStock $stock,
        int $quantity,
        int $userId,
        string $justification
    ): ExpirationEvent {
        // La vérification des droits est faite au niveau du middleware de routes
        // Réduire le stock
        $stock->update([
            'quantity' => max(0, $stock->quantity - $quantity),
        ]);

        // Logger l'action
        return ExpirationEvent::create([
            'product_id' => $stock->product_id,
            'product_stock_id' => $stock->id,
            'batch_number' => $stock->batch_number,
            'expiration_date' => $stock->expiration_date,
            'quantity_affected' => $quantity,
            'event_type' => 'consumed_expired',
            'status' => 'acknowledged',
            'action_details' => "Consommation forcée par admin - Justification: {$justification}",
            'created_by' => $userId,
            'acknowledged_by' => $userId,
            'acknowledged_at' => now(),
        ]);
    }

    /**
     * Éliminer un lot expiré ou endommagé
     */
    public function eliminateBatch(
        ProductStock $stock,
        int $userId,
        string $justification
    ): ExpirationEvent {
        $quantity = $stock->quantity;

        // Vider le stock et mettre à jour le statut
        $stock->update([
            'quantity' => 0,
            'batch_status' => 'eliminated',
        ]);

        return ExpirationEvent::create([
            'product_id' => $stock->product_id,
            'product_stock_id' => $stock->id,
            'batch_number' => $stock->batch_number,
            'expiration_date' => $stock->expiration_date,
            'quantity_affected' => $quantity,
            'event_type' => 'eliminated_batch',
            'status' => 'acknowledged',
            'action_details' => "Lot éliminé - Justification: {$justification}",
            'created_by' => $userId,
            'acknowledged_by' => $userId,
            'acknowledged_at' => now(),
        ]);
    }

    /**
     * Retourner un lot au fournisseur
     */
    public function returnToSupplierBatch(
        ProductStock $stock,
        int $userId,
        string $justification
    ): ExpirationEvent {
        $quantity = $stock->quantity;

        // Vider le stock et mettre à jour le statut
        $stock->update([
            'quantity' => 0,
            'batch_status' => 'returned_to_supplier',
        ]);

        return ExpirationEvent::create([
            'product_id' => $stock->product_id,
            'product_stock_id' => $stock->id,
            'batch_number' => $stock->batch_number,
            'expiration_date' => $stock->expiration_date,
            'quantity_affected' => $quantity,
            'event_type' => 'returned_to_supplier',
            'status' => 'acknowledged',
            'action_details' => "Retour au fournisseur - Justification: {$justification}",
            'created_by' => $userId,
            'acknowledged_by' => $userId,
            'acknowledged_at' => now(),
        ]);
    }

    /* ============ REQUÊTES & RAPPORTS ============ */

    /**
     * Obtenir tous les produits expirés
     */
    public function getExpiredProducts(int $perPage = 15): LengthAwarePaginator
    {
        return ProductStock::where('batch_status', 'expired')
            ->with('product', 'warehouseLocation', 'supplier')
            ->orderBy('expiration_date', 'asc')
            ->paginate($perPage);
    }

    /**
     * Obtenir les produits expirant bientôt (7 jours)
     */
    public function getExpiringProducts(int $daysBefore = 7): Collection
    {
        $threshold = Carbon::now()->addDays($daysBefore);

        return ProductStock::whereNotNull('expiration_date')
            ->where('batch_status', '!=', 'expired')
            ->where('quantity', '>', 0)
            ->whereBetween('expiration_date', [
                Carbon::now()->startOfDay(),
                $threshold->endOfDay()
            ])
            ->with('product', 'warehouseLocation')
            ->orderBy('expiration_date', 'asc')
            ->get();
    }

    /**
     * Obtenir les alertes non traitées
     */
    public function getPendingAlerts(int $perPage = 15): LengthAwarePaginator
    {
        return ExpirationEvent::where('status', 'pending')
            ->with('product', 'productStock', 'createdBy')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Obtenir l'historique complet des expirations
     */
    public function getExpirationHistory(int $perPage = 50): LengthAwarePaginator
    {
        return ExpirationEvent::with('product', 'createdBy', 'acknowledgedBy')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Vérifier si un produit peut être consommé
     */
    public function canBeConsumed(ProductStock $stock): bool
    {
        // Si le stock n'a pas de date d'expiration, c'est OK
        if (!$stock->expiration_date) {
            return true;
        }

        // Si expiré = ne peut pas être consommé
        if ($this->isExpired($stock->expiration_date)) {
            return false;
        }

        // Si expiration_date est valide = peut être consommé
        return true;
    }

    /**
     * Obtenir le message d'expiration pour un stock
     */
    public function getExpirationStatus(ProductStock $stock): string
    {
        if (!$stock->expiration_date) {
            return 'Pas de date d\'expiration';
        }

        if ($this->isExpired($stock->expiration_date)) {
            $daysOverdue = abs($stock->expiration_date->diffInDays(Carbon::now()));
            return "❌ EXPIRÉ depuis {$daysOverdue} jour(s)";
        }

        if ($this->isExpiringSoon($stock->expiration_date)) {
            $daysLeft = $stock->expiration_date->diffInDays(Carbon::now());
            return "⚠️ Expire dans {$daysLeft} jour(s)";
        }

        return '✅ Valide';
    }

    /**
     * Nettoyer les données obsolètes
     * À exécuter mensuellement
     */
    public function cleanupOldEvents(int $monthsOld = 12): int
    {
        return ExpirationEvent::where('created_at', '<', Carbon::now()->subMonths($monthsOld))
            ->where('status', '!=', 'pending')
            ->delete();
    }
}
