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
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['warehouse_location_id']);
            $table->dropColumn([
                'sale_price',
                'location',
                'warehouse_location_id',
                'barcode_value',
                'unit',
                'fabricant'
            ]);
        });

        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn([
                'status',
                'city',
                'governorate',
                'kind',
                'capacity_units',
                'current_units',
                'description'
            ]);
        });

        Schema::table('warehouse_rooms', function (Blueprint $table) {
            $table->dropColumn([
                'status',
                'type',
                'description',
                'capacity_volume',
                'capacity_units',
                'current_units'
            ]);
        });

        Schema::table('warehouse_locations', function (Blueprint $table) {
            $table->dropColumn([
                'status',
                'type',
                'description'
            ]);
        });

        Schema::table('warehouse_cabinets', function (Blueprint $table) {
            $table->dropColumn([
                'status',
                'description'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('sale_price', 12, 2)->nullable();
            $table->string('location')->nullable();
            $table->unsignedBigInteger('warehouse_location_id')->nullable();
            $table->string('barcode_value')->nullable();
            $table->string('unit')->nullable();
            $table->string('fabricant')->nullable();
        });

        Schema::table('warehouses', function (Blueprint $table) {
            $table->string('status')->default('active');
            $table->string('city')->nullable();
            $table->string('governorate')->nullable();
            $table->string('kind')->default('depot');
            $table->decimal('capacity_units', 12, 2)->nullable();
            $table->unsignedInteger('current_units')->default(0);
            $table->text('description')->nullable();
        });

        Schema::table('warehouse_rooms', function (Blueprint $table) {
            $table->string('status')->default('active');
            $table->string('type')->nullable();
            $table->text('description')->nullable();
            $table->decimal('capacity_volume', 12, 2)->nullable();
            $table->decimal('capacity_units', 12, 2)->nullable();
            $table->unsignedInteger('current_units')->default(0);
        });

        Schema::table('warehouse_locations', function (Blueprint $table) {
            $table->string('status')->default('active');
            $table->string('type')->nullable();
            $table->text('description')->nullable();
        });

        Schema::table('warehouse_cabinets', function (Blueprint $table) {
            $table->string('status')->default('active');
            $table->text('description')->nullable();
        });
    }
};
