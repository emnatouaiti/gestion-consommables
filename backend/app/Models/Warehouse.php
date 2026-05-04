<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Warehouse extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'kind',
        'description',
        'address',
        'city',
        'governorate',
        'latitude',
        'longitude',
        'phone',
        'status',
        'max_rooms',
        'capacity_units',
        'current_units',
    ];

    public function rooms(): HasMany
    {
        return $this->hasMany(WarehouseRoom::class);
    }
}
