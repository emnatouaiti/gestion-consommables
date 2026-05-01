<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('modeles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('marque_id')->nullable()->constrained('marques')->nullOnDelete();
            $table->foreignId('fabricant_id')->nullable()->constrained('fabricants')->nullOnDelete();
            $table->unique(['name', 'marque_id', 'fabricant_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modeles');
    }
};
