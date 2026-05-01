<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Modele extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'marque_id', 'fabricant_id'];

    public function marque()
    {
        return $this->belongsTo(Marque::class);
    }

    public function fabricant()
    {
        return $this->belongsTo(Fabricant::class);
    }
}
