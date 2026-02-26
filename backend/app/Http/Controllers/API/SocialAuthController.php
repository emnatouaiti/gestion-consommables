<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Exception;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    public function redirectToGoogle()
    {
        return response()->json([
            'url' => Socialite::driver('google')->stateless()->redirect()->getTargetUrl(),
        ]);
    }

    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();

            $user = User::where('google_id', $googleUser->id)->first();

            if ($user) {
                AuditService::log($user, 'LOGIN_GOOGLE', 'User logged in via Google');
            } else {
                $user = User::where('email', $googleUser->email)->first();

                if ($user) {
                    $user->update([
                        'google_id' => $googleUser->id,
                        'avatar' => $googleUser->avatar,
                    ]);
                    AuditService::log($user, 'LINK_GOOGLE', 'User linked Google account');
                } else {
                    $user = User::create([
                        'nomprenom' => $googleUser->name,
                        'email' => $googleUser->email,
                        'google_id' => $googleUser->id,
                        'password' => bcrypt(str()->random(24)),
                        'avatar' => $googleUser->avatar,
                        'photo' => $googleUser->avatar,
                    ]);

                    $user->assignRole('Utilisateur');
                    AuditService::log($user, 'REGISTER_GOOGLE', 'User registered via Google');
                }
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            return redirect('http://localhost:4200/auth/callback?token=' . $token);
        } catch (Exception $e) {
            return redirect('http://localhost:4200/login?error=' . urlencode($e->getMessage()));
        }
    }
}