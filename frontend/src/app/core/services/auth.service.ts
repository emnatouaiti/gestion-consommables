import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly TOKEN_KEY = 'auth_token';
    currentUser = signal<any>(null);

    constructor(
        private apiService: ApiService,
        private router: Router,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        if (isPlatformBrowser(this.platformId)) {
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
                next: (user) => this.currentUser.set(user),
                error: () => {
                    try { console.debug('[AuthService] loadUser failed, logging out'); } catch (e) {}
                    this.logout();
                }
            });
        }
    }

    login(credentials: { email: string; password: string }): Observable<any> {
        return this.apiService.post('login', credentials).pipe(
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
            localStorage.setItem(this.TOKEN_KEY, token);
            // fetch user immediately then navigate according to role
            this.apiService.get('user').subscribe({
                next: (user) => {
                    this.currentUser.set(user);
                    this.router.navigate([this.resolvePostLoginRoute(user)]);
                },
                error: () => {
                    // if fetching user fails, fallback to admin root
                    this.router.navigate(['/login']);
                }
            });
        }
    }

    logout() {
        this.apiService.post('logout').subscribe({
            next: () => this.purgeAuth(),
            error: () => this.purgeAuth()
        });
    }

    private normalizeRoleName(role: any): string {
        return String(role || '').trim().toLowerCase();
    }

    getUserRoles(user: any): string[] {
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
            return '/admin/dashboard';
        }

        if (this.userHasAnyRole(user, ['Directeur', 'Validateur'])) {
            return '/admin/validation-demandes';
        }

        if (this.userHasAnyRole(user, ['Agent', 'Responsable', 'Gestionnaire'])) {
            return '/admin/demandes-consommables';
        }

        // Default for plain users
        return '/admin/demandes-consommables';
    }

    private setSession(authResult: any) {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.TOKEN_KEY, authResult.token);
        }

        try { console.debug('[AuthService] setSession token:', authResult.token, 'user:', authResult.user); } catch (e) {}
        this.currentUser.set(authResult.user);
        this.router.navigate([this.resolvePostLoginRoute(authResult.user)]);
    }

    private purgeAuth() {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(this.TOKEN_KEY);
        }
        this.currentUser.set(null);
        this.router.navigate(['/login']);
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
