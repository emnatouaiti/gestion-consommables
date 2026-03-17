<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('stock_movements', 'source_warehouse_location_id')) {
                $table->unsignedBigInteger('source_warehouse_location_id')->nullable()->index();
            }
            if (!Schema::hasColumn('stock_movements', 'destination_warehouse_location_id')) {
                $table->unsignedBigInteger('destination_warehouse_location_id')->nullable()->index();
            }
            if (!Schema::hasColumn('stock_movements', 'supplier_id')) {
                $table->unsignedBigInteger('supplier_id')->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('stock_movements', 'source_warehouse_location_id')) {
                $table->dropColumn('source_warehouse_location_id');
            }
            if (Schema::hasColumn('stock_movements', 'destination_warehouse_location_id')) {
                $table->dropColumn('destination_warehouse_location_id');
            }
            if (Schema::hasColumn('stock_movements', 'supplier_id')) {
                $table->dropColumn('supplier_id');
            }
        });
    }
};

