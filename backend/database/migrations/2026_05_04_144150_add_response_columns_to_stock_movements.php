<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->string('response_pdf_path')->nullable()->after('status');
            $table->text('response_notes')->nullable()->after('response_pdf_path');
            $table->timestamp('rejected_at')->nullable()->after('executed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropColumn(['response_pdf_path', 'response_notes', 'rejected_at']);
        });
    }
};
