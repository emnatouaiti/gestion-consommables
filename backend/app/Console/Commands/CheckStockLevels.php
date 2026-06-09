<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Product;
use App\Models\User;
use App\Notifications\LowStockAlertNotification;
use Illuminate\Support\Facades\Log;

class CheckStockLevels extends Command
{
    protected $signature = 'stock:alert';
    protected $description = 'VÃrifie les produits dont le stock est infÃrieur au seuil minimum et alerte les responsables';

    public function handle()
    {
        $this->info('ðŸ” VÃrification des seuils de stock...');

        // Trouver les produits sous le seuil (et actifs)
        $lowStockProducts = Product::where('status', 'active')
            ->whereNotNull('seuil_min')
            ->whereRaw('stock_quantity <= seuil_min')
            ->get(['id', 'title', 'stock_quantity', 'seuil_min'])
            ->map(function($p) {
                return [
                    'title' => $p->title,
                    'current' => $p->stock_quantity,
                    'min' => $p->seuil_min
                ];
            })->toArray();

        if (empty($lowStockProducts)) {
            $this->info('âœ… Aucun produit en stock critique.');
            Log::info("Scan Stock : Aucun produit sous le seuil minimum.");
            return;
        }

        // Trouver les responsables (Robust search)
        $responsables = User::whereHas('role', function ($query) {
            $query->whereRaw("LOWER(name) IN (?, ?, ?, ?, ?)", [
                'administrateur', 'responsable de stock', 'responsable', 'gestionnaire', 'validateur'
            ]);
        })->get();

        if ($responsables->isEmpty()) {
            $this->error("Aucun responsable trouvÃ pour l'alerte stock.");
            Log::warning("Alerte Stock : Aucun utilisateur trouvÃ pour recevoir les alertes.");
            return;
        }

        Log::info("Envoi d'alertes stock critique Ã  : " . $responsables->pluck('email')->implode(', '));

        foreach ($responsables as $user) {
            $user->notify(new LowStockAlertNotification($lowStockProducts));
        }

        $this->info(count($lowStockProducts) . ' produits en stock critique. Notifications envoyÃes.');
    }
}
