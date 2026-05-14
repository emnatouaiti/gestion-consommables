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

        // 1. Drop audit_logs table
        Schema::dropIfExists('audit_logs');

        // 2. Drop Spatie Permission tables
        Schema::dropIfExists('model_has_permissions');
        Schema::dropIfExists('model_has_roles');
        Schema::dropIfExists('role_has_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');

        // 3. Remove fabricant_id from marques and modeles using raw SQL for robustness
        if (Schema::hasColumn('marques', 'fabricant_id')) {
            try {
                DB::statement('ALTER TABLE marques DROP COLUMN fabricant_id');
            } catch (\Exception $e) {}
        }

        if (Schema::hasColumn('modeles', 'fabricant_id')) {
            try {
                DB::statement('ALTER TABLE modeles DROP COLUMN fabricant_id');
            } catch (\Exception $e) {}
        }

        // 4. Drop fabricants table
        Schema::dropIfExists('fabricants');

        // 5. Remove notes from expiration_events
        Schema::table('expiration_events', function (Blueprint $table) {
            if (Schema::hasColumn('expiration_events', 'notes')) {
                $table->dropColumn('notes');
            }
        });

        // Re-enable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse
    }
};
