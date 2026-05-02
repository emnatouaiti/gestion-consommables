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
        Schema::table('product_stocks', function (Blueprint $table) {
            // Drop the old restrictive unique index
            // Laravel generated name for unique(['product_id', 'warehouse_location_id']) is usually this:
            $table->dropUnique(['product_id', 'warehouse_location_id']);

            // Add a new unique index that allows multiple batches in the same location
            $table->unique(['product_id', 'warehouse_location_id', 'cabinet_id', 'batch_number', 'expiration_date'], 'product_stock_batch_unique');
        });
    }

    public function down(): void
    {
        Schema::table('product_stocks', function (Blueprint $table) {
            $table->dropUnique('product_stock_batch_unique');
            $table->unique(['product_id', 'warehouse_location_id']);
        });
    }
};
