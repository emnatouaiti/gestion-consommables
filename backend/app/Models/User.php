<?php

namespace App\Models;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, HasRoles, SoftDeletes;

    protected $appends = ['name'];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'nomprenom',
        'email',
        'password',
        'adresse',
        'telephone',
        'service',
        'poste',
        'photo',
        'role',
        'google_id',
        'avatar',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Mutator for name attribute (maps to nomprenom)
     */
    public function setNameAttribute($value)
    {
        $this->attributes['nomprenom'] = $value;
    }

    /**
     * Accessor for name attribute (maps to nomprenom)
     */
    public function getNameAttribute()
    {
        return $this->attributes['nomprenom'] ?? null;
    }

    /**
     * Send the password reset notification with 6-digit code.
     *
     * @param  string  $token
     * @return void
     */
    public function sendPasswordResetNotification($token)
    {
        // The $token parameter is ignored - we generate our own 6-digit code
        // This method is called by Laravel's Password::sendResetLink()

        // Generate a 6-digit code
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store the code in password_reset_tokens table
        \DB::table('password_reset_tokens')->updateOrInsert(
        ['email' => $this->email],
        [
            'email' => $this->email,
            'token' => \Hash::make($code),
            'created_at' => now(),
        ]
        );

        // Send our custom notification with the code
        $this->notify(new \App\Notifications\ResetPasswordNotification($code));
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
