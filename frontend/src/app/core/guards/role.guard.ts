import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    const expected = route.data['roles'] as string[] | undefined;

    // If there's no token, redirect to login immediately
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return of(false);
    }

    // If we already have the current user in memory, use it synchronously
    const cachedUser = this.auth.getCurrentUserSnapshot();
    if (cachedUser) {
      if (!expected || expected.length === 0) {
        return of(true);
      }

      const ok = this.auth.userHasAnyRole(cachedUser, expected);
      if (!ok) {
        this.router.navigate(['/admin']);
      }
      return of(ok);
    }

    // Fallback: call API to get current user (may still redirect on error)
    return this.auth.getCurrentUser().pipe(
      map(user => {
        if (!user) {
          this.router.navigate(['/login']);
          return false;
        }

        if (!expected || expected.length === 0) {
          return true;
        }

        const ok = this.auth.userHasAnyRole(user, expected);
        if (!ok) {
          this.router.navigate(['/admin']);
        }

        return ok;
      }),
      catchError(() => {
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
