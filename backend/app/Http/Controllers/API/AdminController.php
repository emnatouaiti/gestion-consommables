<?php
namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function dashboard()
    {
        // Users stats using SoftDeletes
        $totalUsers = \App\Models\User::withTrashed()->count();
        $activeUsers = \App\Models\User::count(); // Default excludes soft deleted
        $archivedUsers = \App\Models\User::onlyTrashed()->count();

        $totalProducts = \App\Models\Product::count();
        $totalCategories = \App\Models\Category::count();
        $totalWarehouses = \App\Models\Warehouse::count();

        // Estimated Stock Value
        $totalStockValue = \App\Models\Product::join('product_stocks', 'products.id', '=', 'product_stocks.product_id')
            ->select(\Illuminate\Support\Facades\DB::raw('SUM(product_stocks.quantity * products.purchase_price) as total_value'))
            ->value('total_value') ?? 0;

        // Stock alerts: Products where sum of quantities in all locations < product threshold
        $lowStockProducts = \App\Models\Product::withSum('stocks', 'quantity')
            ->get()
            ->filter(function ($p) {
            $threshold = $p->seuil_min ?? 10; // Use individual threshold or default to 10
            return ($p->stocks_sum_quantity ?? 0) < $threshold;
        })->count();

        // Recent users
        $recentUsers = \App\Models\User::orderBy('created_at', 'desc')->take(5)->get()->map(function ($user) {
            return [
            'nomprenom' => $user->nomprenom,
            'email' => $user->email,
            'photo' => $user->photo,
            'created_at' => $user->created_at,
            ];
        });

        // Real Recent activities (from ProductStock)
        $recentActivities = \App\Models\ProductStock::with(['product', 'warehouseLocation'])
            ->orderBy('created_at', 'desc')
            ->take(8)
            ->get()
            ->map(function ($ps) {
            return [
            'type' => 'stock',
            'icon' => '📦',
            'description' => "{$ps->quantity}x {$ps->product->title} -> {$ps->warehouseLocation->code}",
            'created_at' => $ps->created_at,
            'notes' => $ps->notes
            ];
        });

        $roles = \App\Models\User::select('role', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
            ->groupBy('role')
            ->get()
            ->map(function ($r) use ($activeUsers) {
            return [
            'name' => $r->role ?: 'Sans rôle',
            'count' => $r->count,
            'percentage' => $activeUsers > 0 ? round(($r->count / $activeUsers) * 100) : 0
            ];
        });

        // Stock distribution by category (creative: top categories)
        $categoryStock = \App\Models\Category::withCount('products')
            ->orderBy('products_count', 'desc')
            ->take(5)
            ->get()
            ->map(function ($cat) {
            return [
            'name' => $cat->title, // Fixed: use title
            'count' => $cat->products_count,
            ];
        });

        // Movement Trend: Last 7 days
        $movementsTrend = collect(range(6, 0))->map(function ($daysAgo) {
            $date = now()->subDays($daysAgo);
            $count = \App\Models\ProductStock::whereDate('created_at', $date->toDateString())->count();
            return [
            'day' => $date->format('D'),
            'count' => $count,
            'date' => $date->toDateString()
            ];
        });

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
            ],
            'recentUsers' => $recentUsers,
            'recentActivities' => $recentActivities,
            'roles' => $roles,
            'categoryStock' => $categoryStock,
            'movementsTrend' => $movementsTrend
        ]);
    }

    public function auditLogs(Request $request)
    {
        $perPage = (int) $request->query('per_page', 20);
        $perPage = max(5, min($perPage, 100));

        $query = AuditLog::query()
            ->with('user:id,nomprenom,email,service,poste')
            ->latest();

        $search = trim((string) $request->query('q', ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('action', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('nomprenom', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $action = trim((string) $request->query('action', ''));
        if ($action !== '') {
            $query->where('action', $action);
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }

        return response()->json($query->paginate($perPage));
    }
}
