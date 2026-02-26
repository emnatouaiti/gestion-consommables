<x-guest-layout>
    <form method="POST" action="{{ route('password.store') }}">
        @csrf

        <!-- Email Address -->
        <div>
            <x-input-label for="email" value="Email" />
            <x-text-input id="email" class="block mt-1 w-full" type="email" name="email" :value="old('email', request('email'))" required autofocus autocomplete="username" />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <!-- Verification Code -->
        <div class="mt-4">
            <x-input-label for="code" value="Code de vérification (6 chiffres)" />
            <x-text-input id="code" class="block mt-1 w-full" type="text" name="code" required maxlength="6" pattern="[0-9]{6}" placeholder="123456" />
            <x-input-error :messages="$errors->get('code')" class="mt-2" />
            <p class="mt-1 text-sm text-gray-600">Entrez le code à 6 chiffres reçu par email</p>
        </div>

        <!-- Password -->
        <div class="mt-4">
            <x-input-label for="password" value="Nouveau mot de passe" />
            <x-text-input id="password" class="block mt-1 w-full" type="password" name="password" required autocomplete="new-password" />
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Confirm Password -->
        <div class="mt-4">
            <x-input-label for="password_confirmation" value="Confirmer le mot de passe" />
            <x-text-input id="password_confirmation" class="block mt-1 w-full"
                            type="password"
                            name="password_confirmation" required autocomplete="new-password" />
            <x-input-error :messages="$errors->get('password_confirmation')" class="mt-2" />
        </div>

        <div class="flex items-center justify-end mt-4">
            <x-primary-button>
                Réinitialiser le mot de passe
            </x-primary-button>
        </div>
    </form>
</x-guest-layout>
