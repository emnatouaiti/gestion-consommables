<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Disable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        // 1. Drop obsolete tables
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('audit_log');
        Schema::dropIfExists('fabricants');
        Schema::dropIfExists('fabricant');
        Schema::dropIfExists('model_has_permissions');
        Schema::dropIfExists('model_has_roles');
        Schema::dropIfExists('role_has_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');

        // 2. Remove obsolete columns using raw SQL and catching errors
        $this->dropColumnIfExists('expiration_events', 'notes');
        $this->dropColumnIfExists('expiration_events', 'note');
        $this->dropColumnIfExists('marques', 'fabricant_id');
        $this->dropColumnIfExists('modeles', 'fabricant_id');

        // 3. Add uniqueness to products (title, marque, model)
        // Clean duplicates first
        $duplicates = DB::table('products')
            ->select('title', 'marque', 'model', DB::raw('COUNT(*) as count'))
            ->groupBy('title', 'marque', 'model')
            ->having('count', '>', 1)
            ->get();

        foreach ($duplicates as $duplicate) {
            $query = DB::table('products')->where('title', $duplicate->title);
            
            if (is_null($duplicate->marque)) $query->whereNull('marque');
            else $query->where('marque', $duplicate->marque);
            
            if (is_null($duplicate->model)) $query->whereNull('model');
            else $query->where('model', $duplicate->model);

            $ids = $query->orderBy('id', 'desc')->pluck('id');
            
            if ($ids->count() > 1) {
                $idsToDelete = $ids->slice(1);
                DB::table('products')->whereIn('id', $idsToDelete)->delete();
            }
        }

        // Add unique index safely
        try {
            Schema::table('products', function (Blueprint $table) {
                $table->unique(['title', 'marque', 'model'], 'products_unique_identity');
            });
        } catch (\Exception $e) {
            // Probably already exists
        }

        // Re-enable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }

    private function dropColumnIfExists($table, $column)
    {
        if (Schema::hasTable($table) && Schema::hasColumn($table, $column)) {
            try {
                DB::statement("ALTER TABLE `{$table}` DROP COLUMN `{$column}`");
            } catch (\Exception $e) {}
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        try {
            Schema::table('products', function (Blueprint $table) {
                $table->dropUnique('products_unique_identity');
            });
        } catch (\Exception $e) {}
    }
};
