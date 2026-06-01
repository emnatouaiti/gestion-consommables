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
        if (DB::getDriverName() === 'sqlite') { return; }
        DB::statement("ALTER TABLE documents MODIFY COLUMN status ENUM('pending', 'applied', 'rejected', 'pending_validation') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') { return; }
        DB::statement("ALTER TABLE documents MODIFY COLUMN status ENUM('pending', 'applied', 'pending_validation') DEFAULT 'pending'");
    }
};
