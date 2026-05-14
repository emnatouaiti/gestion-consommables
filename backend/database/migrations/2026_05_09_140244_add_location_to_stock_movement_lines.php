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
        Schema::table('stock_movement_lines', function (Blueprint $table) {
            $table->unsignedBigInteger('warehouse_location_id')->nullable();
            $table->unsignedBigInteger('cabinet_id')->nullable();

            $table->foreign('warehouse_location_id')->references('id')->on('warehouse_locations')->nullOnDelete();
            $table->foreign('cabinet_id')->references('id')->on('warehouse_cabinets')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_movement_lines', function (Blueprint $table) {
            $table->dropForeign(['warehouse_location_id']);
            $table->dropForeign(['cabinet_id']);
            $table->dropColumn(['warehouse_location_id', 'cabinet_id']);
        });
    }
};
