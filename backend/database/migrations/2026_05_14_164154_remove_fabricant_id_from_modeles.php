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
        try {
            DB::statement('ALTER TABLE modeles DROP INDEX modeles_name_marque_id_fabricant_id_unique');
        } catch (\Exception $e) {}
        
        try {
            DB::statement('ALTER TABLE modeles DROP INDEX modeles_fabricant_id_foreign');
        } catch (\Exception $e) {}
        
        try {
            DB::statement('ALTER TABLE modeles DROP COLUMN fabricant_id');
        } catch (\Exception $e) {}
    }

    public function down(): void
    {
        Schema::table('modeles', function (Blueprint $table) {
            $table->unsignedBigInteger('fabricant_id')->nullable();
        });
    }
};
