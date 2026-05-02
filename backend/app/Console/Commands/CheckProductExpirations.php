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
    protected $signature = 'expirations:check';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Vérifie les produits expirés ou proches de l\'expiration et alerte les responsables';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = Carbon::today();
        
        // Find stocks with expiration dates and quantity > 0
        $stocks = ProductStock::with('product')
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
            return;
        }

        // Notify Responsables and Administrateurs
        $responsables = User::whereHas('roles', function ($query) {
            $query->whereIn('name', ['Administrateur', 'Responsable de stock', 'Responsable', 'Gestionnaire']);
        })->get();

        foreach ($responsables as $user) {
            $user->notify(new ProductExpirationAlert($expiringSoon, $expired));
        }

        $this->info(count($expiringSoon) . ' lots expirent bientôt et ' . count($expired) . ' lots sont expirés. Notifications envoyées à ' . $responsables->count() . ' utilisateurs.');
    }
}
