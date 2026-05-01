<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('marques', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('fabricant_id')->nullable()->constrained('fabricants')->nullOnDelete();
            $table->unique(['name', 'fabricant_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marques');
    }
};
