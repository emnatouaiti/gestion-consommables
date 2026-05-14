<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected static function booted()
    {
        static::creating(function ($product) {
            if (empty($product->reference)) {
                $count = static::count() + 1;
                $product->reference = 'PRD-' . date('Y') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
            }

            if (empty($product->num_inventaire)) {
                $invCount = static::count() + 1;
                $product->num_inventaire = 'INV-' . str_pad($invCount, 4, '0', STR_PAD_LEFT);
            }
        });

        static::saving(function ($product) {
            $category = $product->category;
            $categoryName = $category ? $category->title : '';
            
            $parts = array_filter([
                $product->title,
                $categoryName,
                $product->marque,
                $product->model
            ]);
            
            $product->description = implode(', ', $parts);
        });
    }

    protected $fillable = [
        'status',
        'title',
        'short_description',
        'description',
        'commentaire',
        'num_serie',
        'num_inventaire',
        'model',
        'marque',
        'seuil_min',
        'seuil_max',
        'reference',
        'categorie_id',
        'stock_quantity',
        'unit_id',
        'supplier_id',
        'photo',
        'has_expiration',
    ];

    protected $casts = [
        'has_expiration' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class , 'categorie_id');
    }

    public function suppliers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Supplier::class , 'product_supplier');
    }


    public function stocks(): HasMany
    {
        return $this->hasMany(ProductStock::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ProductPhoto::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * Get the total stock quantity across all locations.
     */
    public function getTotalStockAttribute()
    {
        return $this->stocks()->sum('quantity');
    }

    // Easy access to warehouse through warehouseLocation
}
