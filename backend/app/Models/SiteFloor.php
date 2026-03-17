<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SiteFloor extends Model
{
    use HasFactory;

    protected $fillable = [
        'site_id',
        'name',
        'level',
        'status',
    ];

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(SiteRoom::class, 'floor_id');
    }
}

