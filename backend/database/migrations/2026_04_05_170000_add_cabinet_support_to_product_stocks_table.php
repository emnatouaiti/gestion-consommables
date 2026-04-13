<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_stocks', function (Blueprint $table) {
            if (!Schema::hasColumn('product_stocks', 'cabinet_id')) {
                $table->foreignId('cabinet_id')->nullable()->after('warehouse_location_id')->constrained('warehouse_cabinets')->nullOnDelete();
            }
        });

        Schema::table('product_stocks', function (Blueprint $table) {
            $table->foreignId('warehouse_location_id')->nullable()->change();
        });

        Schema::table('product_stocks', function (Blueprint $table) {
            $table->unique(['product_id', 'cabinet_id']);
        });
    }

    public function down(): void
    {
        Schema::table('product_stocks', function (Blueprint $table) {
            $table->dropUnique(['product_id', 'cabinet_id']);
            if (Schema::hasColumn('product_stocks', 'cabinet_id')) {
                $table->dropConstrainedForeignId('cabinet_id');
            }
        });

        Schema::table('product_stocks', function (Blueprint $table) {
            $table->foreignId('warehouse_location_id')->nullable(false)->change();
        });
    }
};
