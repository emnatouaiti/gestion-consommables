<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\View\View;

class NewPasswordController extends Controller
{
    /**
     * Display the password reset view.
     */
    public function create(Request $request): View
    {
        return view('auth.reset-password', ['request' => $request]);
    }

    /**
     * Handle an incoming new password request.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string', 'size:6'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$resetRecord) {
            return back()->withInput($request->only('email'))
                ->withErrors(['code' => 'Code invalide ou expiré.']);
        }

        // Check if code is expired (15 minutes)
        if ($resetRecord->created_at && now()->diffInMinutes($resetRecord->created_at) > 15) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return back()->withInput($request->only('email'))
                ->withErrors(['code' => 'Ce code a expiré. Veuillez demander un nouveau code.']);
        }

        // Verify the code
        if ($resetRecord->token && !Hash::check($request->code, $resetRecord->token)) {
            return back()->withInput($request->only('email'))
                ->withErrors(['code' => 'Code invalide.']);
        }

        // Find user and update password
        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return back()->withInput($request->only('email'))
                ->withErrors(['email' => 'Utilisateur introuvable.']);
        }

        $user->forceFill([
            'password' => Hash::make($request->password),
            'remember_token' => Str::random(60),
        ])->save();

        // Delete the used reset code
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        event(new PasswordReset($user));

        // Log the password reset
        try {
            AuditService::log($user, 'RESET_PASSWORD', 'User reset password via web verification code');
        }
        catch (\Exception $e) {
            \Log::error('Failed to log password reset audit: ' . $e->getMessage());
        }

        // Log the user in
        Auth::login($user);

        return redirect()->route('dashboard')->with('status', 'Mot de passe réinitialisé avec succès');
    }
}
