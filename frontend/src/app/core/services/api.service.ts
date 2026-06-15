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
        // attach status for callers who need to handle specific HTTP codes
        (errorBody as any).status = status;
        return throwError(() => errorBody);
    }

    // Helper to download binary responses (blobs)
    getBlob(path: string): Observable<Blob> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        // Use HttpClient generic for Blob and cast the catchError handler to any
        return this.http.get<Blob>(url, { responseType: 'blob' as 'json' })
            .pipe(catchError(this.formatErrors as any));
    }

    get(path: string, params: HttpParams = new HttpParams()): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.get(url, { params })
            .pipe(catchError(this.formatErrors));
    }

    post(path: string, body: any = {}): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.post(url, body)
            .pipe(catchError(this.formatErrors));
    }

    put(path: string, body: any = {}): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.put(url, body)
            .pipe(catchError(this.formatErrors));
    }

    delete(path: string): Observable<any> {
        const url = path.startsWith('/') ? path : `${this.apiUrl}/${path}`;
        return this.http.delete(url)
            .pipe(catchError(this.formatErrors));
    }

    extractErrorMessage(err: any, fallback = 'Une erreur est survenue.'): string {
        // Traductions des messages de validation Laravel → Francais
        const translations: Record<string, string> = {
            'The name field is required.': 'Le nom est obligatoire.',
            'The name has already been taken.': 'Ce nom est deja utilise.',
            'The name field must be a string.': 'Le nom doit etre une chaine de caracteres.',
            'The warehouse id field is required.': 'Le depot est obligatoire.',
            'The warehouse id is invalid.': 'Le depot selectionne est invalide.',
            'The room id field is required.': 'La salle est obligatoire.',
            'The room id is invalid.': 'La salle selectionnee est invalide.',
            'The code field is required.': 'Le code est obligatoire.',
            'The code has already been taken.': 'Ce code est deja utilise.',
            'The capacity units field must be an integer.': 'La capacite doit etre un nombre entier.',
            'The capacity units field must be at least 1.': 'La capacite doit etre au moins 1.',
            'The max locations field must be an integer.': 'Le nombre max d\'emplacements doit etre un entier.',
            'The max locations field must be at least 1.': 'Le nombre max d\'emplacements doit etre au moins 1.',
            'The max cabinets field must be an integer.': 'Le nombre max d\'armoires doit etre un entier.',
            'The max cabinets field must be at least 1.': 'Le nombre max d\'armoires doit etre au moins 1.',
            'The max rooms field must be an integer.': 'Le nombre max de salles doit etre un entier.',
            'The max rooms field must be at least 1.': 'Le nombre max de salles doit etre au moins 1.',
            'The selected warehouse id is invalid.': 'Le depot selectionne n\'existe pas.',
            'The selected room id is invalid.': 'La salle selectionnee n\'existe pas.',
            'The phone field must be a string.': 'Le numero de telephone est invalide.',
            'The address field is required.': 'L\'adresse est obligatoire.',
        };

        const translate = (msg: string): string => {
            if (!msg) return msg;
            if (translations[msg]) return translations[msg];
            const key = Object.keys(translations).find(k => msg.toLowerCase() === k.toLowerCase());
            return key ? translations[key] : msg;
        };

        // Filtre le message inutile d'Angular HttpErrorResponse
        const isAngularMsg = (s: string) =>
            s.startsWith('Http failure response') || s.startsWith('Unknown Error');

        // Le body JSON est dans err.error si c'est un HttpErrorResponse brut,
        // sinon err lui-meme (apres passage par formatErrors de ApiService)
        const body: any = (err?.error && typeof err.error === 'object') ? err.error : err;

        // 1. Erreurs de validation par champ (priorite la plus haute)
        const errors = body?.errors ?? err?.errors;
        if (errors && typeof errors === 'object') {
            const messages: string[] = [];
            for (const fieldErrors of Object.values(errors)) {
                const arr = Array.isArray(fieldErrors) ? fieldErrors : [fieldErrors];
                for (const m of arr) {
                    if (m) messages.push(translate(String(m)));
                }
            }
            if (messages.length > 0) return messages.join('\n');
        }

        // 2. Message du body JSON Laravel (ex: capacite maximale atteinte)
        if (typeof body?.message === 'string' && body.message.trim() && !isAngularMsg(body.message)) {
            return translate(body.message.trim());
        }

        // 3. Message direct sur err (apres traitement par formatErrors)
        if (typeof err?.message === 'string' && err.message.trim() && !isAngularMsg(err.message)) {
            return translate(err.message.trim());
        }

        return fallback;
    }

}
