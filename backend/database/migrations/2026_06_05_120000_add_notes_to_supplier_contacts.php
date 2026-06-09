<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('supplier_contacts') && !Schema::hasColumn('supplier_contacts', 'notes')) {
            Schema::table('supplier_contacts', function (Blueprint $table) {
                $table->text('notes')->nullable()->after('email');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('supplier_contacts') && Schema::hasColumn('supplier_contacts', 'notes')) {
            Schema::table('supplier_contacts', function (Blueprint $table) {
                $table->dropColumn('notes');
            });
        }
    }
};
