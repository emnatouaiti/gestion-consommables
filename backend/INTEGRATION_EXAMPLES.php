<?php

/**
 * EXEMPLE D'INTÉGRATION: ProductStockController
 *
 * Montrer comment intégrer le service d'expiration dans le contrôleur existant
 *
 * À ajouter dans: backend/app/Http/Controllers/API/ProductStockController.php
 */

namespace App\Http\Controllers\API;

use App\Models\ProductStock;
use App\Services\ExpirationManagementService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ProductStockController extends Controller
{
    private ExpirationManagementService $expirationService;

    public function __construct(ExpirationManagementService $expirationService)
    {
        $this->expirationService = $expirationService;
        $this->middleware('auth:sanctum');
    }

    /**
     * EXEMPLE - Créer/mettre à jour un stock avec date d'expiration
     *
     * POST /api/admin/product-stocks
     * PUT /api/admin/product-stocks/{id}
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'warehouse_location_id' => 'required|exists:warehouse_locations,id',
            'cabinet_id' => 'nullable|exists:cabinets,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'quantity' => 'required|integer|min:0',

            // NOUVEAUX CHAMPS POUR L'EXPIRATION
            'batch_number' => 'nullable|string|max:255',
            'expiration_date' => 'nullable|date',
        ]);

        // Créer le stock
        $stock = ProductStock::create($validated);

        // Si une date d'expiration a été fournie, vérifier tout de suite
        if ($validated['expiration_date']) {
            $this->expirationService->checkExpirationStatus($stock);
        }

        return response()->json([
            'message' => 'Stock créé',
            'stock' => $stock,
            'expiration_status' => $this->expirationService->getExpirationStatus($stock),
        ], 201);
    }

    /**
     * EXEMPLE - Obtenir un stock avec infos d'expiration
     *
     * GET /api/admin/product-stocks/{id}
     */
    public function show(int $id): JsonResponse
    {
        $stock = ProductStock::with('product', 'warehouseLocation', 'supplier')->findOrFail($id);

        // Ajouter infos d'expiration
        $expirationStatus = $this->expirationService->getExpirationStatus($stock);
        $canBeConsumed = $this->expirationService->canBeConsumed($stock);

        return response()->json([
            'stock' => $stock,
            'expiration' => [
                'status' => $expirationStatus,
                'can_be_consumed' => $canBeConsumed,
                'is_expired' => !$canBeConsumed,
                'expiration_date' => $stock->expiration_date,
                'batch_number' => $stock->batch_number,
                'batch_status' => $stock->batch_status,
            ],
        ]);
    }

    /**
     * EXEMPLE - Lister les stocks avec filtres d'expiration
     *
     * GET /api/admin/product-stocks
     *     ?product_id=5
     *     &warehouse_location_id=2
     *     &filter=expired           // Filtrer les expirations
     *     &filter=expiring_soon
     *     &filter=valid
     */
    public function index(Request $request): JsonResponse
    {
        $query = ProductStock::with('product', 'warehouseLocation', 'supplier');

        // Filtres existants
        if ($request->has('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->has('warehouse_location_id')) {
            $query->where('warehouse_location_id', $request->warehouse_location_id);
        }

        // NOUVEAUX FILTRES D'EXPIRATION
        $filter = $request->get('filter');

        if ($filter === 'expired') {
            // Voir uniquement les produits expiréés
            $query->where('batch_status', 'expired');
        } elseif ($filter === 'expiring_soon') {
            // Voir les produits expirant dans 7 jours
            $threshold = now()->addDays(7);
            $query->whereNotNull('expiration_date')
                ->where('batch_status', '!=', 'expired')
                ->where('quantity', '>', 0)
                ->whereBetween('expiration_date', [
                    now()->startOfDay(),
                    $threshold->endOfDay()
                ]);
        } elseif ($filter === 'valid') {
            // Voir uniquement les produits valides (non expiréés, avec stock)
            $query->where('batch_status', '!=', 'expired')
                ->where('quantity', '>', 0);
        } elseif ($filter === 'no_expiration') {
            // Voir les produits sans date d'expiration
            $query->whereNull('expiration_date');
        }

        $stocks = $query->paginate(15);

        // Enrichir chaque stock avec le statut d'expiration
        $stocks->getCollection()->transform(function ($stock) {
            return array_merge($stock->toArray(), [
                'expiration_status' => $this->expirationService->getExpirationStatus($stock),
                'can_be_consumed' => $this->expirationService->canBeConsumed($stock),
            ]);
        });

        return response()->json($stocks);
    }

    /**
     * EXEMPLE - Lors de la création d'une consommation
     *
     * Vérifier AVANT que le produit peut être consommé
     *
     * POST /api/consumable-requests
     */
    public function checkCanConsume(int $productStockId): JsonResponse
    {
        $stock = ProductStock::findOrFail($productStockId);

        // Vérifier si peut être consommé
        if (!$this->expirationService->canBeConsumed($stock)) {
            return response()->json([
                'error' => 'Ce produit est expiré et ne peut pas être consommé',
                'expiration_status' => $this->expirationService->getExpirationStatus($stock),
                'batch_number' => $stock->batch_number,
                'expiration_date' => $stock->expiration_date,
            ], 422); // Unprocessable Entity
        }

        return response()->json([
            'can_consume' => true,
            'message' => 'Ce stock peut être consommé',
        ]);
    }
}

/**
 * INTEGRATION DANS LE CONSUMABLE REQUEST CONTROLLER
 *
 * Avant d'approuver une consommation, vérifier l'expiration
 */

class ConsumableRequestController extends Controller
{
    private ExpirationManagementService $expirationService;

    public function __construct(ExpirationManagementService $expirationService)
    {
        $this->expirationService = $expirationService;
    }

    /**
     * POST /api/consumable-requests/{id}/approve
     *
     * Avant d'approuver: vérifier que le produit n'est pas expiré
     */
    public function approve($requestId): JsonResponse
    {
        $request = ConsumableRequest::findOrFail($requestId);

        // Chercher le stock à consommer
        $stock = ProductStock::where('product_id', $request->product_id)
            ->whereNotNull('expiration_date')
            ->orderBy('expiration_date', 'asc')
            ->first();

        // Vérifier l'expiration
        if ($stock && !$this->expirationService->canBeConsumed($stock)) {
            return response()->json([
                'error' => 'Stock expiré',
                'message' => $this->expirationService->getExpirationStatus($stock),
                'available_alternatives' => null,
            ], 422);
        }

        // Approuver
        $request->update(['status' => 'approved']);

        return response()->json([
            'message' => 'Consommation approuvée',
            'request' => $request,
        ]);
    }
}

/**
 * INTEGRATION DANS LES ROUTES
 *
 * À ajouter dans: backend/routes/api.php
 */

// Vérifier si un stock peut être consumé
Route::get(
    '/admin/product-stocks/{id}/can-consume',
    [ProductStockController::class, 'checkCanConsume']
)->name('product-stocks.check-can-consume');

// Avec le filtre d'expiration
Route::get('/admin/product-stocks', [ProductStockController::class, 'index'])
    // ?filter=expired
    // ?filter=expiring_soon
    // ?filter=valid
    // ?filter=no_expiration
    ->name('product-stocks.index');

/**
 * UTILISATION FRONTEND (Angular)
 */

/*

// Dans le composant Angular pour consommer un produit
export class ConsumableRequestComponent {
  constructor(private adminStockService: AdminStockService) {}

  async onRequestConsumption(productStockId: number, quantity: number) {
    // Vérifier d'abord que le stock peut être consommé
    try {
      const response = await firstValueFrom(
        this.adminStockService.checkCanConsume(productStockId)
      );

      if (response.can_consume) {
        // Approuver la consommation
        this.submitRequest();
      } else {
        // Afficher l'erreur
        this.showError('Ce produit est expiré et ne peut pas être consommé');
      }
    } catch (error) {
      this.showError(error.error.message);
    }
  }

  // Afficher les produits expirant bientôt
  async loadExpiringProducts() {
    try {
      const response = await firstValueFrom(
        this.adminStockService.getExpiringProducts({ days: 7 })
      );

      // Afficher dans un badge/alerte sur l'interface
      this.expiringCount = response.data.length;
    } catch (error) {
      console.error('Erreur lors du chargement', error);
    }
  }
}

// Dans le service Angular
@Injectable({ providedIn: 'root' })
export class AdminStockService {
  constructor(private http: HttpClient) {}

  checkCanConsume(stockId: number) {
    return this.http.get<any>(
      `/api/admin/product-stocks/${stockId}/can-consume`
    );
  }

  getExpiringProducts(params?: { days?: number }) {
    return this.http.get<any>('/api/admin/expirations/expiring-soon', {
      params: params,
    });
  }

  getExpiredProducts() {
    return this.http.get<any>('/api/admin/expirations/expired');
  }

  getPendingAlerts() {
    return this.http.get<any>('/api/admin/expirations/alerts');
  }

  acknowledgeAlert(alertId: number, status: string, notes?: string) {
    return this.http.post<any>(
      `/api/admin/expirations/${alertId}/acknowledge`,
      { status, notes }
    );
  }
}

*/
