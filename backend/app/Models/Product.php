<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'status',
        'title',
        'short_description',
        'description',
        'commentaire',
        'fabricant',
        'num_serie',
        'num_inventaire',
        'model',
        'marque',
        'seuil_min',
        'seuil_max',
        'reference',
        'categorie_id',
        'stock_quantity',
        'purchase_price',
        'sale_price',
        'unit_id',
        'unit',
        'location',
        'photo',
        'barcode_value',
        'warehouse_location_id',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class , 'categorie_id');
    }

    public function suppliers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Supplier::class , 'product_supplier');
    }

    public function warehouseLocation(): BelongsTo
    {
        return $this->belongsTo(WarehouseLocation::class , 'warehouse_location_id');
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
    public function warehouse()
    {
        return $this->hasManyThrough(
            Warehouse::class ,
            WarehouseLocation::class ,
            'id',
            'id',
            'warehouse_location_id',
            'warehouse_room_id'
        )->join('warehouse_rooms', 'warehouses.id', '=', 'warehouse_rooms.warehouse_id')
            ->select('warehouses.*');
    }
}
