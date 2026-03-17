<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('stock_movements', 'planned_at')) {
                $table->timestamp('planned_at')->nullable();
            }
            if (!Schema::hasColumn('stock_movements', 'executed_at')) {
                $table->timestamp('executed_at')->nullable();
            }
            if (!Schema::hasColumn('stock_movements', 'validated_by')) {
                $table->unsignedBigInteger('validated_by')->nullable()->index();
            }
            if (!Schema::hasColumn('stock_movements', 'cancel_reason')) {
                $table->string('cancel_reason')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('stock_movements', 'planned_at')) {
                $table->dropColumn('planned_at');
            }
            if (Schema::hasColumn('stock_movements', 'executed_at')) {
                $table->dropColumn('executed_at');
            }
            if (Schema::hasColumn('stock_movements', 'validated_by')) {
                $table->dropColumn('validated_by');
            }
            if (Schema::hasColumn('stock_movements', 'cancel_reason')) {
                $table->dropColumn('cancel_reason');
            }
        });
    }
};

