<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseLocation extends Model
{
    use HasFactory;

    protected static function booted()
    {
        static::creating(function ($location) {
            if (empty($location->code)) {
                $count = static::count() + 1;
                $location->code = 'LOC-' . date('Y') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
            }
        });
    }

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
