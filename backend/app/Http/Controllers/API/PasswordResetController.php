<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Services\AuditService;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    /**
     * Send a password reset code to the given user.
     */
    public function sendResetLink(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['Nous ne trouvons pas d\'utilisateur avec cette adresse email.'],
            ]);
        }

        // Generate a 6-digit code
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store the code in password_reset_tokens table
        DB::table('password_reset_tokens')->updateOrInsert(
        ['email' => $request->email],
        [
            'email' => $request->email,
            'token' => Hash::make($code),
            'created_at' => now(),
        ]
        );

        // Send the notification
        $user->notify(new ResetPasswordNotification($code));

        return response()->json([
            'message' => 'Code de réinitialisation envoyé par email'
        ]);
    }

    /**
     * Verify the reset code.
     */
    public function verifyCode(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|size:6',
        ]);

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$resetRecord) {
            throw ValidationException::withMessages([
                'code' => ['Code invalide ou expiré.'],
            ]);
        }

        // Check if code is expired (15 minutes)
        if (now()->diffInMinutes($resetRecord->created_at) > 15) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            throw ValidationException::withMessages([
                'code' => ['Ce code a expiré. Veuillez demander un nouveau code.'],
            ]);
        }

        // Verify the code
        if (!Hash::check($request->code, $resetRecord->token)) {
            throw ValidationException::withMessages([
                'code' => ['Code invalide.'],
            ]);
        }

        return response()->json([
            'message' => 'Code vérifié avec succès',
            'email' => $request->email,
        ]);
    }

    /**
     * Reset the user's password using the verified code.
     */
    public function reset(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|size:6',
            'password' => 'required|min:8|confirmed',
        ]);

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$resetRecord) {
            throw ValidationException::withMessages([
                'code' => ['Code invalide ou expiré.'],
            ]);
        }

        // Check if code is expired (15 minutes)
        if (now()->diffInMinutes($resetRecord->created_at) > 15) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            throw ValidationException::withMessages([
                'code' => ['Ce code a expiré. Veuillez demander un nouveau code.'],
            ]);
        }

        // Verify the code
        if (!Hash::check($request->code, $resetRecord->token)) {
            throw ValidationException::withMessages([
                'code' => ['Code invalide.'],
            ]);
        }

        // Find user and update password
        $user = User::where('email', $request->email)->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['Utilisateur introuvable.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($request->password)
        ])->setRememberToken(Str::random(60));

        $user->save();

        // Delete the used reset code
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        // Log the password reset
        AuditService::log($user, 'RESET_PASSWORD', 'User reset password via verification code');

        return response()->json([
            'message' => 'Mot de passe réinitialisé avec succès'
        ]);
    }
}
