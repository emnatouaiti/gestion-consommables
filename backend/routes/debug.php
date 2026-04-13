<?php

namespace App\Http\Controllers\API;

use App\Models\ProductStock;

Route::get('/debug/stocks', function() {
    $stocks = ProductStock::with('warehouseLocation', 'warehouseCabinet')->limit(5)->get();

    $result = [];
    foreach ($stocks as $stock) {
        $result[] = [
            'id' => $stock->id,
            'warehouse_location_id' => $stock->warehouse_location_id,
            'cabinet_id' => $stock->cabinet_id,
            'warehouseLocation' => $stock->warehouseLocation ? [
                'id' => $stock->warehouseLocation->id,
                'code' => $stock->warehouseLocation->code,
                'name' => $stock->warehouseLocation->name,
            ] : null,
            'warehouseCabinet' => $stock->warehouseCabinet ? [
                'id' => $stock->warehouseCabinet->id,
                'code' => $stock->warehouseCabinet->code,
                'name' => $stock->warehouseCabinet->name,
            ] : null,
        ];
    }

    return response()->json($result);
});
