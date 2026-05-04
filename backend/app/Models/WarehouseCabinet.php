<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseCabinet extends Model
{
    use HasFactory;

    protected static function booted()
    {
        static::creating(function ($cabinet) {
            if (empty($cabinet->code)) {
                $count = static::count() + 1;
                $cabinet->code = 'CAB-' . date('Y') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    protected $fillable = [
        'room_id',
        'code',
        'name',
        'description',
        'status',
        'capacity_units',
        'current_units',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(WarehouseRoom::class, 'room_id');
    }
}
