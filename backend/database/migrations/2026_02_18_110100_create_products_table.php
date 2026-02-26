<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('status')->default('active');
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('seuil_min')->default(0);
            $table->string('reference')->unique();
            $table->foreignId('categorie_id')->constrained('categories')->cascadeOnDelete();
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->decimal('purchase_price', 12, 2)->nullable();
            $table->decimal('sale_price', 12, 2)->nullable();
            $table->string('unit')->nullable();
            $table->string('location')->nullable();
            $table->string('barcode_value')->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
