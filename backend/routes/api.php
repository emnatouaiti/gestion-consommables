<?php

use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Controllers\CsrfCookieController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Products\CategoryController;
use App\Http\Controllers\Products\ProductController;
use App\Http\Controllers\Products\UnitController;
use App\Http\Controllers\Products\ReferencesController;
use App\Http\Controllers\Warehouse\WarehouseController;
use App\Http\Controllers\Warehouse\WarehouseRoomController;
use App\Http\Controllers\Warehouse\WarehouseLocationController;
use App\Http\Controllers\Warehouse\WarehouseCabinetController;
use App\Http\Controllers\Stock\ConsumableRequestController;
use App\Http\Controllers\Stock\StockMovementController;
use App\Http\Controllers\Stock\ProductStockController;
use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Suppliers\SupplierController;
use App\Http\Controllers\Suppliers\SupplierContactController;
use App\Http\Controllers\Documents\DocumentController;
use App\Http\Controllers\Chat\MessageController;
use App\Http\Controllers\Users\UserManagementController;

Route::prefix('api')->group(function () {
    Route::get('ping', function () {
        return response()->json(['pong' => true]);
    });

    Route::get('sanctum/csrf-cookie', [CsrfCookieController::class, 'show']);

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

    // Temporary unauthenticated test route for frontend smoke tests
    Route::get('test/categories', function () {
        return response()->json(
            \App\Models\Category::whereNull('parent_id')->orderBy('title')->get()
        );
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

    // --- AUTH ROUTES ---
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
    });

    // --- CATALOG ROUTES ---
    Route::middleware('auth:sanctum')->get('categories/public', [CategoryController::class, 'index']);

    Route::middleware(['auth:sanctum', 'lastseen'])->group(function () {
        Route::get('products/request-list', [ProductController::class, 'requestList']);
    });

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::middleware('role:Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('categories', [CategoryController::class, 'index']);
            Route::post('categories', [CategoryController::class, 'store']);
            Route::get('categories/{id}', [CategoryController::class, 'show']);
            Route::put('categories/{id}', [CategoryController::class, 'update']);
            Route::delete('categories/{id}', [CategoryController::class, 'destroy']);

            Route::get('units', [UnitController::class, 'index']);
            Route::post('units', [UnitController::class, 'store']);
            Route::put('units/{unit}', [UnitController::class, 'update']);
            Route::delete('units/{unit}', [UnitController::class, 'destroy']);

            Route::get('products', [ProductController::class, 'index']);
            Route::post('products', [ProductController::class, 'store']);
            Route::get('products/{id}', [ProductController::class, 'show']);
            Route::put('products/{id}', [ProductController::class, 'update']);
            Route::put('products/{id}/activate', [ProductController::class, 'activate']);
            Route::delete('products/{id}', [ProductController::class, 'destroy']);
            Route::post('products/generate-descriptions', [ProductController::class, 'generateDescriptions']);
            Route::get('products/{id}/history', [ProductController::class, 'history']);


            Route::get('marques', [ReferencesController::class, 'listMarques']);
            Route::post('marques', [ReferencesController::class, 'storeMarque']);
            Route::put('marques/{id}', [ReferencesController::class, 'updateMarque']);
            Route::delete('marques/{id}', [ReferencesController::class, 'deleteMarque']);

            Route::get('modeles', [ReferencesController::class, 'listModeles']);
            Route::post('modeles', [ReferencesController::class, 'storeModele']);
            Route::put('modeles/{id}', [ReferencesController::class, 'updateModele']);
            Route::delete('modeles/{id}', [ReferencesController::class, 'deleteModele']);
        });
    });

    // --- WAREHOUSE ROUTES ---
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('warehouses/list', [WarehouseController::class, 'index']);

        Route::middleware('role:Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('warehouses', [WarehouseController::class, 'index']);
            Route::post('warehouses', [WarehouseController::class, 'store']);
            Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show']);
            Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update']);
            Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy']);
            Route::get('warehouses/{warehouse}/products', [WarehouseController::class, 'getProducts']);

            Route::get('warehouse-rooms', [WarehouseRoomController::class, 'index']);
            Route::post('warehouse-rooms', [WarehouseRoomController::class, 'store']);
            Route::get('warehouse-rooms/{room}', [WarehouseRoomController::class, 'show']);
            Route::put('warehouse-rooms/{room}', [WarehouseRoomController::class, 'update']);
            Route::delete('warehouse-rooms/{room}', [WarehouseRoomController::class, 'destroy']);
            Route::get('warehouse-rooms/{room}/products', [WarehouseRoomController::class, 'getProducts']);

            Route::get('warehouse-locations', [WarehouseLocationController::class, 'index']);
            Route::post('warehouse-locations', [WarehouseLocationController::class, 'store']);
            Route::get('warehouse-locations/{location}', [WarehouseLocationController::class, 'show']);
            Route::put('warehouse-locations/{location}', [WarehouseLocationController::class, 'update']);
            Route::delete('warehouse-locations/{location}', [WarehouseLocationController::class, 'destroy']);
            Route::get('warehouse-locations/{location}/products', [WarehouseLocationController::class, 'getProducts']);

            Route::get('warehouse-cabinets', [WarehouseCabinetController::class, 'index']);
            Route::post('warehouse-cabinets', [WarehouseCabinetController::class, 'store']);
            Route::get('warehouse-cabinets/{cabinet}', [WarehouseCabinetController::class, 'show']);
            Route::put('warehouse-cabinets/{cabinet}', [WarehouseCabinetController::class, 'update']);
            Route::delete('warehouse-cabinets/{cabinet}', [WarehouseCabinetController::class, 'destroy']);
            Route::get('warehouse-cabinets/{cabinet}/products', [WarehouseCabinetController::class, 'products']);
        });
    });

    // --- STOCK ROUTES ---
    Route::middleware(['auth:sanctum', 'lastseen'])->group(function () {
        Route::prefix('consumable-requests')->group(function () {
            Route::get('/', [ConsumableRequestController::class, 'index']);
            Route::post('/', [ConsumableRequestController::class, 'store']);
            Route::put('/{id}', [ConsumableRequestController::class, 'update']);
            Route::delete('/{id}', [ConsumableRequestController::class, 'destroy']);
            Route::put('/{id}/approve', [ConsumableRequestController::class, 'approve']);
            Route::put('/{id}/reject', [ConsumableRequestController::class, 'reject']);
            Route::put('/{id}/confirm-exit', [ConsumableRequestController::class, 'confirmExit']);
        });

        Route::prefix('stock-movements')->middleware('role:Agent de stock|Agent|Responsable de stock|Responsable|Gestionnaire')->group(function () {
            Route::get('/', [StockMovementController::class, 'index']);
            Route::post('/', [StockMovementController::class, 'store']);
            Route::get('/{id}', [StockMovementController::class, 'show']);
            Route::put('/{id}', [StockMovementController::class, 'update']);
            Route::delete('/{id}', [StockMovementController::class, 'destroy']);
            Route::put('/{id}/validate', [StockMovementController::class, 'validateMovement']);
            Route::put('/{id}/approve', [StockMovementController::class, 'approve']);
            Route::put('/{id}/cancel', [StockMovementController::class, 'reject']);
            Route::post('/{id}/reject', [StockMovementController::class, 'reject']);
        });
    });

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::middleware('role:Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('products/{product}/stocks', [ProductStockController::class, 'getProductStocks']);
            Route::get('products/{product}/total-stock', [ProductStockController::class, 'getTotalStock']);
            Route::post('products/{product}/stocks', [ProductStockController::class, 'addStock']);
            Route::put('product-stocks/{stock}', [ProductStockController::class, 'updateStock']);
            Route::delete('product-stocks/{stock}', [ProductStockController::class, 'removeStock']);
            Route::get('product-stocks/search', [ProductStockController::class, 'searchStocks']);
        });
    });

    // --- MISC / ADMIN ROUTES ---
    Route::middleware(['auth:sanctum', 'lastseen'])->group(function () {
        Route::prefix('chat')->group(function () {
            Route::get('users', [MessageController::class, 'listUsers']);
            Route::get('conversations', [MessageController::class, 'getConversations']);
            Route::get('messages/{user}', [MessageController::class, 'getMessages'])->middleware('chat.access');
            Route::post('messages', [MessageController::class, 'sendMessage'])->middleware('chat.access');
            Route::get('unread-count', [MessageController::class, 'unreadCount']);
        });
    });

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('users', [UserManagementController::class, 'index']);

        Route::middleware('role:Administrateur')->group(function () {
            Route::post('users', [UserManagementController::class, 'store']);
            Route::get('users/archived', [UserManagementController::class, 'index'])->withoutMiddleware('role:Administrateur');
            Route::get('users/{id}', [UserManagementController::class, 'show']);
            Route::put('users/{id}', [UserManagementController::class, 'update']);
            Route::delete('users/{id}', [UserManagementController::class, 'destroy']);
            Route::post('users/{id}/restore', [UserManagementController::class, 'restore']);
            Route::delete('users/{id}/force', [UserManagementController::class, 'forceDestroy']);
            Route::delete('users/{id}/force-delete', [UserManagementController::class, 'forceDestroy']);
            Route::get('roles', [UserManagementController::class, 'roles']);
            
            Route::get('reports/stock', [ReportController::class, 'exportStock']);
            Route::get('reports/movements', [ReportController::class, 'exportMovements']);
        });

        // Le dashboard filtre lui-même les données selon le rôle
        Route::get('dashboard', [AdminController::class, 'dashboard']);

        Route::middleware('role:Administrateur|Directeur|Validateur|Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('recommendations', [AdminController::class, 'recommendations']);
        });

        Route::middleware('role:Agent de stock|Agent|Responsable de stock|Responsable|Gestionnaire|Directeur')->group(function () {
            Route::get('documents', [DocumentController::class, 'index']);
            Route::post('documents', [DocumentController::class, 'store']);
            Route::put('documents/{id}', [DocumentController::class, 'update']);
            Route::post('documents/{id}/apply', [DocumentController::class, 'apply']);
            Route::get('documents/{id}/download', [DocumentController::class, 'download']);
            Route::post('documents/diagnostic', [DocumentController::class, 'diagnostic']);

            Route::get('warehouse/available-location', [DocumentController::class, 'findAvailableLocation']);
            Route::get('warehouse/available-locations', [DocumentController::class, 'getAvailableLocations']);
        });

        Route::middleware('role:Administrateur|Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
            Route::get('suppliers', [SupplierController::class, 'index']);
            Route::post('suppliers', [SupplierController::class, 'store']);
            Route::get('suppliers/{supplier}', [SupplierController::class, 'show']);
            Route::put('suppliers/{supplier}', [SupplierController::class, 'update']);
            Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy']);
            Route::post('suppliers/{supplier}/reviews', [SupplierController::class, 'addReview']);

            Route::get('suppliers/{supplier}/contacts', [SupplierContactController::class, 'index']);
            Route::post('suppliers/{supplier}/contacts', [SupplierContactController::class, 'store']);
            Route::put('suppliers/{supplier}/contacts/{contact}', [SupplierContactController::class, 'update']);
            Route::delete('suppliers/{supplier}/contacts/{contact}', [SupplierContactController::class, 'destroy']);
        });
    });

    // Proxy simplifiÃ pour les documents et images
    Route::get('docs/{path}', function($path) {
        $disk  = \Storage::disk('public');
        $clean = ltrim((string) $path, '/\\');

        $filename = basename($clean);

        $candidates = [
            $clean,
            'products/'   . $filename,
            'documents/'  . $filename,
            'suppliers/'  . $filename,
            'photos/'     . $filename,
            'stock-movements/in/' . $filename,
            'stock-movements/out/' . $filename,
            'responses/' . $filename,
            'documents/eliminations/' . $filename,
            'documents/returns/' . $filename,
            'documents/retours/' . $filename,
            $filename,
        ];

        foreach ($candidates as $candidate) {
            if ($disk->exists($candidate)) {
                return $disk->response($candidate);
            }
        }

        abort(404);
    })->where('path', '.*');
});
