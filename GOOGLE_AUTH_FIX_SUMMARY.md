# Google Authentication Fix Summary

## Problem
When clicking "Continuer avec Google" (Continue with Google), the authentication was not working properly. The user reported that it "connects with admin" instead of using Google authentication.

## Root Cause Analysis

1. **Database Connection Issue**: The MySQL database server was not running, causing all backend API calls to fail with a 500 error (`SQLSTATE[HY000] [2002]`).

2. **Session Conflict**: When a user was already logged in (as admin) and tried to use Google login, the existing session could interfere with the Google OAuth flow.

3. **Poor Error Handling**: The Google OAuth flow had minimal error feedback - errors were silently swallowed and the user was just redirected to login without any explanation.

4. **Missing Error Display**: The login page didn't display errors that occurred during the Google callback phase.

## Changes Made

### 1. Frontend: `frontend/src/app/features/auth/login/login.component.ts`

**Changes:**
- Clear local auth state (localStorage and currentUser signal) before initiating Google login
- Added better error handling with detailed error messages
- Added loading state management during Google login
- Added check for Google callback errors from sessionStorage on component initialization

### 2. Frontend: `frontend/src/app/core/services/auth.service.ts`

**Changes:**
- Updated `handleGoogleCallback` to clear old token before setting new one
- Added console logging to debug user and route resolution
- Improved error handling to clear token and redirect to login on failure
- Added logging to help diagnose role-based routing issues

### 3. Frontend: `frontend/src/app/features/auth/google-callback/google-callback.component.ts`

**Changes:**
- Added error handling for when Google returns an error parameter
- Added error storage in sessionStorage to display on login page
- Added handling for missing token scenarios

```typescript
loginWithGoogle() {
    this.isLoading = true;
    this.errorMessage = '';

    // Clear local auth state before attempting Google login
    try {
        localStorage.removeItem('auth_token');
    } catch (e) {}
    this.authService.currentUser.set(null);

    this.authService.loginWithGoogle().subscribe({
        next: (res: any) => {
            this.isLoading = false;
            if (res && res.url) {
                window.location.href = res.url;
            } else {
                this.errorMessage = 'Google login: invalid response';
            }
        },
        error: (err) => {
            this.isLoading = false;
            console.error('Google login error:', err);
            this.errorMessage = 'Google login failed: ' + (err.message || 'Unknown error');
        }
    });
}
```

### 4. Backend: Config Cache Cleared

**Changes:**
- Added error handling for when Google returns an error parameter
- Added error storage in sessionStorage to display on login page
- Added handling for missing token scenarios

```typescript
ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
        const token = params['token'];
        const error = params['error'];

        if (error) {
            console.error('Google callback error:', error);
            try {
                sessionStorage.setItem('google_login_error', error);
            } catch (e) {}
            this.router.navigate(['/login']);
            return;
        }

        if (token) {
            this.authService.handleGoogleCallback(token);
        } else {
            try {
                sessionStorage.setItem('google_login_error', 'No authentication token received');
            } catch (e) {}
            this.router.navigate(['/login']);
        }
    });
}
```

### 3. Backend: Config Cache Cleared

Ran `php artisan config:clear` to ensure the latest Google OAuth credentials from `.env` are being used.

## ⚠️ IMPORTANT: MySQL Server Must Be Running

The Google authentication (and all backend operations) require the MySQL database server to be running. If you see errors like `SQLSTATE[HY000] [2002]`, it means MySQL is not running.

### Starting MySQL on Windows:

1. **Open Services**:
   - Press `Win + R`
   - Type `services.msc` and press Enter

2. **Find MySQL Service**:
   - Look for a service named `MySQL`, `MySQL80`, `MySQL57`, or similar

3. **Start the Service**:
   - Right-click on the MySQL service
   - Select "Start" or "Démarrer" (in French)

4. **Alternative: Use Command Line**:
   ```cmd
   net start MySQL80
   ```
   (Replace `MySQL80` with your actual MySQL service name)

5. **If MySQL is not installed**:
   - Download and install MySQL from https://dev.mysql.com/downloads/mysql/
   - Or use XAMPP/WAMP which includes MySQL

## Testing Instructions

1. **Start MySQL** (see instructions above)

2. **Clear your browser cache and cookies** to ensure no stale sessions exist.

3. **Start the backend server:**
   ```bash
   cd backend
   php artisan serve
   ```

4. **Start the frontend server:**
   ```bash
   cd frontend
   npm start
   ```

5. **Test Google Login:**
   - Navigate to the login page
   - Click "Continuer avec Google"
   - You should be redirected to Google's authentication page
   - After authenticating with Google, you should be redirected back to the application
   - You should be logged in with your Google account

6. **Test Error Scenarios:**
   - Try clicking Google login while already logged in as admin
   - The system should clear the session and proceed with Google login
   - If there's an error, you should see a descriptive error message on the login page

## Google OAuth Configuration

Make sure the following environment variables are correctly set in `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://127.0.0.1:8000/api/auth/google/callback
```

## Google Cloud Console Setup

Ensure your Google Cloud project has:
1. OAuth 2.0 Client ID configured
2. Authorized redirect URI set to: `http://127.0.0.1:8000/api/auth/google/callback`
3. OAuth consent screen configured

## Troubleshooting

If Google login still doesn't work:

1. **Check if MySQL is running**:
   - Open Task Manager and look for `mysqld.exe` process
   - Or try: `net start | findstr MySQL`

2. **Check browser console** for any JavaScript errors

3. **Check network tab** to see if the `/api/auth/google` request succeeds

4. **Verify Google credentials** in `.env` file are correct

5. **Clear Laravel config cache**: `cd backend && php artisan config:clear`

6. **Check Laravel logs** at `backend/storage/logs/laravel.log` for any backend errors

7. **Verify the redirect URL** in Google Cloud Console matches the one in your `.env` file

8. **Important: Email matching behavior**
   - If you log in with Google using an email that already exists in the database, the system will link the Google account to the existing user
   - For example, if `admin@admin.com` exists as an admin user, and you log in with Google using that same email, you will be logged in as that admin user
   - To test Google login with a new user, use a Google account with an email that does NOT exist in your database

9. **Check user roles in database**
   - If you're being redirected to the wrong page, check your user's role in the database
   - Run: `SELECT id, email, nomprenom, role_id FROM users WHERE email = 'your-email@gmail.com';`
   - The role_id determines where you're redirected after login
