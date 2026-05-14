<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovementLine extends Model
{
    protected $fillable = [
        'stock_movement_id',
        'product_id',
        'quantity',
        'warehouse_location_id',
        'cabinet_id',
    ];

    public function movement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'stock_movement_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(WarehouseLocation::class, 'warehouse_location_id');
    }

    public function cabinet(): BelongsTo
    {
        return $this->belongsTo(WarehouseCabinet::class, 'cabinet_id');
    }
}
