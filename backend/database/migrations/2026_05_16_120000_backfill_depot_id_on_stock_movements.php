<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('stock_movements')
            ->whereNull('depot_id')
            ->orderBy('id')
            ->chunkById(200, function ($movements) {
                foreach ($movements as $movement) {
                    $depotId = $this->resolveDepotId((int) $movement->id);
                    if ($depotId) {
                        DB::table('stock_movements')
                            ->where('id', $movement->id)
                            ->whereNull('depot_id')
                            ->update([
                                'depot_id' => $depotId,
                                'updated_at' => now(),
                            ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Intentionally no-op: this is a data-fix migration.
    }

    private function resolveDepotId(int $movementId): ?int
    {
        $movement = DB::table('stock_movements')->where('id', $movementId)->first();
        if (!$movement) {
            return null;
        }

        $candidates = [];

        foreach ([
            $movement->source_warehouse_location_id ?? null,
            $movement->destination_warehouse_location_id ?? null,
        ] as $locationId) {
            if ($locationId) {
                $warehouseId = DB::table('warehouse_locations')
                    ->join('warehouse_rooms', 'warehouse_rooms.id', '=', 'warehouse_locations.room_id')
                    ->where('warehouse_locations.id', $locationId)
                    ->value('warehouse_rooms.warehouse_id');
                if ($warehouseId) {
                    $candidates[] = (int) $warehouseId;
                }
            }
        }

        foreach ([
            $movement->source_cabinet_id ?? null,
            $movement->destination_cabinet_id ?? null,
        ] as $cabinetId) {
            if ($cabinetId) {
                $warehouseId = DB::table('warehouse_cabinets')
                    ->join('warehouse_rooms', 'warehouse_rooms.id', '=', 'warehouse_cabinets.room_id')
                    ->where('warehouse_cabinets.id', $cabinetId)
                    ->value('warehouse_rooms.warehouse_id');
                if ($warehouseId) {
                    $candidates[] = (int) $warehouseId;
                }
            }
        }

        $lineLocationWarehouseIds = DB::table('stock_movement_lines')
            ->join('warehouse_locations', 'warehouse_locations.id', '=', 'stock_movement_lines.warehouse_location_id')
            ->join('warehouse_rooms', 'warehouse_rooms.id', '=', 'warehouse_locations.room_id')
            ->where('stock_movement_lines.stock_movement_id', $movementId)
            ->whereNotNull('stock_movement_lines.warehouse_location_id')
            ->pluck('warehouse_rooms.warehouse_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $candidates = array_merge($candidates, $lineLocationWarehouseIds);

        $lineCabinetWarehouseIds = DB::table('stock_movement_lines')
            ->join('warehouse_cabinets', 'warehouse_cabinets.id', '=', 'stock_movement_lines.cabinet_id')
            ->join('warehouse_rooms', 'warehouse_rooms.id', '=', 'warehouse_cabinets.room_id')
            ->where('stock_movement_lines.stock_movement_id', $movementId)
            ->whereNotNull('stock_movement_lines.cabinet_id')
            ->pluck('warehouse_rooms.warehouse_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $candidates = array_merge($candidates, $lineCabinetWarehouseIds);

        $candidates = array_values(array_unique(array_filter($candidates)));
        if (count($candidates) === 1) {
            return $candidates[0];
        }

        // Fallback: creator's depot when available.
        if (!empty($movement->created_by)) {
            $creatorDepot = DB::table('users')
                ->where('id', $movement->created_by)
                ->value('depot_id');
            if ($creatorDepot) {
                return (int) $creatorDepot;
            }
        }

        // Fallback: related document warehouse when available.
        if (!empty($movement->document_id) && Schema::hasColumn('documents', 'warehouse_id')) {
            $documentWarehouse = DB::table('documents')
                ->where('id', $movement->document_id)
                ->value('warehouse_id');
            if ($documentWarehouse) {
                return (int) $documentWarehouse;
            }
        }

        return null;
    }
};
