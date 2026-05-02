<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migration: Ajouter les champs d'expiration à la table product_stocks
     *
     * Contexte:
     * - Chaque stock à une localisation précise peut avoir une date d'expiration
     * - Un batch (lot) avec un numéro spécifique = une date d'expiration unique
     * - Permet de tracker les produits périméés par localisation
     */
    public function up(): void
    {
        Schema::table('product_stocks', function (Blueprint $table) {
            // Numéro de lot/batch unique pour ce stock
            $table->string('batch_number')->nullable()->after('quantity');

            // Date d'expiration du lot
            $table->date('expiration_date')->nullable()->after('batch_number');

            // Statut du batch: active, expired, disposed
            $table->string('batch_status')->default('active')
                ->comment('active|expired|disposed')
                ->after('expiration_date');

            // Date de la dernière vérification d'expiration
            $table->timestamp('last_expiration_check')->nullable()->after('batch_status');

            // Index pour recherches rapides sur expiration
            $table->index('expiration_date');
            $table->index(['product_id', 'expiration_date']);
            $table->index('batch_status');
        });
    }

    public function down(): void
    {
        Schema::table('product_stocks', function (Blueprint $table) {
            $table->dropIndex(['expiration_date']);
            $table->dropIndex(['product_id', 'expiration_date']);
            $table->dropIndex(['batch_status']);
            $table->dropColumn([
                'batch_number',
                'expiration_date',
                'batch_status',
                'last_expiration_check'
            ]);
        });
    }
};
