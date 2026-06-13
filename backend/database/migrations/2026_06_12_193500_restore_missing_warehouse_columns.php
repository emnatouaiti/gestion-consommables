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
            if (!Schema::hasColumn('warehouses', 'status')) {
                $table->string('status')->default('active');
            }
            if (!Schema::hasColumn('warehouses', 'max_rooms')) {
                $table->integer('max_rooms')->nullable();
            }
            if (!Schema::hasColumn('warehouses', 'description')) {
                $table->text('description')->nullable();
            }
            if (!Schema::hasColumn('warehouses', 'capacity_units')) {
                $table->decimal('capacity_units', 12, 2)->nullable();
            }
            if (!Schema::hasColumn('warehouses', 'current_units')) {
                $table->unsignedInteger('current_units')->default(0);
            }
        });

        Schema::table('warehouse_rooms', function (Blueprint $table) {
            if (!Schema::hasColumn('warehouse_rooms', 'status')) {
                $table->string('status')->default('active');
            }
            if (!Schema::hasColumn('warehouse_rooms', 'max_locations')) {
                $table->integer('max_locations')->nullable();
            }
            if (!Schema::hasColumn('warehouse_rooms', 'max_cabinets')) {
                $table->integer('max_cabinets')->nullable();
            }
            if (!Schema::hasColumn('warehouse_rooms', 'description')) {
                $table->text('description')->nullable();
            }
            if (!Schema::hasColumn('warehouse_rooms', 'capacity_units')) {
                $table->decimal('capacity_units', 12, 2)->nullable();
            }
            if (!Schema::hasColumn('warehouse_rooms', 'current_units')) {
                $table->unsignedInteger('current_units')->default(0);
            }
        });

        Schema::table('warehouse_locations', function (Blueprint $table) {
            if (!Schema::hasColumn('warehouse_locations', 'status')) {
                $table->string('status')->default('active');
            }
            if (!Schema::hasColumn('warehouse_locations', 'description')) {
                $table->text('description')->nullable();
            }
        });

        Schema::table('warehouse_cabinets', function (Blueprint $table) {
            if (!Schema::hasColumn('warehouse_cabinets', 'status')) {
                $table->string('status')->default('active');
            }
            if (!Schema::hasColumn('warehouse_cabinets', 'description')) {
                $table->text('description')->nullable();
            }
            if (!Schema::hasColumn('warehouse_cabinets', 'capacity_units')) {
                $table->decimal('capacity_units', 12, 2)->nullable();
            }
            if (!Schema::hasColumn('warehouse_cabinets', 'current_units')) {
                $table->unsignedInteger('current_units')->default(0);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn(['status', 'max_rooms', 'description', 'capacity_units', 'current_units']);
        });

        Schema::table('warehouse_rooms', function (Blueprint $table) {
            $table->dropColumn(['status', 'max_locations', 'max_cabinets', 'description', 'capacity_units', 'current_units']);
        });

        Schema::table('warehouse_locations', function (Blueprint $table) {
            $table->dropColumn(['status', 'description']);
        });

        Schema::table('warehouse_cabinets', function (Blueprint $table) {
            $table->dropColumn(['status', 'description', 'capacity_units', 'current_units']);
        });
    }
};
