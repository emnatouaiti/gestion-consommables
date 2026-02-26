<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('short_description', 500)->nullable()->after('title');
            $table->text('commentaire')->nullable()->after('description');
            $table->string('fabricant')->nullable()->after('commentaire');
            $table->string('num_serie')->nullable()->after('fabricant');
            $table->string('num_inventaire')->nullable()->after('num_serie');
            $table->string('model')->nullable()->after('num_inventaire');
            $table->string('marque')->nullable()->after('model');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'short_description',
                'commentaire',
                'fabricant',
                'num_serie',
                'num_inventaire',
                'model',
                'marque',
            ]);
        });
    }
};

