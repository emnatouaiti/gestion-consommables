<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_id',
        'code',
        'name',
        'description',
        'type',
        'capacity_units',
        'current_units',
        'status',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(WarehouseRoom::class, 'room_id');
    }

    public function products()
    {
        return $this->hasMany(Product::class, 'warehouse_location_id');
    }
}
