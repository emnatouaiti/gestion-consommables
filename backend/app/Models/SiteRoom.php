<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteRoom extends Model
{
    use HasFactory;

    protected $fillable = [
        'floor_id',
        'name',
        'code',
        'status',
    ];

    public function floor(): BelongsTo
    {
        return $this->belongsTo(SiteFloor::class, 'floor_id');
    }
}

