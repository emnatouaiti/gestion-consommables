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
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreignId('source_cabinet_id')->nullable()->after('source_warehouse_location_id')->constrained('warehouse_cabinets')->nullOnDelete();
            $table->foreignId('destination_cabinet_id')->nullable()->after('destination_warehouse_location_id')->constrained('warehouse_cabinets')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['source_cabinet_id']);
            $table->dropColumn('source_cabinet_id');
            $table->dropForeign(['destination_cabinet_id']);
            $table->dropColumn('destination_cabinet_id');
        });
    }
};
