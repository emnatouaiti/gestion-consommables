<section>
    <header>
        <h2 class="text-lg font-medium text-gray-900">
            {{ __('Profile Information') }}
        </h2>

        <p class="mt-1 text-sm text-gray-600">
            {{ __("Update your account's profile information and email address.") }}
        </p>
    </header>

    <form id="send-verification" method="post" action="{{ route('verification.send') }}">
        @csrf
    </form>

    <form
        method="post"
        action="{{ route('profile.update') }}"
        class="mt-6 space-y-6"
        x-data="{
            initial: {},
            hasChanges: false,
            isSubmitting: false,
            showSaved: @json(session('status') === 'profile-updated'),
            init() {
                this.captureInitial();
                if (this.showSaved) {
                    setTimeout(() => this.showSaved = false, 2000);
                }
            },
            captureInitial() {
                this.initial = Object.fromEntries(new FormData(this.$el).entries());
                this.hasChanges = false;
                this.isSubmitting = false;
            },
            detectChanges() {
                const current = Object.fromEntries(new FormData(this.$el).entries());
                this.hasChanges = JSON.stringify(current) !== JSON.stringify(this.initial);
            },
            handleSubmit() {
                this.isSubmitting = true;
            }
        }"
        x-on:input.debounce.100ms="detectChanges()"
        x-on:change="detectChanges()"
        x-on:submit="handleSubmit()"
    >
        @csrf
        @method('patch')

        <div>
            <x-input-label for="nomprenom" :value="__('Nom & Prénom')" />
            <x-text-input id="nomprenom" name="nomprenom" type="text" class="mt-1 block w-full" :value="old('nomprenom', $user->nomprenom)" required autofocus autocomplete="name" />
            <x-input-error class="mt-2" :messages="$errors->get('nomprenom')" />
        </div>

        <div>
            <x-input-label for="email" :value="__('Email')" />
            <x-text-input id="email" name="email" type="email" class="mt-1 block w-full" :value="old('email', $user->email)" required autocomplete="username" />
            <x-input-error class="mt-2" :messages="$errors->get('email')" />

            @if ($user instanceof \Illuminate\Contracts\Auth\MustVerifyEmail && ! $user->hasVerifiedEmail())
                <div>
                    <p class="text-sm mt-2 text-gray-800">
                        {{ __('Your email address is unverified.') }}

                        <button form="send-verification" class="underline text-sm text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            {{ __('Click here to re-send the verification email.') }}
                        </button>
                    </p>

                    @if (session('status') === 'verification-link-sent')
                        <p class="mt-2 font-medium text-sm text-green-600">
                            {{ __('A new verification link has been sent to your email address.') }}
                        </p>
                    @endif
                </div>
            @endif
        </div>

        <div class="flex items-center gap-4">
            <x-primary-button x-bind:disabled="!hasChanges || isSubmitting">
                {{ __('Save') }}
            </x-primary-button>

            <p x-show="showSaved" x-transition class="text-sm text-gray-600">{{ __('Saved.') }}</p>
        </div>
    </form>
</section>
