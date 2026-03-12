<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consumable_requests', function (Blueprint $table) {
            $table->string('batch_code', 80)->nullable()->index()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('consumable_requests', function (Blueprint $table) {
            $table->dropColumn('batch_code');
        });
    }
};
