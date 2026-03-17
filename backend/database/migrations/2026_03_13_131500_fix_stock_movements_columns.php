<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('stock_movements', 'movement_type') && Schema::hasColumn('stock_movements', 'type')) {
                $table->renameColumn('type', 'movement_type');
            } elseif (!Schema::hasColumn('stock_movements', 'movement_type')) {
                $table->string('movement_type')->default('in');
            }

            if (!Schema::hasColumn('stock_movements', 'reference')) {
                $table->string('reference')->nullable()->after('movement_type');
            }

            if (!Schema::hasColumn('stock_movements', 'status')) {
                $table->string('status')->default('draft');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('stock_movements', 'reference')) {
                $table->dropColumn('reference');
            }
            if (Schema::hasColumn('stock_movements', 'movement_type') && !Schema::hasColumn('stock_movements', 'type')) {
                $table->renameColumn('movement_type', 'type');
            }
        });
    }
};

