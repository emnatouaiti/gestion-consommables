<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class ExpirationEvent extends Model
{
    protected $fillable = [
        'product_id',
        'product_stock_id',
        'batch_number',
        'expiration_date',
        'quantity_affected',
        'event_type',
        'status',
        'action_details',
        'created_by',
        'acknowledged_by',
        'acknowledged_at',
        'document_id',
    ];

    protected $casts = [
        'expiration_date' => 'date',
        'acknowledged_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relations
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productStock(): BelongsTo
    {
        return $this->belongsTo(ProductStock::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /**
     * Scopes
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeByEventType($query, $type)
    {
        return $query->where('event_type', $type);
    }

    public function scopeExpiredProducts($query)
    {
        return $query->where('event_type', 'marked_as_expired');
    }

    public function scopeRecentAlerts($query, $days = 7)
    {
        return $query->where('created_at', '>=', Carbon::now()->subDays($days));
    }

    /**
     * Accessors
     */
    public function getIsAcknowledgedAttribute(): bool
    {
        return $this->status !== 'pending';
    }

    public function getDaysUntilExpirationAttribute(): int
    {
        return $this->expiration_date->diffInDays(Carbon::now());
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->expiration_date->isPast();
    }
}
