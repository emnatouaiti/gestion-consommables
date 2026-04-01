<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_movements')) {
            Schema::table('stock_movements', function (Blueprint $table) {
                if (!Schema::hasColumn('stock_movements', 'document_id')) {
                    $table->unsignedBigInteger('document_id')->nullable()->after('supplier_id');
                    $table->foreign('document_id')->references('id')->on('documents')->nullOnDelete();
                }
                if (!Schema::hasColumn('stock_movements', 'in_image_path')) {
                    $table->string('in_image_path')->nullable()->after('document_id');
                }
                if (!Schema::hasColumn('stock_movements', 'out_image_path')) {
                    $table->string('out_image_path')->nullable()->after('in_image_path');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('stock_movements')) {
            Schema::table('stock_movements', function (Blueprint $table) {
                if (Schema::hasColumn('stock_movements', 'out_image_path')) {
                    $table->dropColumn('out_image_path');
                }
                if (Schema::hasColumn('stock_movements', 'in_image_path')) {
                    $table->dropColumn('in_image_path');
                }
                if (Schema::hasColumn('stock_movements', 'document_id')) {
                    $table->dropForeign(['document_id']);
                    $table->dropColumn('document_id');
                }
            });
        }
    }
};
