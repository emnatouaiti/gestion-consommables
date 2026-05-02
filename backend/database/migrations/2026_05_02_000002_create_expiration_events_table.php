<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migration: Créer une table d'historique des alertes d'expiration
     *
     * Contexte:
     * - Chaque produit expiré génère des événements (alerte, blocage, suppression)
     * - Permet de suivre les actions prises et d'auditer les décisions
     * - Historique complet pour les rapports
     */
    public function up(): void
    {
        Schema::create('expiration_events', function (Blueprint $table) {
            $table->id();

            // Références
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_stock_id')->constrained('product_stocks')->cascadeOnDelete();

            // Détails du produit expiré
            $table->string('batch_number')->nullable();
            $table->date('expiration_date');
            $table->unsignedInteger('quantity_affected');

            // Type d'événement
            $table->enum('event_type', [
                'alert_7days',           // Alerte 7 jours avant expiration
                'alert_expired',          // Alerte jour de l'expiration
                'blocked_from_consumption', // Blocage après expiration
                'marked_as_expired',      // Marqué comme expiré
                'consumed_expired',       // Consommé après expiration (admin override)
                'disposed'                // Jeté/Déchet
            ]);

            // Statut de l'alerte
            $table->enum('status', ['pending', 'acknowledged', 'resolved', 'ignored'])->default('pending');

            // Détails de l'action
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
