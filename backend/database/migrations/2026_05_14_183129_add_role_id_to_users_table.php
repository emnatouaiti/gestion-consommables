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
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id')->nullable()->after('avatar');
        });

        // Migrate data
        $users = \Illuminate\Support\Facades\DB::table('users')->get();
        foreach ($users as $user) {
            if ($user->role) {
                $role = \Illuminate\Support\Facades\DB::table('roles')->whereRaw('LOWER(name) = ?', [strtolower(trim($user->role))])->first();
                if ($role) {
                    \Illuminate\Support\Facades\DB::table('users')
                        ->where('id', $user->id)
                        ->update(['role_id' => $role->id]);
                }
            }
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('set null');
            $table->dropColumn('role');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->nullable()->after('avatar');
        });

        $users = \Illuminate\Support\Facades\DB::table('users')->get();
        foreach ($users as $user) {
            if ($user->role_id) {
                $role = \Illuminate\Support\Facades\DB::table('roles')->where('id', $user->role_id)->first();
                if ($role) {
                    \Illuminate\Support\Facades\DB::table('users')
                        ->where('id', $user->id)
                        ->update(['role' => $role->name]);
                }
            }
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');
        });
    }
};
