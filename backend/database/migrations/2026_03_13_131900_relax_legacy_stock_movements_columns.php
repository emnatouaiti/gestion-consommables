<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Some environments already had a "ledger-style" stock_movements table with NOT NULL fields.
        // Our current implementation uses header + lines; relax legacy NOT NULL constraints to avoid 500s.
        if (Schema::hasTable('stock_movements')) {
            if (Schema::hasColumn('stock_movements', 'quantity_delta')) {
                DB::statement('ALTER TABLE stock_movements MODIFY quantity_delta INT NULL');
            }
            if (Schema::hasColumn('stock_movements', 'stock_before')) {
                DB::statement('ALTER TABLE stock_movements MODIFY stock_before INT UNSIGNED NULL');
            }
            if (Schema::hasColumn('stock_movements', 'stock_after')) {
                DB::statement('ALTER TABLE stock_movements MODIFY stock_after INT UNSIGNED NULL');
            }
            if (Schema::hasColumn('stock_movements', 'reason')) {
                DB::statement('ALTER TABLE stock_movements MODIFY reason VARCHAR(255) NULL');
            }
            if (Schema::hasColumn('stock_movements', 'status')) {
                DB::statement("ALTER TABLE stock_movements MODIFY status VARCHAR(255) NOT NULL DEFAULT 'draft'");
            }
        }
    }

    public function down(): void
    {
        // Best-effort rollback. We avoid enforcing NOT NULL again to prevent data loss/errors.
    }
};
