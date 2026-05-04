<?php

namespace App\Observers;

use App\Models\ProductStock;
use App\Models\WarehouseLocation;
use App\Models\WarehouseCabinet;
use App\Models\WarehouseRoom;
use App\Models\Warehouse;

class ProductStockObserver
{
    protected $capacityService;

    public function __construct()
    {
        $this->capacityService = new \App\Services\CapacityService();
    }

    /**
     * Handle the ProductStock "created" event.
     */
    public function created(ProductStock $productStock): void
    {
        $this->updateStorageUsage($productStock);
    }

    /**
     * Handle the ProductStock "updated" event.
     */
    public function updated(ProductStock $productStock): void
    {
        $this->updateStorageUsage($productStock);
        
        // If the stock moved from one location to another, we need to update the original location too
        if ($productStock->isDirty('warehouse_location_id')) {
            $originalLocId = $productStock->getOriginal('warehouse_location_id');
            if ($originalLocId) {
                $this->updateLocationUsage($originalLocId);
            }
        }
        
        if ($productStock->isDirty('cabinet_id')) {
            $originalCabId = $productStock->getOriginal('cabinet_id');
            if ($originalCabId) {
                $this->updateCabinetUsage($originalCabId);
            }
        }
    }

    /**
     * Handle the ProductStock "deleted" event.
     */
    public function deleted(ProductStock $productStock): void
    {
        $this->updateStorageUsage($productStock);
    }

    /**
     * Update the usage for the current storage containers of the given stock
     */
    private function updateStorageUsage(ProductStock $stock): void
    {
        if ($stock->warehouse_location_id) {
            $this->updateLocationUsage($stock->warehouse_location_id);
        }
        
        if ($stock->cabinet_id) {
            $this->updateCabinetUsage($stock->cabinet_id);
        }
    }

    private function updateLocationUsage($locationId): void
    {
        $location = WarehouseLocation::find($locationId);
        if ($location) {
            $sum = ProductStock::where('warehouse_location_id', $locationId)->sum('quantity');
            $location->current_units = $sum;
            $location->save(); 
            $this->capacityService->checkAndNotify($location);
            $this->updateRoomUsage($location->room_id);
        }
    }

    private function updateCabinetUsage($cabinetId): void
    {
        $cabinet = WarehouseCabinet::find($cabinetId);
        if ($cabinet) {
            $sum = ProductStock::where('cabinet_id', $cabinetId)->sum('quantity');
            $cabinet->current_units = $sum;
            $cabinet->save();
            $this->capacityService->checkAndNotify($cabinet);
            $this->updateRoomUsage($cabinet->room_id);
        }
    }

    private function updateRoomUsage($roomId): void
    {
        if (!$roomId) return;
        $room = WarehouseRoom::find($roomId);
        if ($room) {
            $locSum = WarehouseLocation::where('room_id', $roomId)->sum('current_units');
            $cabSum = WarehouseCabinet::where('room_id', $roomId)->sum('current_units');
            $room->current_units = $locSum + $cabSum;
            $room->save();
            $this->capacityService->checkAndNotify($room);
            $this->updateWarehouseUsage($room->warehouse_id);
        }
    }

    private function updateWarehouseUsage($warehouseId): void
    {
        if (!$warehouseId) return;
        $warehouse = Warehouse::find($warehouseId);
        if ($warehouse) {
            $sum = WarehouseRoom::where('warehouse_id', $warehouseId)->sum('current_units');
            $warehouse->current_units = $sum;
            $warehouse->save();
            $this->capacityService->checkAndNotify($warehouse);
        }
    }
}
