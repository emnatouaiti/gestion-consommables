<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->unsignedBigInteger('warehouse_id')->nullable();
            $table->string('title')->nullable();
            $table->string('type')->nullable(); // bon_livraison, bon_sortie, autre
            $table->enum('direction', ['in', 'out', 'unknown'])->default('unknown');
            $table->enum('status', ['pending', 'applied', 'error'])->default('pending');
            $table->string('path');
            $table->longText('ocr_text')->nullable();
            $table->json('ocr_lines')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
