<?php

use App\Http\Controllers\API\AdminController;
use App\Http\Controllers\API\ReportController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\CategoryController;
use App\Http\Controllers\API\PasswordResetController;
use App\Http\Controllers\API\ProductController;
use App\Http\Controllers\API\ProductStockController;
use App\Http\Controllers\API\SocialAuthController;
use App\Http\Controllers\API\SupplierContactController;
use App\Http\Controllers\API\SupplierController;
use App\Http\Controllers\API\UnitController;
use App\Http\Controllers\API\DocumentController;
use App\Http\Controllers\API\MessageController;
use App\Http\Controllers\API\UserManagementController;
use App\Http\Controllers\API\WarehouseCabinetController;
use App\Http\Controllers\API\WarehouseController;
use App\Http\Controllers\API\WarehouseLocationController;
use App\Http\Controllers\API\WarehouseRoomController;
use App\Http\Controllers\ConsumableRequestController;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->group(function () {
    Route::get('ping', function () {
        return response()->json(['pong' => true]);
    });

    Route::get('test/status', function () {
        return response()->json([
            'suppliers' => \DB::table('suppliers')->count(),
            'products' => \DB::table('products')->count(),
            'product_supplier' => \DB::table('product_supplier')->count(),
            'supplier_reviews' => \DB::table('supplier_reviews')->count(),
            'sample_supplier' => \App\Models\Supplier::with('products', 'reviews')->first(),
            'sample_product' => \App\Models\Product::with('suppliers')->first(),
            'all_associations' => \DB::table('product_supplier')->get(),
        ]);
    });

    Route::get('debug/stocks', function () {
        $stocks = \App\Models\ProductStock::with('warehouseLocation', 'warehouseCabinet')->limit(5)->get();

        $result = [];
        foreach ($stocks as $stock) {
            $result[] = [
                'id' => $stock->id,
                'warehouse_location_id' => $stock->warehouse_location_id,
                'cabinet_id' => $stock->cabinet_id,
                'warehouseLocation' => $stock->warehouseLocation ? [
                    'id' => $stock->warehouseLocation->id,
                    'code' => $stock->warehouseLocation->code,
                    'name' => $stock->warehouseLocation->name,
                ] : null,
                'warehouseCabinet' => $stock->warehouseCabinet ? [
                    'id' => $stock->warehouseCabinet->id,
                    'code' => $stock->warehouseCabinet->code,
                    'name' => $stock->warehouseCabinet->name,
                ] : null,
            ];
        }

        return response()->json($result);
    });


    // PUBLIC CATEGORIES - Accessible to authenticated users for OCR workflows
    Route::middleware('auth:sanctum')->get('categories/public', [CategoryController::class, 'index']);

    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::get('auth/google', [SocialAuthController::class, 'redirectToGoogle']);
    Route::get('auth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);
    Route::post('forgot-password', [PasswordResetController::class, 'sendResetLink']);
    Route::post('verify-code', [PasswordResetController::class, 'verifyCode']);
    Route::post('reset-password', [PasswordResetController::class, 'reset']);

    Route::middleware(['auth:sanctum', 'lastseen'])->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('user', [AuthController::class, 'user']);
        Route::put('user/profile', [AuthController::class, 'updateProfile']);
        Route::put('user/password', [AuthController::class, 'changePassword']);
        Route::get('notifications', [AuthController::class, 'notifications']);
        Route::get('notifications/unread-count', [AuthController::class, 'unreadNotificationsCount']);
        Route::put('notifications/read-all', [AuthController::class, 'markAllNotificationsRead']);

        // List products for requester form
        Route::get('products/request-list', [ProductController::class, 'requestList']);

        Route::prefix('consumable-requests')->group(function () {
            Route::get('/', [ConsumableRequestController::class, 'index']);
            Route::post('/', [ConsumableRequestController::class, 'store']);
            Route::put('/{id}', [ConsumableRequestController::class, 'update']);
            Route::delete('/{id}', [ConsumableRequestController::class, 'destroy']);
            Route::put('/{id}/approve', [ConsumableRequestController::class, 'approve']);
            Route::put('/{id}/reject', [ConsumableRequestController::class, 'reject']);
            Route::put('/{id}/confirm-exit', [ConsumableRequestController::class, 'confirmExit']);
        });
        // Stock movements endpoints
        Route::prefix('stock-movements')->middleware('role:Agent de stock|Agent|Responsable de stock|Responsable|Gestionnaire')->group(function () {
            Route::get('/', [\App\Http\Controllers\StockMovementController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\StockMovementController::class, 'store']);
            Route::get('/{id}', [\App\Http\Controllers\StockMovementController::class, 'show']);
            Route::put('/{id}', [\App\Http\Controllers\StockMovementController::class, 'update']);
            Route::delete('/{id}', [\App\Http\Controllers\StockMovementController::class, 'destroy']);
            Route::put('/{id}/validate', [\App\Http\Controllers\StockMovementController::class, 'validateMovement']);
            Route::put('/{id}/approve', [\App\Http\Controllers\StockMovementController::class, 'approve']);
            Route::put('/{id}/cancel', [\App\Http\Controllers\StockMovementController::class, 'cancelMovement']);
            Route::post('/{id}/reject', [\App\Http\Controllers\StockMovementController::class, 'reject']);
        });

        // Chat
        Route::prefix('chat')->group(function () {
            Route::get('users', [MessageController::class, 'listUsers']);
            Route::get('conversations', [MessageController::class, 'getConversations']);
            Route::get('messages/{user}', [MessageController::class, 'getMessages'])->middleware('chat.access');
            Route::post('messages', [MessageController::class, 'sendMessage'])->middleware('chat.access');
            Route::get('unread-count', [MessageController::class, 'unreadCount']);
        });
    });

    Route::middleware(['auth:sanctum'])->group(function () {
        // Public warehouses list for all authenticated users (needed for user form)
        Route::get('warehouses/list', [WarehouseController::class, 'index']);

        Route::get('admin/users', [UserManagementController::class, 'index']);

        // Section: ADMIN ONLY
        Route::middleware('role:Administrateur')->group(function () {
            Route::post('admin/users', [UserManagementController::class, 'store']);
            Route::get('admin/users/{id}', [UserManagementController::class, 'show']);
            Route::put('admin/users/{id}', [UserManagementController::class, 'update']);
            Route::delete('admin/users/{id}', [UserManagementController::class, 'destroy']);
            Route::post('admin/users/{id}/restore', [UserManagementController::class, 'restore']);
            Route::delete('admin/users/{id}/force', [UserManagementController::class, 'forceDestroy']);
            Route::get('admin/roles', [UserManagementController::class, 'roles']);
            Route::get('admin/reports/stock', [ReportController::class, 'exportStock']);
            Route::get('admin/reports/movements', [ReportController::class, 'exportMovements']);
        });

        // Section: ADMIN & DIRECTEUR
        Route::middleware('role:Administrateur|Directeur|Validateur')->group(function () {
            Route::get('admin/dashboard', [AdminController::class, 'dashboard']);
            Route::get('admin/recommendations', [AdminController::class, 'recommendations']);
        });

        // Section: REDUCED ADMIN & RESPONSABLE
        Route::middleware('role:Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('admin/categories', [CategoryController::class, 'index']);
            Route::post('admin/categories', [CategoryController::class, 'store']);
            Route::get('admin/categories/{id}', [CategoryController::class, 'show']);
            Route::put('admin/categories/{id}', [CategoryController::class, 'update']);
            Route::delete('admin/categories/{id}', [CategoryController::class, 'destroy']);

            Route::get('admin/units', [UnitController::class, 'index']);
            Route::post('admin/units', [UnitController::class, 'store']);
            Route::put('admin/units/{unit}', [UnitController::class, 'update']);
            Route::delete('admin/units/{unit}', [UnitController::class, 'destroy']);
        });

        // Section: RESPONSABLE & AGENT
        Route::middleware('role:Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('admin/products', [ProductController::class, 'index']);
            Route::post('admin/products', [ProductController::class, 'store']);
            Route::get('admin/products/{id}', [ProductController::class, 'show']);
            Route::put('admin/products/{id}', [ProductController::class, 'update']);
            Route::put('admin/products/{id}/activate', [ProductController::class, 'activate']);
            Route::delete('admin/products/{id}', [ProductController::class, 'destroy']);
            Route::post('admin/products/generate-descriptions', [ProductController::class, 'generateDescriptions']);
            Route::get('admin/products/{id}/history', [ProductController::class, 'history']);

            // References CRUD endpoints (fabricants, marques, modeles)
            Route::get('admin/fabricants', [\App\Http\Controllers\API\ReferencesController::class, 'listFabricants']);
            Route::post('admin/fabricants', [\App\Http\Controllers\API\ReferencesController::class, 'storeFabricant']);
            Route::put('admin/fabricants/{id}', [\App\Http\Controllers\API\ReferencesController::class, 'updateFabricant']);
            Route::delete('admin/fabricants/{id}', [\App\Http\Controllers\API\ReferencesController::class, 'deleteFabricant']);

            Route::get('admin/marques', [\App\Http\Controllers\API\ReferencesController::class, 'listMarques']);
            Route::post('admin/marques', [\App\Http\Controllers\API\ReferencesController::class, 'storeMarque']);
            Route::put('admin/marques/{id}', [\App\Http\Controllers\API\ReferencesController::class, 'updateMarque']);
            Route::delete('admin/marques/{id}', [\App\Http\Controllers\API\ReferencesController::class, 'deleteMarque']);

            Route::get('admin/modeles', [\App\Http\Controllers\API\ReferencesController::class, 'listModeles']);
            Route::post('admin/modeles', [\App\Http\Controllers\API\ReferencesController::class, 'storeModele']);
            Route::put('admin/modeles/{id}', [\App\Http\Controllers\API\ReferencesController::class, 'updateModele']);
            Route::delete('admin/modeles/{id}', [\App\Http\Controllers\API\ReferencesController::class, 'deleteModele']);

            Route::get('admin/warehouses', [WarehouseController::class, 'index']);
            Route::post('admin/warehouses', [WarehouseController::class, 'store']);
            Route::get('admin/warehouses/{warehouse}', [WarehouseController::class, 'show']);
            Route::put('admin/warehouses/{warehouse}', [WarehouseController::class, 'update']);
            Route::delete('admin/warehouses/{warehouse}', [WarehouseController::class, 'destroy']);
            Route::get('admin/warehouses/{warehouse}/products', [WarehouseController::class, 'getProducts']);

            Route::get('admin/warehouse-rooms', [WarehouseRoomController::class, 'index']);
            Route::post('admin/warehouse-rooms', [WarehouseRoomController::class, 'store']);
            Route::get('admin/warehouse-rooms/{room}', [WarehouseRoomController::class, 'show']);
            Route::put('admin/warehouse-rooms/{room}', [WarehouseRoomController::class, 'update']);
            Route::delete('admin/warehouse-rooms/{room}', [WarehouseRoomController::class, 'destroy']);
            Route::get('admin/warehouse-rooms/{room}/products', [WarehouseRoomController::class, 'getProducts']);

            Route::get('admin/warehouse-locations', [WarehouseLocationController::class, 'index']);
            Route::post('admin/warehouse-locations', [WarehouseLocationController::class, 'store']);
            Route::get('admin/warehouse-locations/{location}', [WarehouseLocationController::class, 'show']);
            Route::put('admin/warehouse-locations/{location}', [WarehouseLocationController::class, 'update']);
            Route::delete('admin/warehouse-locations/{location}', [WarehouseLocationController::class, 'destroy']);
            Route::get('admin/warehouse-locations/{location}/products', [WarehouseLocationController::class, 'getProducts']);

            Route::get('admin/warehouse-cabinets', [WarehouseCabinetController::class, 'index']);
            Route::post('admin/warehouse-cabinets', [WarehouseCabinetController::class, 'store']);
            Route::get('admin/warehouse-cabinets/{cabinet}', [WarehouseCabinetController::class, 'show']);
            Route::put('admin/warehouse-cabinets/{cabinet}', [WarehouseCabinetController::class, 'update']);
            Route::delete('admin/warehouse-cabinets/{cabinet}', [WarehouseCabinetController::class, 'destroy']);
            Route::get('admin/warehouse-cabinets/{cabinet}/products', [WarehouseCabinetController::class, 'products']);

            Route::get('admin/products/{product}/stocks', [ProductStockController::class, 'getProductStocks']);
            Route::get('admin/products/{product}/total-stock', [ProductStockController::class, 'getTotalStock']);
            Route::post('admin/products/{product}/stocks', [ProductStockController::class, 'addStock']);
            Route::put('admin/product-stocks/{stock}', [ProductStockController::class, 'updateStock']);
            Route::delete('admin/product-stocks/{stock}', [ProductStockController::class, 'removeStock']);
            Route::get('admin/product-stocks/search', [ProductStockController::class, 'searchStocks']);

            // Expiration API
            Route::get('admin/products/{product}/expiration/batches', [\App\Http\Controllers\API\ExpirationController::class, 'getBatches']);
            Route::get('admin/products/{product}/expiration/expiring-soon', [\App\Http\Controllers\API\ExpirationController::class, 'getExpiringSoon']);
            Route::get('admin/products/{product}/expiration-events', [\App\Http\Controllers\API\ExpirationController::class, 'getEvents']);

            Route::prefix('admin')->group(function () {
                include_once __DIR__ . '/expiration-routes.php';
            });
        });

        // OCR specific to Agent & Responsable
        Route::middleware('role:Agent de stock|Agent|Responsable de stock|Responsable|Gestionnaire')->group(function () {
            Route::get('admin/documents', [DocumentController::class, 'index']);
            Route::post('admin/documents', [DocumentController::class, 'store']);
            Route::put('admin/documents/{id}', [DocumentController::class, 'update']);
            Route::post('admin/documents/{id}/apply', [DocumentController::class, 'apply']);
            Route::post('admin/documents/diagnostic', [DocumentController::class, 'diagnostic']);

            // Available location endpoints for auto-selection
            Route::get('admin/warehouse/available-location', [DocumentController::class, 'findAvailableLocation']);
            Route::get('admin/warehouse/available-locations', [DocumentController::class, 'getAvailableLocations']);
        });

        // Shared across Admin, Responsable, Agent
        Route::middleware('role:Administrateur|Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('admin/suppliers', [SupplierController::class, 'index']);
            Route::post('admin/suppliers', [SupplierController::class, 'store']);
            Route::get('admin/suppliers/{supplier}', [SupplierController::class, 'show']);
            Route::put('admin/suppliers/{supplier}', [SupplierController::class, 'update']);
            Route::delete('admin/suppliers/{supplier}', [SupplierController::class, 'destroy']);
            Route::post('admin/suppliers/{supplier}/reviews', [SupplierController::class, 'addReview']);

            Route::get('admin/suppliers/{supplier}/contacts', [SupplierContactController::class, 'index']);
            Route::post('admin/suppliers/{supplier}/contacts', [SupplierContactController::class, 'store']);
            Route::put('admin/suppliers/{supplier}/contacts/{contact}', [SupplierContactController::class, 'update']);
            Route::delete('admin/suppliers/{supplier}/contacts/{contact}', [SupplierContactController::class, 'destroy']);
        });
    });

    // Proxy simplifié pour les documents et images
    Route::get('docs/{path}', function($path) {
        $disk  = \Storage::disk('public');
        $clean = ltrim((string) $path, '/\\');

        // Extraire juste le nom de fichier
        $filename = basename($clean);

        // Toutes les variantes à tester
        $candidates = [
            $clean,                           // tel quel (ex: products/foo.jpg)
            'products/'   . $filename,        // dans products/
            'documents/'  . $filename,        // dans documents/
            'suppliers/'  . $filename,        // dans suppliers/
            'photos/'     . $filename,        // dans photos/
            'stock-movements/in/' . $filename, // Images Entrées
            'stock-movements/out/' . $filename, // Images Sorties
            'documents/eliminations/' . $filename, // PV d'élimination
            'documents/returns/' . $filename,      // Bons de retour
            'documents/retours/' . $filename,      // retours PDF (ancien)
            $filename,                        // à la racine du disk public
        ];

        foreach ($candidates as $candidate) {
            if ($disk->exists($candidate)) {
                return $disk->response($candidate);
            }
        }

        abort(404);
    })->where('path', '.*');
});
