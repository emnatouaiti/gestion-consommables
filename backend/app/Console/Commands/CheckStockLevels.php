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
    protected $description = 'Vérifie les produits dont le stock est inférieur au seuil minimum et alerte les responsables';

    public function handle()
    {
        $this->info('🔍 Vérification des seuils de stock...');

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
            $this->info('✅ Aucun produit en stock critique.');
            Log::info("Scan Stock : Aucun produit sous le seuil minimum.");
            return;
        }

        // Trouver les responsables (Robust search)
        $responsables = User::whereHas('roles', function ($query) {
            $query->whereRaw("LOWER(name) IN (?, ?, ?, ?, ?)", [
                'administrateur', 'responsable de stock', 'responsable', 'gestionnaire', 'validateur'
            ]);
        })->orWhereRaw("LOWER(role) IN (?, ?, ?, ?, ?)", [
            'administrateur', 'responsable de stock', 'responsable', 'gestionnaire', 'validateur'
        ])->get();

        if ($responsables->isEmpty()) {
            $this->error("Aucun responsable trouvé pour l'alerte stock.");
            Log::warning("Alerte Stock : Aucun utilisateur trouvé pour recevoir les alertes.");
            return;
        }

        Log::info("Envoi d'alertes stock critique à : " . $responsables->pluck('email')->implode(', '));

        foreach ($responsables as $user) {
            $user->notify(new LowStockAlertNotification($lowStockProducts));
        }

        $this->info(count($lowStockProducts) . ' produits en stock critique. Notifications envoyées.');
    }
}
