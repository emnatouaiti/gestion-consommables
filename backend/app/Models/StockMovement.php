<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Document;

class StockMovement extends Model
{
    protected $fillable = [
        'movement_type',
        'reference',
        'created_by',
        'related_request_id',
        'notes',
        'status',
        'planned_at',
        'executed_at',
        'validated_by',
        'cancel_reason',
        'source_warehouse_location_id',
        'destination_warehouse_location_id',
        'supplier_id',
        'document_id',
        'in_image_path',
        'out_image_path',
    ];

    protected $casts = [
        'planned_at' => 'datetime',
        'executed_at' => 'datetime',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(StockMovementLine::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function sourceWarehouseLocation(): BelongsTo
    {
        return $this->belongsTo(WarehouseLocation::class, 'source_warehouse_location_id');
    }

    public function destinationWarehouseLocation(): BelongsTo
    {
        return $this->belongsTo(WarehouseLocation::class, 'destination_warehouse_location_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }
}
