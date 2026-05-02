<?php

namespace App\Http\Controllers\API;

use App\Models\ProductStock;
use App\Models\ExpirationEvent;
use App\Services\ExpirationManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * Contrôleur pour la gestion des expirations et alertes
 *
 * Endpoints:
 * GET    /api/admin/expirations/check           - Scanner et vérifier toutes les expirations
 * GET    /api/admin/expirations/expired         - Lister les produits expiréés
 * GET    /api/admin/expirations/expiring-soon   - Lister les produits expirant bientôt
 * GET    /api/admin/expirations/alerts          - Lister les alertes non traitées
 * GET    /api/admin/expirations/history         - Historique complet
 * POST   /api/admin/expirations/{id}/acknowledge - Marquer une alerte comme traitée
 * POST   /api/admin/expirations/{id}/force-consume - Admin: forcer consommation
 * GET    /api/admin/product-stocks/{id}/status - Vérifier le statut d'expiration d'un stock
 */
class ExpirationController extends Controller
{
    protected ExpirationManagementService $expirationService;

    public function __construct(ExpirationManagementService $expirationService)
    {
        $this->expirationService = $expirationService;
    }

    /**
     * GET /api/admin/expirations/check
     * Scanner et vérifier toutes les expirations
     * Généralement appelé par un cron job
     */
    public function checkAllExpirations(): JsonResponse
    {
        $metrics = $this->expirationService->checkAllExpirations();

        return response()->json([
            'message' => 'Vérification des expirations complétée',
            'metrics' => $metrics,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * GET /api/admin/expirations/expired?page=1
     * Lister tous les produits expiréés
     */
    public function getExpiredProducts(Request $request): JsonResponse
    {
        $perPage = $request->get('per_page', 15);
        $expired = $this->expirationService->getExpiredProducts($perPage);

        return response()->json([
            'data' => $expired->items(),
            'pagination' => [
                'total' => $expired->total(),
                'per_page' => $expired->perPage(),
                'current_page' => $expired->currentPage(),
                'last_page' => $expired->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/admin/expirations/expiring-soon?days=7
     * Lister les produits expirant bientôt
     */
    public function getExpiringProducts(Request $request): JsonResponse
    {
        $days = $request->get('days', 7);
        $this->expirationService->setAlertDaysBefore($days);

        $expiring = $this->expirationService->getExpiringProducts($days);

        return response()->json([
            'data' => $expiring,
            'days_threshold' => $days,
            'count' => $expiring->count(),
        ]);
    }

    /**
     * GET /api/admin/expirations/alerts?page=1
     * Lister les alertes non traitées
     */
    public function getPendingAlerts(Request $request): JsonResponse
    {
        $perPage = $request->get('per_page', 15);
        $alerts = $this->expirationService->getPendingAlerts($perPage);

        return response()->json([
            'data' => $alerts->items(),
            'pagination' => [
                'total' => $alerts->total(),
                'per_page' => $alerts->perPage(),
                'current_page' => $alerts->currentPage(),
                'last_page' => $alerts->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/admin/expirations/history?page=1
     * Historique complet des expirations
     */
    public function getHistory(Request $request): JsonResponse
    {
        $perPage = $request->get('per_page', 50);
        $history = $this->expirationService->getExpirationHistory($perPage);

        return response()->json([
            'data' => $history->items(),
            'pagination' => [
                'total' => $history->total(),
                'per_page' => $history->perPage(),
                'current_page' => $history->currentPage(),
                'last_page' => $history->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/admin/product-stocks/{id}/expiration-status
     * Vérifier le statut d'expiration d'un stock particulier
     */
    public function checkStatus(int $id): JsonResponse
    {
        $stock = ProductStock::findOrFail($id);

        return response()->json([
            'product_stock_id' => $stock->id,
            'product_id' => $stock->product_id,
            'batch_number' => $stock->batch_number,
            'expiration_date' => $stock->expiration_date,
            'status' => $this->expirationService->getExpirationStatus($stock),
            'can_be_consumed' => $this->expirationService->canBeConsumed($stock),
            'batch_status' => $stock->batch_status,
        ]);
    }

    /**
     * POST /api/admin/expirations/{id}/acknowledge
     * Marquer une alerte comme traitée
     */
    public function acknowledgeAlert(int $id, Request $request): JsonResponse
    {
        $alert = ExpirationEvent::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:acknowledged,resolved,ignored',
            'notes' => 'nullable|string',
        ]);

        $alert->update([
            'status' => $validated['status'],
            'notes' => $validated['notes'] ?? $alert->notes,
            'acknowledged_by' => auth()->id(),
            'acknowledged_at' => now(),
        ]);

        return response()->json([
            'message' => 'Alerte mise à jour',
            'alert' => $alert,
        ]);
    }

    /**
     * POST /api/admin/expirations/{stockId}/force-consume
     * Admin only: Forcer la consommation d'un produit expiré (cas d'urgence)
     */
    public function forceConsumeExpired(int $stockId, Request $request): JsonResponse
    {
        $stock = ProductStock::findOrFail($stockId);

        $validated = $request->validate([
            'quantity' => 'required|integer|min:1',
            'justification' => 'required|string|min:10',
        ]);

        try {
            $event = $this->expirationService->forceConsumeExpired(
                stock: $stock,
                quantity: $validated['quantity'],
                userId: auth()->id(),
                justification: $validated['justification']
            );

            return response()->json([
                'message' => 'Consommation forcée enregistrée',
                'event' => $event,
                'remaining_quantity' => $stock->fresh()->quantity,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 403);
        }
    }

    /**
     * GET /api/admin/expirations/stats
     * Statistiques sur les expirations
     */
    public function getStats(): JsonResponse
    {
        $totalExpired = ExpirationEvent::where('event_type', 'marked_as_expired')->count();
        $pendingAlerts = ExpirationEvent::where('status', 'pending')->count();
        $recentAlerts = ExpirationEvent::where('created_at', '>=', now()->subDays(7))->count();

        $expiringProductsCount = ProductStock::whereNotNull('expiration_date')
            ->where('batch_status', '!=', 'expired')
            ->where('quantity', '>', 0);

        $expiringProductsCount = clone $expiringProductsCount; // Cloner avant whereBetween
        $expiringSoon7 = $expiringProductsCount
            ->whereBetween('expiration_date', [
                now()->startOfDay(),
                now()->addDays(7)->endOfDay()
            ])
            ->count();

        return response()->json([
            'total_expired_events' => $totalExpired,
            'pending_alerts' => $pendingAlerts,
            'recent_alerts_7days' => $recentAlerts,
            'products_expiring_soon_7days' => $expiringSoon7,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * GET /api/admin/products/{product}/expiration/batches
     */
    public function getBatches(int $productId): JsonResponse
    {
        $batches = ProductStock::where('product_id', $productId)
            ->whereNotNull('expiration_date')
            ->get();

        $result = $batches->map(function ($stock) {
            return [
                'batch_number' => $stock->batch_number,
                'expiration_date' => $stock->expiration_date,
                'quantity' => $stock->quantity,
                'status' => $stock->batch_status ?? 'active',
                'created_at' => $stock->created_at,
            ];
        });

        return response()->json($result);
    }

    /**
     * GET /api/admin/products/{product}/expiration/expiring-soon
     */
    public function getExpiringSoon(int $productId): JsonResponse
    {
        $expiring = ProductStock::where('product_id', $productId)
            ->whereNotNull('expiration_date')
            ->where('quantity', '>', 0)
            ->get();

        $result = $expiring->map(function ($stock) {
            $daysLeft = (int) now()->diffInDays($stock->expiration_date, false);
            return [
                'batch_number' => $stock->batch_number,
                'expiration_date' => $stock->expiration_date,
                'quantity' => $stock->quantity,
                'daysLeft' => $daysLeft,
                'status' => $daysLeft <= 0 ? 'expired' : ($daysLeft <= 30 ? 'warning' : 'ok')
            ];
        })->filter(function ($item) {
            return $item['status'] !== 'ok';
        })->values();

        return response()->json($result);
    }

    /**
     * GET /api/admin/products/{product}/expiration-events
     */
    public function getEvents(int $productId): JsonResponse
    {
        $events = ExpirationEvent::whereHas('productStock', function ($q) use ($productId) {
            $q->where('product_id', $productId);
        })->orderBy('created_at', 'desc')->get();

        return response()->json($events);
    }
}
