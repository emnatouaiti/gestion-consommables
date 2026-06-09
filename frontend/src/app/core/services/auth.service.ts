import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, switchMap, of } from 'rxjs';
import { ApiService } from './api.service';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly TOKEN_KEY = 'auth_token';
    private readonly USER_CACHE_KEY = 'auth_user';
    currentUser = signal<any>(null);

    constructor(
        private apiService: ApiService,
        private router: Router,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        if (isPlatformBrowser(this.platformId)) {
            const cachedUser = localStorage.getItem(this.USER_CACHE_KEY);
            if (cachedUser) {
                try { this.currentUser.set(JSON.parse(cachedUser)); } catch {}
            }
            
            // Listen for changes in localStorage from other tabs
            window.addEventListener('storage', (event) => {
                if (event.key === this.TOKEN_KEY && !event.newValue) {
                    this.currentUser.set(null);
                    this.router.navigateByUrl('/login');
                }
            });

            setTimeout(() => this.loadUser(), 0);
        }
    }

    private loadUser() {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }

        const token = localStorage.getItem(this.TOKEN_KEY);
        try { console.debug('[AuthService] loadUser token:', token); } catch (e) {}
        if (token) {
            this.apiService.get('user').subscribe({
                next: (user) => {
                    this.currentUser.set(user);
                    if (isPlatformBrowser(this.platformId)) {
                        localStorage.setItem(this.USER_CACHE_KEY, JSON.stringify(user));
                    }
                },
                error: (err) => {
                    const status = Number(err?.status || err?.error?.status || 0);
                    // Only purge session when truly unauthorized
                    if (status === 401 || status === 403) {
                        try { console.debug('[AuthService] unauthorized session, logging out'); } catch (e) {}
                        this.logout();
                    }
                }
            });
        }
    }

    login(credentials: { email: string; password: string }): Observable<any> {
        // Pour Sanctum SPA : on récupère le cookie CSRF d'abord
        return this.apiService.get('sanctum/csrf-cookie').pipe(
            switchMap(() => this.apiService.post('login', credentials)),
            tap(response => {
                this.setSession(response);
            })
        );
    }

    register(userData: any): Observable<any> {
        return this.apiService.post('register', userData).pipe(
            tap(response => {
                this.setSession(response);
            })
        );
    }

    forgotPassword(email: string): Observable<any> {
        return this.apiService.post('forgot-password', { email });
    }

    verifyCode(email: string, code: string): Observable<any> {
        return this.apiService.post('verify-code', { email, code });
    }

    resetPassword(data: any): Observable<any> {
        return this.apiService.post('reset-password', data);
    }

    loginWithGoogle(): Observable<any> {
        return this.apiService.get('auth/google');
    }

    handleGoogleCallback(token: string) {
        if (isPlatformBrowser(this.platformId)) {
            // Clear any existing token first to prevent session conflicts
            const oldToken = localStorage.getItem(this.TOKEN_KEY);
            if (oldToken && oldToken !== token) {
                // Revoke old token if different
                this.currentUser.set(null);
            }
            localStorage.setItem(this.TOKEN_KEY, token);
            // fetch user immediately then navigate according to role
            this.apiService.get('user').subscribe({
                next: (user) => {
                    console.log('[AuthService] Google callback user:', user);
                    this.currentUser.set(user);
                    const route = this.resolvePostLoginRoute(user);
                    console.log('[AuthService] Google callback route:', route);
                    this.router.navigate([route]);
                },
                error: (err) => {
                    console.error('[AuthService] Google callback user fetch error:', err);
                    // if fetching user fails, clear token and go to login
                    localStorage.removeItem(this.TOKEN_KEY);
                    this.currentUser.set(null);
                    this.router.navigate(['/login']);
                }
            });
        }
    }

    logout() {
        // Navigate immediately to prevent being stuck on current page
        this.purgeAuth();
        // Then call the API to invalidate the session on the server
        this.apiService.post('logout').subscribe({
            next: () => {},
            error: () => {}
        });
    }

    private normalizeRoleName(role: any): string {
        return String(role || '').trim().toLowerCase();
    }

    /**
   * Return a primary role string for the current user, or null if not logged in.
   */
  getUserRole(): string | null {
    const user = this.currentUser();
    if (!user) return null;
    const roles = this.getUserRoles(user);
    return roles.length ? roles[0] : null;
  }

    /**
     * Extract normalized role strings from a user object.
     * Handles both role relations (array of role objects) and a direct role field.
     */
    public getUserRoles(user: any): string[] {
        const relationRoles = (user?.roles || []).map((r: any) => r?.name || r);
        const fallbackRole = user?.role ? [user.role] : [];
        const allRoles = [...relationRoles, ...fallbackRole]
            .map(role => this.normalizeRoleName(role))
            .filter(Boolean);
        return [...new Set(allRoles)];
    }


    userHasAnyRole(user: any, expected: string[]): boolean {
        if (!user || !expected?.length) {
            return false;
        }

        const roles = this.getUserRoles(user);
        const normalizedExpected = expected.map(role => this.normalizeRoleName(role)).filter(Boolean);
        return normalizedExpected.some(role => roles.includes(role));
    }

    private resolvePostLoginRoute(user: any): string {
        if (!user) return '/login';

        if (this.userHasAnyRole(user, ['Administrateur'])) {
            return '/dashboard';
        }

        if (this.userHasAnyRole(user, ['Directeur', 'Validateur'])) {
            return '/validation-demandes';
        }

        if (this.userHasAnyRole(user, ['Agent', 'Responsable', 'Gestionnaire'])) {
            return '/demandes-consommables';
        }

        // Default for plain users
        return '/demandes-consommables';
    }

    private setSession(authResult: any) {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.TOKEN_KEY, authResult.token);
        }

        try { console.debug('[AuthService] setSession token:', authResult.token, 'user:', authResult.user); } catch (e) {}
        this.currentUser.set(authResult.user);
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.USER_CACHE_KEY, JSON.stringify(authResult.user || null));
        }
        this.router.navigate([this.resolvePostLoginRoute(authResult.user)]);
    }

    private purgeAuth() {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.USER_CACHE_KEY);
            try { console.debug('[AuthService] purgeAuth called, navigating to /login'); } catch (e) {}
        }
        this.currentUser.set(null);
        this.router.navigateByUrl('/login');
    }

    isAuthenticated(): boolean {
        if (isPlatformBrowser(this.platformId)) {
            return !!localStorage.getItem(this.TOKEN_KEY);
        }
        return false;
    }

    getToken(): string | null {
        if (isPlatformBrowser(this.platformId)) {
            return localStorage.getItem(this.TOKEN_KEY);
        }
        return null;
    }

    getCurrentUserSnapshot() {
        return this.currentUser();
    }

    getCurrentUser(): Observable<any> {
        return this.apiService.get('user');
    }

    updateProfile(data: any): Observable<any> {
        if (data instanceof FormData) {
            data.set('_method', 'PUT');
            return this.apiService.post('user/profile', data).pipe(
                tap((response) => {
                    if (response?.user) {
                        this.currentUser.set(response.user);
                    }
                })
            );
        }

        return this.apiService.put('user/profile', data).pipe(
            tap((response) => {
                if (response?.user) {
                    this.currentUser.set(response.user);
                }
            })
        );
    }

    changePassword(data: { currentPassword: string; newPassword: string }): Observable<any> {
        return this.apiService.put('user/password', data);
    }
}
