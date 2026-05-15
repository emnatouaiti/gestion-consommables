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
        console.error('API Error:', error);
        if (error?.error) {
            console.error('API Error payload:', error.error);
        }
        let errorBody = error.error;
        if (!errorBody) {
            errorBody = { message: error.message || 'An unknown error occurred' };
        } else if (typeof errorBody === 'string') {
            errorBody = { message: 'Server returned an error', details: errorBody };
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
}
