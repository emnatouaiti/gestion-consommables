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
        'description',
        'address',
        'city',
        'governorate',
        'latitude',
        'longitude',
        'phone',
        'status',
    ];

    public function rooms(): HasMany
    {
        return $this->hasMany(WarehouseRoom::class);
    }
}
