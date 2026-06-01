import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    private readonly TOKEN_KEY = 'auth_token';

    constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        let token = null;

        if (isPlatformBrowser(this.platformId)) {
            token = localStorage.getItem(this.TOKEN_KEY);
        }

        // debug log
        try { console.debug('[AuthInterceptor] token:', token); } catch (e) {}

        const headers: any = {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        request = request.clone({ setHeaders: headers });

        return next.handle(request);
    }
}
