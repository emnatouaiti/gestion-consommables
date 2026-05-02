<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('consumable_requests', 'product_id')) {
            Schema::table('consumable_requests', function (Blueprint $table) {
                $table->unsignedBigInteger('product_id')->nullable()->after('user_id');
                $table->foreign('product_id')->references('id')->on('products')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        Schema::table('consumable_requests', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
        });
    }
};
