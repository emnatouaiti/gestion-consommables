<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('stock_movements', 'status')) {
            Schema::table('stock_movements', function (Blueprint $table) {
                // Don't rely on ->after('type') because older tables may not have that column
                $table->string('status')->default('executed'); // 'proposed','executed','cancelled'
            });
        }
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
