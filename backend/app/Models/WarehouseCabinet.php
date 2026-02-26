<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseCabinet extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_id',
        'code',
        'name',
        'description',
        'status',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(WarehouseRoom::class, 'room_id');
    }
}
