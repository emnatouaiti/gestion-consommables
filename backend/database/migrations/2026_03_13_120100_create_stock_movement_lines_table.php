<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('stock_movement_lines')) {
            Schema::create('stock_movement_lines', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('stock_movement_id');
                $table->unsignedBigInteger('product_id')->nullable();
                $table->integer('quantity');
                $table->timestamps();

                $table->foreign('stock_movement_id')->references('id')->on('stock_movements')->onDelete('cascade');
                $table->foreign('product_id')->references('id')->on('products')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movement_lines');
    }
};
