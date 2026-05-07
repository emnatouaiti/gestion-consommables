<?php

/**
 * Routes d'API pour la gestion des expirations
 *
 * À ajouter dans: backend/routes/api.php
 *
 * Usage:
 * Route::middleware(['auth:sanctum', 'permission:manage-stock'])->group(function () {
 *     include_once 'expiration-routes.php';
 * });
 */

use App\Http\Controllers\API\ExpirationController;
use Illuminate\Support\Facades\Route;

// Checkpoint automatique des expirations (scheduler ou appel manuelle)
Route::post('/expirations/check', [ExpirationController::class, 'checkAllExpirations'])
    ->name('expirations.check');

// Lister les produits expiréés
Route::get('/expirations/expired', [ExpirationController::class, 'getExpiredProducts'])
    ->name('expirations.expired');

// Lister les produits expirant bientôt
Route::get('/expirations/expiring-soon', [ExpirationController::class, 'getExpiringProducts'])
    ->name('expirations.expiring-soon');

// Lister les alertes en attente
Route::get('/expirations/alerts', [ExpirationController::class, 'getPendingAlerts'])
    ->name('expirations.alerts');

// Historique complet
Route::get('/expirations/history', [ExpirationController::class, 'getHistory'])
    ->name('expirations.history');

// Statistiques
Route::get('/expirations/stats', [ExpirationController::class, 'getStats'])
    ->name('expirations.stats');

// Vérifier le statut d'un stock
Route::get('/product-stocks/{id}/expiration-status', [ExpirationController::class, 'checkStatus'])
    ->name('expirations.check-status');

// Marquer une alerte comme traitée (acknowledge/resolve)
Route::post('/expirations/{id}/acknowledge', [ExpirationController::class, 'acknowledgeAlert'])
    ->name('expirations.acknowledge');

// Admin only: Forcer la consommation d'un produit expiré
Route::post('/expirations/{stockId}/force-consume', [ExpirationController::class, 'forceConsumeExpired'])
    ->name('expirations.force-consume');

// Admin only: Éliminer un lot expiré/endommagé
Route::post('/expirations/{stockId}/eliminate', [ExpirationController::class, 'eliminateBatch'])
    ->name('expirations.eliminate');

// Admin only: Retourner un lot au fournisseur
Route::post('/expirations/{stockId}/return-supplier', [ExpirationController::class, 'returnToSupplierBatch'])
    ->name('expirations.return-supplier');
