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
        Schema::table('warehouses', function (Blueprint $table) {
            $table->decimal('capacity_units', 12, 2)->nullable()->after('status');
            $table->unsignedInteger('current_units')->default(0)->after('capacity_units');
        });

        Schema::table('warehouse_rooms', function (Blueprint $table) {
            $table->decimal('capacity_units', 12, 2)->nullable()->after('capacity_volume');
            $table->unsignedInteger('current_units')->default(0)->after('capacity_units');
        });

        Schema::table('warehouse_cabinets', function (Blueprint $table) {
            $table->decimal('capacity_units', 12, 2)->nullable()->after('status');
            $table->unsignedInteger('current_units')->default(0)->after('capacity_units');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn(['capacity_units', 'current_units']);
        });

        Schema::table('warehouse_rooms', function (Blueprint $table) {
            $table->dropColumn(['capacity_units', 'current_units']);
        });

        Schema::table('warehouse_cabinets', function (Blueprint $table) {
            $table->dropColumn(['capacity_units', 'current_units']);
        });
    }
};
