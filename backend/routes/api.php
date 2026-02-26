<?php

use App\Http\Controllers\API\AdminController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\CategoryController;
use App\Http\Controllers\API\PasswordResetController;
use App\Http\Controllers\API\ProductController;
use App\Http\Controllers\API\ProductStockController;
use App\Http\Controllers\API\SocialAuthController;
use App\Http\Controllers\API\SupplierContactController;
use App\Http\Controllers\API\SupplierController;
use App\Http\Controllers\API\UnitController;
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

    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::get('auth/google', [SocialAuthController::class, 'redirectToGoogle']);
    Route::get('auth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);
    Route::post('forgot-password', [PasswordResetController::class, 'sendResetLink']);
    Route::post('verify-code', [PasswordResetController::class, 'verifyCode']);
    Route::post('reset-password', [PasswordResetController::class, 'reset']);

    Route::middleware('auth:sanctum')->group(function () {
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
        });
    });

    Route::middleware(['auth:sanctum', 'role:Administrateur'])->group(function () {
        Route::get('admin/dashboard', [AdminController::class, 'dashboard']);

        Route::get('admin/users', [UserManagementController::class, 'index']);
        Route::post('admin/users', [UserManagementController::class, 'store']);
        Route::get('admin/users/{id}', [UserManagementController::class, 'show']);
        Route::put('admin/users/{id}', [UserManagementController::class, 'update']);
        Route::delete('admin/users/{id}', [UserManagementController::class, 'destroy']);
        Route::post('admin/users/{id}/restore', [UserManagementController::class, 'restore']);
        Route::delete('admin/users/{id}/force', [UserManagementController::class, 'forceDestroy']);
        Route::get('admin/roles', [UserManagementController::class, 'roles']);

        Route::get('admin/categories', [CategoryController::class, 'index']);
        Route::post('admin/categories', [CategoryController::class, 'store']);
        Route::get('admin/categories/{id}', [CategoryController::class, 'show']);
        Route::put('admin/categories/{id}', [CategoryController::class, 'update']);
        Route::delete('admin/categories/{id}', [CategoryController::class, 'destroy']);

        Route::get('admin/products', [ProductController::class, 'index']);
        Route::post('admin/products', [ProductController::class, 'store']);
        Route::get('admin/products/{id}', [ProductController::class, 'show']);
        Route::put('admin/products/{id}', [ProductController::class, 'update']);
        Route::delete('admin/products/{id}', [ProductController::class, 'destroy']);
        Route::get('admin/products/{id}/barcode', [ProductController::class, 'downloadBarcode']);

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

        Route::get('admin/products/{product}/stocks', [ProductStockController::class, 'getProductStocks']);
        Route::get('admin/products/{product}/total-stock', [ProductStockController::class, 'getTotalStock']);
        Route::post('admin/products/{product}/stocks', [ProductStockController::class, 'addStock']);
        Route::put('admin/product-stocks/{stock}', [ProductStockController::class, 'updateStock']);
        Route::delete('admin/product-stocks/{stock}', [ProductStockController::class, 'removeStock']);
        Route::get('admin/product-stocks/search', [ProductStockController::class, 'searchStocks']);

        Route::get('admin/suppliers', [SupplierController::class, 'index']);
        Route::post('admin/suppliers', [SupplierController::class, 'store']);
        Route::get('admin/suppliers/{supplier}', [SupplierController::class, 'show']);
        Route::put('admin/suppliers/{supplier}', [SupplierController::class, 'update']);
        Route::delete('admin/suppliers/{supplier}', [SupplierController::class, 'destroy']);
        Route::post('admin/suppliers/{supplier}/reviews', [SupplierController::class, 'addReview']);

        Route::get('admin/units', [UnitController::class, 'index']);
        Route::post('admin/units', [UnitController::class, 'store']);
        Route::put('admin/units/{unit}', [UnitController::class, 'update']);
        Route::delete('admin/units/{unit}', [UnitController::class, 'destroy']);

        Route::get('admin/suppliers/{supplier}/contacts', [SupplierContactController::class, 'index']);
        Route::post('admin/suppliers/{supplier}/contacts', [SupplierContactController::class, 'store']);
        Route::put('admin/suppliers/{supplier}/contacts/{contact}', [SupplierContactController::class, 'update']);
        Route::delete('admin/suppliers/{supplier}/contacts/{contact}', [SupplierContactController::class, 'destroy']);
    });
});
