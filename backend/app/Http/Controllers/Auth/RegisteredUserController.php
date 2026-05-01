<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\View\View;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): View
    {
        return view('auth.register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'nomprenom' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'service' => ['nullable', 'string', 'max:255'],
            'poste' => ['nullable', 'string', 'max:255'],
            'siege' => ['nullable', 'string', 'max:255'],
        ]);

        $user = User::create([
            'nomprenom' => $request->nomprenom,
            'email' => $request->email,
            'password' => $request->password,
            'service' => $request->input('service', 'Non defini'),
            'poste' => $request->input('poste', 'Non defini'),
            'siege' => $request->input('siege', 'Non defini'),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
