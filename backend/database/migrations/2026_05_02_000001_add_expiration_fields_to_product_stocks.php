<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migration: Ajouter les champs d'expiration a la table product_stocks
     *
     * Contexte:
     * - Chaque stock a une localisation precise peut avoir une date d'expiration
     * - Un batch (lot) avec un numero specifique = une date d'expiration unique
     * - Permet de tracker les produits perimees par localisation
     */
    public function up(): void
    {
        Schema::table('product_stocks', function (Blueprint $table) {
            // Numero de lot/batch unique pour ce stock
            $table->string('batch_number')->nullable()->after('quantity');

            // Date d'expiration du lot
            $table->date('expiration_date')->nullable()->after('batch_number');

            // Statut du batch: active, expired, disposed
            $table->string('batch_status')->default('active')
                ->comment('active|expired|disposed')
                ->after('expiration_date');

            // Date de la derniere verification d'expiration
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
