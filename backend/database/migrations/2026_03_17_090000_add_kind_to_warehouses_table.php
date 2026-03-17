<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('warehouses', 'kind')) {
            Schema::table('warehouses', function (Blueprint $table) {
                // depot: stockage (magasin/depot)
                // local: site (siege/agence) avec etages/salles
                $table->string('kind')->default('depot')->after('name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('warehouses', 'kind')) {
            Schema::table('warehouses', function (Blueprint $table) {
                $table->dropColumn('kind');
            });
        }
    }
};
