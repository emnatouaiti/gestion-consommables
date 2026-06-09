import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(): boolean | UrlTree {
        // Vérifier à la fois le token ET que l'utilisateur est chargé
        const hasToken = this.authService.isAuthenticated();
        const hasUser = this.authService.getCurrentUserSnapshot() !== null;

        if (hasToken && hasUser) {
            return true;
        }

        return this.router.createUrlTree(['/login']);
    }
}

