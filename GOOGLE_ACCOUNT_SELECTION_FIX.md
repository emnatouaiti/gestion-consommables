# Google Account Selection Fix

## Problem
When clicking "Se connecter avec Google", the application was automatically logging in with the previously used Google account without showing the account selection popup, even when the user wanted to select a different Google account.

## Root Cause
Google OAuth was using the default behavior which remembers the last logged-in account and automatically authenticates without prompting for account selection.

## Solution
Modified `backend/app/Http/Controllers/API/SocialAuthController.php` to add the `prompt=select_account` parameter to the Google OAuth redirect URL.

### Changes Made
```php
public function redirectToGoogle()
{
    $url = Socialite::driver('google')->stateless()->redirect()->getTargetUrl();

    // Add prompt=select_account to force account selection every time
    // This ensures users can switch between Google accounts
    $separator = strpos($url, '?') !== false ? '&' : '?';
    $url .= $separator . http_build_query([
        'prompt' => 'select_account',
    ]);

    return response()->json([
        'url' => $url,
    ]);
}
```

## How It Works
The `prompt=select_account` parameter is an OAuth 2.0 standard parameter that tells Google to always display the account selection screen, allowing users to:
- Choose from multiple Google accounts
- Sign in with a different account
- Add a new account

## Testing
After applying this fix:
1. Clear your browser cache/cookies for Google (optional but recommended for testing)
2. Click "Se connecter avec Google"
3. You should now see the Google account selection screen every time
4. You can select any Google account or add a new one

## Additional Notes
- This change only affects the Google OAuth flow
- It does not impact the security of the authentication
- The parameter is added dynamically to the redirect URL before returning it to the frontend
- The frontend code (`login.component.ts`) already handles the redirect correctly by setting `window.location.href = res.url`

## Related Files
- `backend/app/Http/Controllers/API/SocialAuthController.php` - Modified to add prompt parameter
- `frontend/src/app/features/auth/login/login.component.ts` - Already correctly handles the redirect
- `frontend/src/app/core/services/auth.service.ts` - Already correctly handles the callback