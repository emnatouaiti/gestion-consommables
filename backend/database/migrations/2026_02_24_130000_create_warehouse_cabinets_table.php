<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouse_cabinets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained('warehouse_rooms')->cascadeOnDelete();
            $table->string('code')->nullable();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->index(['room_id', 'name']);
            $table->unique(['room_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_cabinets');
    }
};

