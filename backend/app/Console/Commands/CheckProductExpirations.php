<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ProductStock;
use App\Models\User;
use App\Notifications\ProductExpirationAlert;
use Carbon\Carbon;

class CheckProductExpirations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'expirations:alert';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Scanne les stocks et envoie des alertes email pour les produits expirés';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = Carbon::today();
        
        // Find stocks with expiration dates and quantity > 0
        $stocks = ProductStock::with([
            'product', 
            'warehouseLocation.room.warehouse', 
            'warehouseCabinet.room.warehouse'
        ])
            ->whereNotNull('expiration_date')
            ->where('quantity', '>', 0)
            ->get();

        $expiringSoon = [];
        $expired = [];

        foreach ($stocks as $stock) {
            if (!$stock->product || $stock->product->status !== 'active') {
                continue;
            }

            $expDate = Carbon::parse($stock->expiration_date)->startOfDay();
            $daysLeft = $today->diffInDays($expDate, false);

            if ($daysLeft < 0) {
                $expired[] = [
                    'stock' => $stock,
                    'days' => abs((int) $daysLeft),
                    'status' => 'expired'
                ];
            } elseif ($daysLeft <= 7) {
                $expiringSoon[] = [
                    'stock' => $stock,
                    'days' => (int) $daysLeft,
                    'status' => 'expiring_soon'
                ];
            }
        }

        if (count($expiringSoon) === 0 && count($expired) === 0) {
            $this->info('Aucun produit expiré ou proche de l\'expiration.');
            \Illuminate\Support\Facades\Log::info("Scan Expiration : Aucun produit problématique détecté.");
            return;
        }

        // Notify Responsables and Administrateurs (Robust search)
        $responsables = User::whereHas('role', function ($query) {
            $query->whereRaw("LOWER(name) IN (?, ?, ?, ?, ?)", [
                'administrateur', 
                'responsable de stock', 
                'responsable', 
                'gestionnaire', 
                'validateur'
            ]);
        })->orWhereRaw("LOWER(role) IN (?, ?, ?, ?, ?)", [
            'administrateur', 
            'responsable de stock', 
            'responsable', 
            'gestionnaire', 
            'validateur'
        ])->get();

        if ($responsables->isEmpty()) {
            $this->error("Aucun utilisateur responsable trouvé.");
            \Illuminate\Support\Facades\Log::warning("Alerte Expiration : Aucun utilisateur trouvé avec les rôles administratifs.");
            return;
        }

        \Illuminate\Support\Facades\Log::info("Envoi d'alertes expiration à : " . $responsables->pluck('email')->implode(', '));

        foreach ($responsables as $user) {
            $user->notify(new ProductExpirationAlert($expiringSoon, $expired));
        }

        $this->info(count($expiringSoon) . ' lots expirent bientôt et ' . count($expired) . ' lots sont expirés. Notifications envoyées.');
    }
}
