<?php

namespace App\Http\Controllers\Expirations;

use App\Http\Controllers\Controller;

use App\Models\ProductStock;
use App\Models\ExpirationEvent;
use App\Services\ExpirationManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use App\Mail\ReturnToSupplierMail;
use App\Models\Document;
use App\Models\StockMovement;
use App\Models\StockMovementLine;
use Illuminate\Support\Facades\DB;

/**
 * ContrÃ´leur pour la gestion des expirations et alertes
 *
 * Endpoints:
 * GET    /api/expirations/check           - Scanner et vÃrifier toutes les expirations
 * GET    /api/expirations/expired         - Lister les produits expirÃÃs
 * GET    /api/expirations/expiring-soon   - Lister les produits expirant bientÃ´t
 * GET    /api/expirations/alerts          - Lister les alertes non traitÃes
 * GET    /api/expirations/history         - Historique complet
 * POST   /api/expirations/{id}/acknowledge - Marquer une alerte comme traitÃe
 * POST   /api/expirations/{id}/force-consume - Admin: forcer consommation
 * GET    /api/product-stocks/{id}/status - VÃrifier le statut d'expiration d'un stock
 */
class ExpirationController extends Controller
{
    protected ExpirationManagementService $expirationService;

    public function __construct(ExpirationManagementService $expirationService)
    {
        $this->expirationService = $expirationService;
    }

    /**
     * GET /api/expirations/check
     * Scanner et vÃrifier toutes les expirations
     * GÃnÃralement appelÃ par un cron job
     */
    public function checkAllExpirations(): JsonResponse
    {
        $metrics = $this->expirationService->checkAllExpirations();

        return response()->json([
            'message' => 'VÃrification des expirations complÃtÃe',
            'metrics' => $metrics,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * GET /api/expirations/expired?page=1
     * Lister tous les produits expirÃÃs
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
     * GET /api/expirations/expiring-soon?days=7
     * Lister les produits expirant bientÃ´t
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
     * GET /api/expirations/alerts?page=1
     * Lister les alertes non traitÃes
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
     * GET /api/expirations/history?page=1
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
     * GET /api/product-stocks/{id}/expiration-status
     * VÃrifier le statut d'expiration d'un stock particulier
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
     * POST /api/expirations/{id}/acknowledge
     * Marquer une alerte comme traitÃe
     */
    public function acknowledgeAlert(int $id, Request $request): JsonResponse
    {
        $alert = ExpirationEvent::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:acknowledged,resolved,ignored',
        ]);

        $alert->update([
            'status' => $validated['status'],
            'acknowledged_by' => auth()->id(),
            'acknowledged_at' => now(),
        ]);

        return response()->json([
            'message' => 'Alerte mise a jour',
            'alert' => $alert,
        ]);
    }

    /**
     * POST /api/expirations/{stockId}/force-consume
     * Admin only: Forcer la consommation d'un produit expirÃ (cas d'urgence)
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
                'message' => 'Consommation forcee enregistree',
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
     * POST /api/expirations/{stockId}/eliminate
     * Ã‰liminer un lot expirÃ ou endommagÃ
     */
    public function eliminateBatch(int $stockId, Request $request): JsonResponse
    {
        $stock = ProductStock::findOrFail($stockId);
        $originalQuantity = $stock->quantity;

        $validated = $request->validate([
            'justification' => 'required|string|min:5',
        ]);

        $stock->load(['product.unit', 'supplier', 'warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse']);

        $event = $this->expirationService->eliminateBatch(
            stock: $stock,
            userId: auth()->id() ?? 1,
            justification: $validated['justification']
        );

        $document = null;
        $movement = null;

        // â”€â”€ CrÃer un mouvement de stock pour l'historique â”€â”€
        try {
            DB::transaction(function () use ($stock, $originalQuantity, $validated, $event, &$movement, &$document) {
                $movement = StockMovement::create([
                    'movement_type' => 'out',
                    'reference'     => 'ELIM-' . $stock->id . '-' . time(),
                    'created_by'    => auth()->id(),
                    'validated_by'  => auth()->id(),
                    'status'        => 'executed',
                    'notes'         => 'Elimination de lot: ' . ($stock->batch_number ?? 'Sans numÃro') . ' - Justification: ' . $validated['justification'],
                    'source_warehouse_location_id' => $stock->warehouse_location_id,
                    'source_cabinet_id'            => $stock->cabinet_id,
                    'executed_at'   => now(),
                ]);

                StockMovementLine::create([
                    'stock_movement_id' => $movement->id,
                    'product_id'        => $stock->product_id,
                    'quantity'          => $originalQuantity,
                ]);

                // â”€â”€ GÃnÃrer le PV d'Ãlimination â”€â”€
                $pdf = Pdf::loadView('pdf.elimination', [
                    'stock'         => $stock,
                    'justification' => $validated['justification'],
                    'quantity'      => $originalQuantity,
                ]);

                $fileName = 'elimination_lot_' . $stock->id . '_' . time() . '.pdf';
                $path = 'documents/eliminations/' . $fileName;
                Storage::disk('public')->put($path, $pdf->output());

                $warehouseId = optional(optional(optional($stock->warehouseLocation)->room)->warehouse)->id;

                $document = Document::create([
                    'user_id'     => auth()->id(),
                    'product_id'  => $stock->product_id,
                    'supplier_id' => $stock->supplier_id,
                    'warehouse_id'=> $warehouseId,
                    'title'       => 'PV d\'elimination - Lot ' . ($stock->batch_number ?? $stock->id),
                    'type'        => 'pv_destruction',
                    'direction'   => 'out',
                    'path'        => $path,
                    'status'      => 'applied',
                ]);

                // Associer le document au mouvement et Ã  l'ÃvÃnement
                $movement->update(['document_id' => $document->id]);
                $event->update(['document_id' => $document->id]);

                // Mettre Ã  jour le stock global du produit
                $product = $stock->product;
                $product->stock_quantity = $product->stocks()->sum('quantity');
                $product->save();
            });
        } catch (\Exception $err) {
            \Log::error('Elimination StockMovement/PDF error: ' . $err->getMessage());
        }

        return response()->json([
            'message'            => 'Lot elimine avec succÃ¨s',
            'event'              => $event,
            'document'           => $document,
            'movement'           => $movement,
            'remaining_quantity' => $stock->fresh()->quantity,
        ]);


    }


    /**
     * POST /api/expirations/{stockId}/return-supplier
     * Retourner un lot au fournisseur
     */
    public function returnToSupplierBatch(int $stockId, Request $request): JsonResponse
    {
        $stock = ProductStock::with(['product.unit', 'supplier', 'warehouseLocation.room.warehouse'])->findOrFail($stockId);
        $originalQuantity = $stock->quantity;

        $validated = $request->validate([
            'justification' => 'required|string|min:5',
        ]);

        // â”€â”€ Ã‰tape critique : mettre Ã  jour le stock et crÃer l'ÃvÃnement â”€â”€
        $event = $this->expirationService->returnToSupplierBatch(
            stock: $stock,
            userId: auth()->id() ?? 1,
            justification: $validated['justification']
        );

        $document = null;
        $movement = null;

        // â”€â”€ CrÃer un mouvement de stock pour l'historique â”€â”€
        try {
            DB::transaction(function () use ($stock, $originalQuantity, $validated, $event, &$movement, &$document) {
                $movement = StockMovement::create([
                    'movement_type' => 'out',
                    'reference'     => 'RET-' . $stock->id . '-' . time(),
                    'created_by'    => auth()->id(),
                    'validated_by'  => auth()->id(),
                    'status'        => 'executed',
                    'notes'         => 'Retour au fournisseur: ' . ($stock->batch_number ?? 'Sans numÃro') . ' - Justification: ' . $validated['justification'],
                    'supplier_id'   => $stock->supplier_id,
                    'source_warehouse_location_id' => $stock->warehouse_location_id,
                    'source_cabinet_id'            => $stock->cabinet_id,
                    'executed_at'   => now(),
                ]);

                StockMovementLine::create([
                    'stock_movement_id' => $movement->id,
                    'product_id'        => $stock->product_id,
                    'quantity'          => $originalQuantity,
                ]);

                // â”€â”€ GÃnÃrer le bon de retour â”€â”€
                $pdf = Pdf::loadView('pdf.return_supplier', [
                    'stock'         => $stock,
                    'supplier'      => $stock->supplier,
                    'justification' => $validated['justification'],
                    'quantity'      => $originalQuantity,
                ]);

                $fileName = 'return_supplier_lot_' . $stock->id . '_' . time() . '.pdf';
                $path = 'documents/returns/' . $fileName;
                Storage::disk('public')->put($path, $pdf->output());

                $warehouseId = optional(optional(optional($stock->warehouseLocation)->room)->warehouse)->id;

                $document = Document::create([
                    'user_id'     => auth()->id(),
                    'product_id'  => $stock->product_id,
                    'supplier_id' => $stock->supplier_id,
                    'warehouse_id'=> $warehouseId,
                    'title'       => 'Bon de Retour - Lot ' . ($stock->batch_number ?? $stock->id),
                    'type'        => 'bon_retour',
                    'direction'   => 'out',
                    'path'        => $path,
                    'status'      => 'applied',
                ]);

                // Associer le document au mouvement et Ã  l'ÃvÃnement
                $movement->update(['document_id' => $document->id]);
                $event->update(['document_id' => $document->id]);

                // Mettre Ã  jour le stock global du produit
                $product = $stock->product;
                $product->stock_quantity = $product->stocks()->sum('quantity');
                $product->save();

                // â”€â”€ Envoyer l'email au fournisseur â”€â”€
                if ($stock->supplier && !empty($stock->supplier->email)) {
                    try {
                        Mail::to($stock->supplier->email)->send(new ReturnToSupplierMail(
                            $stock, 
                            $stock->supplier, 
                            $validated['justification'], 
                            storage_path('app/public/' . $path)
                        ));
                    } catch (\Exception $mailErr) {
                        \Log::error('ReturnToSupplier Mail error: ' . $mailErr->getMessage());
                    }
                }
            });
        } catch (\Exception $err) {
            \Log::error('ReturnToSupplier StockMovement/PDF error: ' . $err->getMessage());
        }

        return response()->json([
            'message'            => 'Lot retournÃ au fournisseur avec succÃ¨s',
            'event'              => $event,
            'document'           => $document,
            'movement'           => $movement,
            'remaining_quantity' => $stock->fresh()->quantity,
        ]);
    }


    /**
     * GET /api/expirations/stats
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
     * GET /api/products/{product}/expiration/batches
     */
    public function getBatches(int $productId): JsonResponse
    {
        $query = ProductStock::where('product_id', $productId)
            ->whereNotNull('expiration_date')
            ->whereIn('batch_status', ['active', 'expired']); // On masque les lots ÃliminÃs/retournÃs ici

        // Filtrage par dÃpÃ´t pour les responsables/agents
        $user = auth()->user();
        if ($user && ($user->role === 'responsable' || $user->role === 'agent') && $user->depot_id) {
            $depotId = $user->depot_id;
            $query->where(function($q) use ($depotId) {
                $q->whereHas('warehouseLocation.room', function($sq) use ($depotId) {
                    $sq->where('warehouse_id', $depotId);
                })->orWhereHas('warehouseCabinet.room', function($sq) use ($depotId) {
                    $sq->where('warehouse_id', $depotId);
                });
            });
        }

        $batches = $query->with(['product', 'supplier', 'warehouseLocation.room.warehouse', 'warehouseCabinet.room.warehouse'])
            ->get();

        $result = $batches->map(function ($stock) {
            return [
                'id'             => $stock->id,
                'product_id'     => $stock->product_id,
                'product_name'   => $stock->product->title ?? null,
                'batch_number'   => $stock->batch_number,
                'expiration_date'=> $stock->expiration_date,
                'quantity'       => $stock->quantity,
                'batch_status'   => $stock->batch_status ?? 'active',
                'is_blocked'     => $stock->is_blocked ?? false,
                'notes'          => $stock->notes,
                'supplier_id'    => $stock->supplier_id,
                'supplier_name'  => $stock->supplier->name ?? null,
                'warehouse_name' => optional(optional(optional($stock->warehouseLocation)->room)->warehouse)->name
                                   ?? optional(optional(optional($stock->warehouseCabinet)->room)->warehouse)->name,
                'location_display' => $stock->warehouseLocation->code ?? $stock->warehouseCabinet->code ?? null,
                'created_at'     => $stock->created_at,
            ];
        });

        return response()->json($result);
    }

    /**
     * GET /api/products/{product}/expiration/expiring-soon
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
     * GET /api/products/{product}/expiration-events
     */
    public function getEvents(int $productId): JsonResponse
    {
        $query = ExpirationEvent::with(['document', 'acknowledgedBy', 'createdBy'])
            ->where('product_id', $productId);

        // Filtrage par dÃpÃ´t pour les responsables/agents
        $user = auth()->user();
        if ($user && ($user->role === 'responsable' || $user->role === 'agent') && $user->depot_id) {
            $depotId = $user->depot_id;
            $query->where(function($q) use ($depotId) {
                // Filtrer via le stock associÃ
                $q->whereHas('productStock', function($sq) use ($depotId) {
                    $sq->whereHas('warehouseLocation.room', function($ssq) use ($depotId) {
                        $ssq->where('warehouse_id', $depotId);
                    })->orWhereHas('warehouseCabinet.room', function($ssq) use ($depotId) {
                        $ssq->where('warehouse_id', $depotId);
                    });
                })
                // OU via le document associÃ (qui a un warehouse_id)
                ->orWhereHas('document', function($sq) use ($depotId) {
                    $sq->where('warehouse_id', $depotId);
                });
            });
        }

        $events = $query->orderBy('created_at', 'desc')
            ->get();

        return response()->json($events);
    }
}




