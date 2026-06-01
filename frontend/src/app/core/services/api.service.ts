import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    private formatErrors(error: any) {
        const status = Number(error?.status || 0);
        if (status >= 500 || status === 0) {
            console.error('API Error:', error);
            if (error?.error) {
                console.error('API Error payload:', error.error);
            }
        }
        let errorBody = error.error;
        if (!errorBody) {
            errorBody = { message: error.message || 'An unknown error occurred' };
        } else if (typeof errorBody === 'string') {
            errorBody = { message: 'Server returned an error', details: errorBody };
        } else if (typeof errorBody === 'object' && !errorBody.message && errorBody.errors) {
            const merged = Object.values(errorBody.errors).flat().join(' | ');
            errorBody = { ...errorBody, message: merged || 'Erreur de validation.' };
        }
        return throwError(() => errorBody);
    }

    get(path: string, params: HttpParams = new HttpParams()): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.get(url, { params, withCredentials: true })
            .pipe(catchError(this.formatErrors));
    }

    post(path: string, body: any = {}): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.post(url, body, { withCredentials: true })
            .pipe(catchError(this.formatErrors));
    }

    put(path: string, body: any = {}): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.put(url, body, { withCredentials: true })
            .pipe(catchError(this.formatErrors));
    }

    delete(path: string): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.delete(url, { withCredentials: true })
            .pipe(catchError(this.formatErrors));
    }

    extractErrorMessage(err: any, fallback = 'Une erreur est survenue.'): string {
        if (typeof err?.message === 'string' && err.message.trim()) {
            return err.message.trim();
        }

        const payload = err?.error ?? err;
        if (typeof payload?.message === 'string' && payload.message.trim()) {
            return payload.message.trim();
        }

        const errors = payload?.errors;
        if (errors && typeof errors === 'object') {
            const merged = Object.values(errors).flat().filter(Boolean).join(' | ').trim();
            if (merged) return merged;
        }

        return fallback;
    }
}
