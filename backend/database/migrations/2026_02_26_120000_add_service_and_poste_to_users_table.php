<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'service')) {
                $table->string('service')->nullable()->after('telephone');
            }

            if (!Schema::hasColumn('users', 'poste')) {
                $table->string('poste')->nullable()->after('service');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'poste')) {
                $table->dropColumn('poste');
            }

            if (Schema::hasColumn('users', 'service')) {
                $table->dropColumn('service');
            }
        });
    }
};
