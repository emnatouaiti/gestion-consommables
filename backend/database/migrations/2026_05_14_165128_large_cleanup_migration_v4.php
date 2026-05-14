<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Remove columns from products
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'purchase_price')) {
                $table->dropColumn('purchase_price');
            }
        });

        // 2. Remove columns from product_stocks
        Schema::table('product_stocks', function (Blueprint $table) {
            if (Schema::hasColumn('product_stocks', 'last_expiration_check')) {
                $table->dropColumn('last_expiration_check');
            }
            if (Schema::hasColumn('product_stocks', 'notes')) {
                $table->dropColumn('notes');
            }
        });

        // 3. Remove columns from stock_movements
        Schema::table('stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('stock_movements', 'cancel_reason')) {
                $table->dropColumn('cancel_reason');
            }
            if (Schema::hasColumn('stock_movements', 'destination_source_room_id')) {
                $table->dropColumn('destination_source_room_id');
            }
        });

        // 4. Remove columns from supplier_contacts (assuming table name is supplier_contacts)
        if (Schema::hasTable('supplier_contacts')) {
            Schema::table('supplier_contacts', function (Blueprint $table) {
                if (Schema::hasColumn('supplier_contacts', 'notes')) {
                    $table->dropColumn('notes');
                }
            });
        }

        // 5. Delete tables
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        Schema::dropIfExists('role_has_permissions');
        Schema::dropIfExists('sites_room');
        Schema::dropIfExists('sites_floor');
        Schema::dropIfExists('sites');
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }

    public function down(): void
    {
        // No rollback needed for cleanup
    }
};
