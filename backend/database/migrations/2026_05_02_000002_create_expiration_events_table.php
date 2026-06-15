<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migration: Creer une table d'historique des alertes d'expiration
     *
     * Contexte:
     * - Chaque produit expire genere des evenements (alerte, blocage, suppression)
     * - Permet de suivre les actions prises et d'auditer les decisions
     * - Historique complet pour les rapports
     */
    public function up(): void
    {
        Schema::create('expiration_events', function (Blueprint $table) {
            $table->id();

            // References
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_stock_id')->constrained('product_stocks')->cascadeOnDelete();

            // Details du produit expire
            $table->string('batch_number')->nullable();
            $table->date('expiration_date');
            $table->unsignedInteger('quantity_affected');

            // Type d'evenement
            $table->enum('event_type', [
                'alert_7days',           // Alerte 7 jours avant expiration
                'alert_expired',          // Alerte jour de l'expiration
                'blocked_from_consumption', // Blocage apres expiration
                'marked_as_expired',      // Marque comme expire
                'consumed_expired',       // Consomme apres expiration (admin override)
                'disposed'                // Jete/Dechet
            ]);

            // Statut de l'alerte
            $table->enum('status', ['pending', 'acknowledged', 'resolved', 'ignored'])->default('pending');

            // Details de l'action
            $table->text('action_details')->nullable();
            $table->text('notes')->nullable();

            // Qui a fait l'action
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();

            // Timestamps
            $table->timestamps();

            // Index pour recherches
            $table->index('product_id');
            $table->index('event_type');
            $table->index('status');
            $table->index('expiration_date');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expiration_events');
    }
};
