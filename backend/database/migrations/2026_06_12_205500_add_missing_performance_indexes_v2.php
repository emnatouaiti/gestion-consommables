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
        $this->addIndex('products', ['reference']);
        $this->addIndex('products', ['status', 'stock_quantity']);

        $this->addIndex('product_stocks', ['product_id', 'quantity']);
        $this->addIndex('product_stocks', ['warehouse_location_id']);
        $this->addIndex('product_stocks', ['cabinet_id']);
        $this->addIndex('product_stocks', ['batch_status']);

        $this->addIndex('stock_movements', ['depot_id']);
        $this->addIndex('stock_movements', ['movement_type']);
        $this->addIndex('stock_movements', ['created_by']);
        $this->addIndex('stock_movements', ['created_at']);

        $this->addIndex('stock_movement_lines', ['stock_movement_id']);
        $this->addIndex('stock_movement_lines', ['product_id']);

        $this->addIndex('users', ['role_id']);
        $this->addIndex('users', ['service', 'siege']);
    }

    private function addIndex(string $table, array $columns)
    {
        $indexName = strtolower($table . '_' . implode('_', $columns) . '_index');
        
        try {
            Schema::table($table, function (Blueprint $tableObj) use ($columns, $indexName) {
                // Determine if index exists by listing them
                $conn = Schema::getConnection();
                $dbName = $conn->getDatabaseName();
                $existing = DB::select("SHOW INDEX FROM {$tableObj->getTable()} WHERE Key_name = ?", [$indexName]);
                
                if (empty($existing)) {
                    $tableObj->index($columns, $indexName);
                }
            });
        } catch (\Exception $e) {
            // Log or ignore if it fails due to existing index with different name
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Typically we don't need to drop manually if we want robustness, 
        // but for standard migration rollback:
        $this->dropIndex('products', ['reference']);
        $this->dropIndex('products', ['status', 'stock_quantity']);
        $this->dropIndex('product_stocks', ['product_id', 'quantity']);
        $this->dropIndex('product_stocks', ['warehouse_location_id']);
        $this->dropIndex('product_stocks', ['cabinet_id']);
        $this->dropIndex('product_stocks', ['batch_status']);
        $this->dropIndex('stock_movements', ['depot_id']);
        $this->dropIndex('stock_movements', ['movement_type']);
        $this->dropIndex('stock_movements', ['created_by']);
        $this->dropIndex('stock_movements', ['created_at']);
        $this->dropIndex('stock_movement_lines', ['stock_movement_id']);
        $this->dropIndex('stock_movement_lines', ['product_id']);
        $this->dropIndex('users', ['role_id']);
        $this->dropIndex('users', ['service', 'siege']);
    }

    private function dropIndex(string $table, array $columns)
    {
        $indexName = strtolower($table . '_' . implode('_', $columns) . '_index');
        try {
            Schema::table($table, function (Blueprint $tableObj) use ($indexName) {
                $existing = DB::select("SHOW INDEX FROM {$tableObj->getTable()} WHERE Key_name = ?", [$indexName]);
                if (!empty($existing)) {
                    $tableObj->dropIndex($indexName);
                }
            });
        } catch (\Exception $e) {}
    }
};
