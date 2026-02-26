<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WarehouseRoom extends Model
{
    use HasFactory;

    protected $fillable = [
        'warehouse_id',
        'name',
        'description',
        'type',
        'capacity_volume',
        'status',
    ];

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(WarehouseLocation::class, 'room_id');
    }

    public function cabinets(): HasMany
    {
        return $this->hasMany(WarehouseCabinet::class, 'room_id');
    }
}
