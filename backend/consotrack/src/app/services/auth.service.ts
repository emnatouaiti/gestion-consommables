import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

type ApiUser = {
  role?: string;
  roles?: Array<{ id?: number; name?: string }>;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userApi = 'http://127.0.0.1:8000/api/user';

  constructor(private readonly http: HttpClient) {}

  getToken(): string {
    return (localStorage.getItem('token') ?? '').trim();
  }

  setToken(token: string): void {
    localStorage.setItem('token', token.trim());
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.getToken()}`,
      Accept: 'application/json',
    });
  }

  hasAdminFromLocalStorage(): boolean {
    const rawUser = localStorage.getItem('user');

    if (!rawUser) {
      return false;
    }

    try {
      const user = JSON.parse(rawUser) as ApiUser;
      return this.isAdmin(user);
    } catch {
      return false;
    }
  }

  checkAdminAccess(): Observable<boolean> {
    const token = this.getToken();
    if (!token) {
      return of(false);
    }

    if (this.hasAdminFromLocalStorage()) {
      return of(true);
    }

    return this.http.get<ApiUser>(this.userApi, { headers: this.authHeaders() }).pipe(
      tap((user) => localStorage.setItem('user', JSON.stringify(user))),
      map((user) => this.isAdmin(user)),
      catchError(() => of(false))
    );
  }

  private isAdmin(user: ApiUser): boolean {
    if (user.role === 'Administrateur') {
      return true;
    }

    const roleNames = (user.roles ?? []).map((role) => role.name ?? '');
    return roleNames.includes('Administrateur');
  }
}
