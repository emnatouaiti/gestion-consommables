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
        // Index notifications to speed up unread count polling
        Schema::table('notifications', function (Blueprint $table) {
            $table->index('read_at');
        });

        // Index consumable requests for frequent status and depot filtering
        Schema::table('consumable_requests', function (Blueprint $table) {
            $table->index('status');
            $table->index('depot_id');
        });

        // Index stock movements for status filtering
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['read_at']);
        });

        Schema::table('consumable_requests', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['depot_id']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });
    }
};
