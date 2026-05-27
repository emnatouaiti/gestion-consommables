import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Service that decides which dashboard component should be displayed
 * based on the logged‑in user's role. Used by a route guard.
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardSelectorService implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  /**
   * Returns true if navigation can proceed. The guard also redirects
   * to the appropriate dashboard component based on the role.
   */
  canActivate(): Observable<boolean | UrlTree> {
    return toObservable(this.auth.currentUser).pipe(
      map((user: any) => {
        if (!user) {
          return this.router.createUrlTree(['/login']);
        }
        return this.router.createUrlTree(['/admin/dashboard']);
      })
    );
  }
}
