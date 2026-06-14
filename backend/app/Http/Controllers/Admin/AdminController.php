<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function dashboard(Request $request)
    {
        $user = $request->user();
        $userId = $user ? $user->id : null;
        $userRole = $user ? strtolower($user->role?->name ?? '') : '';

        // Check if user has admin-like roles for global stats
        $isAdmin = in_array($userRole, ['administrateur', 'admin']);
        $isDirector = in_array($userRole, ['directeur', 'directeur gÃnÃral', 'dg']);
        $isManager = in_array($userRole, ['responsable', 'responsable de stock', 'gestionnaire', 'agent']);
        $isStandardUser = !$isAdmin && !$isDirector && !$isManager;

        // Users stats using SoftDeletes (only for admins)
        $totalUsers = $isAdmin ? \App\Models\User::withTrashed()->count() : 0;
        $activeUsers = $isAdmin ? \App\Models\User::count() : 0;
        $archivedUsers = $isAdmin ? \App\Models\User::onlyTrashed()->count() : 0;

        // Products, Categories, Warehouses stats (only for managers/directors, NOT for admins)
        $totalProducts = ($isManager || $isDirector) ? \App\Models\Product::count() : 0;
        $totalCategories = ($isManager || $isDirector) ? \App\Models\Category::count() : 0;
        $totalWarehouses = ($isManager || $isDirector) ? \App\Models\Warehouse::count() : 0;

        // Estimated Stock Value calculation is disabled since purchase_price is removed
        $totalStockValue = 0;

        // Stock alerts: Products where sum of quantities in all locations < product threshold (only for managers/directors)
        $lowStockProducts = ($isManager || $isDirector) ? \App\Models\Product::withSum('stocks', 'quantity')
            ->get()
            ->filter(function ($p) {
            $threshold = $p->seuil_min ?? 10; // Use individual threshold or default to 10
            return ($p->stocks_sum_quantity ?? 0) < $threshold;
        })->count() : 0;

        // User-specific stats
        $myRequests = 0;
        $myPendingRequests = 0;
        $myApprovedRequests = 0;
        $myRejectedRequests = 0;
        $myMovements = 0;
        $myPendingMovements = 0;
        $myDocuments = 0;

        if ($userId) {
            // Consumable requests for this user
            $myRequests = \App\Models\ConsumableRequest::where('user_id', $userId)->count();
            $myPendingRequests = \App\Models\ConsumableRequest::where('user_id', $userId)
                ->whereIn('status', ['pending', 'validated_by_manager', 'approved_pending_exit'])
                ->count();
            $myApprovedRequests = \App\Models\ConsumableRequest::where('user_id', $userId)
                ->where('status', 'approved')
                ->count();
            $myRejectedRequests = \App\Models\ConsumableRequest::where('user_id', $userId)
                ->where('status', 'rejected')
                ->count();

            // Stock movements created by this user
            $myMovements = \App\Models\StockMovement::where('created_by', $userId)->count();
            $myPendingMovements = \App\Models\StockMovement::where('created_by', $userId)
                ->where('status', 'pending_validation')
                ->count();

            // Documents OCR processed by this user
            $myDocuments = \App\Models\Document::where('user_id', $userId)->count();
        }

        // Pending validations for directors/managers
        $pendingValidations = 0;
        if ($isDirector || $isManager) {
            $pendingValidations = \App\Models\ConsumableRequest::whereIn('status', ['pending', 'validated_by_manager'])->count();
        }

        // Pending stock movements for managers
        $pendingStockMovements = 0;
        if ($isManager) {
            $pendingStockMovements = \App\Models\StockMovement::where('status', 'pending_validation')->count();
        }

        // Recent users (only for admins)
        $recentUsers = [];
        if ($isAdmin) {
            $recentUsers = \App\Models\User::orderBy('created_at', 'desc')->take(5)->get()->map(function ($user) {
                return [
                'nomprenom' => $user->nomprenom,
                'email' => $user->email,
                'photo' => $user->photo,
                'created_at' => $user->created_at,
                ];
            });
        }

        // Real Recent activities (filtered by role)
        $recentActivities = [];
        if ($isManager || $isDirector) {
            $recentActivitiesQuery = \App\Models\ProductStock::with(['product', 'warehouseLocation'])
                ->whereHas('product', fn ($q) => $q->where('status', 'active'));

            if ($userId && $user && $user->depot_id) {
                // For managers with depot assignment, show only activities related to their depot
                $recentActivitiesQuery->whereHas('warehouseLocation.room', function($q) use ($user) {
                    $q->where('warehouse_id', $user->depot_id);
                });
            }

            $recentActivities = $recentActivitiesQuery->orderBy('created_at', 'desc')
                ->take(8)
                ->get()
                ->map(function ($ps) {
                $loc = $ps->warehouseLocation;
                $locCode = $loc ? $loc->code : ($ps->warehouseCabinet ? $ps->warehouseCabinet->code : 'Empl. inconnu');
                return [
                'type' => 'stock',
                'icon' => 'fas fa-box',
                'description' => "{$ps->quantity}x {$ps->product->title} -> {$locCode}",
                'created_at' => $ps->created_at,
                'notes' => $ps->notes
                ];
            });
        }

        $roles = [];
        if ($isAdmin) {
            $roles = \App\Models\User::join('roles', 'users.role_id', '=', 'roles.id')
                ->select('roles.name as role_name', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
                ->groupBy('roles.name')
                ->get()
                ->map(function ($r) use ($activeUsers) {
                return [
                'name' => $r->role_name ?: 'Sans rÃ´le',
                'count' => $r->count,
                'percentage' => $activeUsers > 0 ? round(($r->count / $activeUsers) * 100) : 0
                ];
            });
        }

        // Recent user requests for standard users
        $recentRequests = [];
        if ($isStandardUser && $userId) {
            $recentRequests = \App\Models\ConsumableRequest::with('product')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get()
                ->map(function ($req) {
                    $item = $req->product ? $req->product->title : ($req->item_name ?? 'Produit inconnu');
                    return [
                        'reference' => 'REQ-'.$req->id,
                        'status' => $req->status,
                        'created_at' => $req->created_at,
                        'items_summary' => $item . ' (x' . $req->requested_quantity . ')'
                    ];
                });
        }

        // Stock distribution by category (only for managers/directors)
        $categoryStock = [];
        if ($isManager || $isDirector) {
            $categoryStock = \App\Models\Category::withCount('products')
                ->orderBy('products_count', 'desc')
                ->take(5)
                ->get()
                ->map(function ($cat) {
                return [
                'name' => $cat->title,
                'count' => $cat->products_count,
                ];
            });
        }

        // Movement Trend: Last 7 days (only for managers/directors)
        $movementsTrend = [];
        if ($isManager || $isDirector) {
            $movementsTrend = collect(range(6, 0))->map(function ($daysAgo) {
                $date = now()->subDays($daysAgo);
                $count = \App\Models\ProductStock::whereDate('created_at', $date->toDateString())->count();
                return [
                'day' => $date->format('D'),
                'count' => $count,
                'date' => $date->toDateString()
                ];
            });
        }

        return response()->json([
            'stats' => [
                'totalUsers' => $totalUsers,
                'activeUsers' => $activeUsers,
                'archivedUsers' => $archivedUsers,
                'totalProducts' => $totalProducts,
                'totalCategories' => $totalCategories,
                'totalWarehouses' => $totalWarehouses,
                'lowStockAlerts' => $lowStockProducts,
                'totalValue' => round($totalStockValue, 2),
                // User-specific stats
                'myRequests' => $myRequests,
                'myPendingRequests' => $myPendingRequests,
                'myApprovedRequests' => $myApprovedRequests,
                'myRejectedRequests' => $myRejectedRequests,
                'myMovements' => $myMovements,
                'myPendingMovements' => $myPendingMovements,
                'myDocuments' => $myDocuments,
                'pendingValidations' => $pendingValidations,
                'pendingStockMovements' => $pendingStockMovements,
            ],
            'recentUsers' => $recentUsers,
            'recentActivities' => $recentActivities,
            'roles' => $roles,
            'categoryStock' => $categoryStock,
            'movementsTrend' => $movementsTrend,
            'recentRequests' => $recentRequests
        ]);
    }



    public function recommendations()
    {
        $products = \App\Models\Product::withSum('stocks', 'quantity')
            ->where('status', 'active')
            ->get();
        $thirtyDaysAgo = now()->subDays(30);

        $highRisk = [];
        $overStock = [];
        $events = [];

        foreach ($products as $product) {
            $totalStock = $product->stocks_sum_quantity ?? 0;

            // Calculate outputs in the last 30 days
            // Type might be 'out' or action might be 'consume' (we use product_id in stock_movement_lines)
            // But stock movements can be complex. Let's get lines for this product where movement is 'out'.
            $outQuantity = \Illuminate\Support\Facades\DB::table('stock_movement_lines')
                ->join('stock_movements', 'stock_movement_lines.stock_movement_id', '=', 'stock_movements.id')
                ->where('stock_movement_lines.product_id', $product->id)
                ->where('stock_movements.created_at', '>=', $thirtyDaysAgo)
                ->whereIn('stock_movements.type', ['out', 'sortie'])
                ->sum('stock_movement_lines.quantity');

            $dailyRate = $outQuantity / 30;

            if ($dailyRate > 0) {
                // How many days left?
                $daysLeft = $totalStock / $dailyRate;

                if ($daysLeft < 14) {
                    $highRisk[] = $product;
                    $events[] = [
                        'title' => 'Rupture probable dÃtectÃe',
                        'meta' => $product->title . ' (Reste ~' . intval($daysLeft) . ' jours)',
                        'level' => 'critical'
                    ];
                } elseif ($daysLeft > 180) {
                    $overStock[] = $product;
                }
            } else {
                if ($totalStock > 0) {
                    $overStock[] = $product;
                    if (count($overStock) < 4) {
                        $events[] = [
                            'title' => 'Sur-stock / Produit dormant',
                            'meta' => $product->title . ' (Aucun mvt rÃcent)',
                            'level' => 'info'
                        ];
                    }
                }
            }
        }

        // Limit events
        $events = collect($events)->take(5)->values();

        // Build Rows for Prevision table
        $rows = [];
        foreach (collect($highRisk)->take(10) as $p) {
            $rows[] = [
                $p->reference ?: $p->title,
                'Stock: ' . ($p->stocks_sum_quantity ?? 0),
                'Critique',
                'Commander urgemment'
            ];
        }

        return response()->json([
            'stats' => [
                ['label' => 'Produits a  risque (<14j)', 'value' => count($highRisk), 'trend' => 'Action requise'],
                ['label' => 'Produits dormants', 'value' => count($overStock), 'trend' => 'Capital immobilisÃ'],
                ['label' => 'Confiance algorithmique', 'value' => '85%', 'trend' => 'BasÃe sur 30j']
            ],
            'events' => $events,
            'rows' => $rows
        ]);
    }
}




