<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Unit extends Model
{
    use HasFactory;

    protected static function booted()
    {
        static::creating(function ($unit) {
            if (empty($unit->code)) {
                $count = static::count() + 1;
                $unit->code = 'UNT-' . date('Y') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    protected $fillable = [
        'name',
        'code',
        'description',
    ];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
