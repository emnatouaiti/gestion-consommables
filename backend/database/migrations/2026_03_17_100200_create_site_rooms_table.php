<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('floor_id')->constrained('site_floors')->cascadeOnDelete();
            $table->string('name');
            $table->string('code')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->index(['floor_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_rooms');
    }
};

