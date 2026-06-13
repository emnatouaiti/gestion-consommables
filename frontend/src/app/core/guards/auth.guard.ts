import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    constructor(
        private authService: AuthService, 
        private router: Router,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    canActivate(): boolean | UrlTree {
        if (!isPlatformBrowser(this.platformId)) {
            // Wait for browser to evaluate authentication so SSR doesn't improperly redirect to login
            return true;
        }

        const hasToken = this.authService.isAuthenticated();

        if (hasToken) {
            return true;
        }

        return this.router.createUrlTree(['/login']);
    }
}

