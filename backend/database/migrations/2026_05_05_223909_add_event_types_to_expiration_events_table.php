<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ajoute les valeurs manquantes à l'enum event_type :
     * - 'eliminated_batch'     : lot éliminé/détruit
     * - 'returned_to_supplier' : lot retourné au fournisseur
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') { return; }
        // MySQL : modifier un ENUM en ajoutant les nouvelles valeurs
        DB::statement("
            ALTER TABLE expiration_events
            MODIFY COLUMN event_type ENUM(
                'alert_7days',
                'alert_expired',
                'blocked_from_consumption',
                'marked_as_expired',
                'consumed_expired',
                'disposed',
                'eliminated_batch',
                'returned_to_supplier'
            ) NOT NULL
        ");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') { return; }
        // Revenir à l'enum d'origine (sans les nouvelles valeurs)
        DB::statement("
            ALTER TABLE expiration_events
            MODIFY COLUMN event_type ENUM(
                'alert_7days',
                'alert_expired',
                'blocked_from_consumption',
                'marked_as_expired',
                'consumed_expired',
                'disposed'
            ) NOT NULL
        ");
    }
};
