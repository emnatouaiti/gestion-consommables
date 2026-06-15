import { Component, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    standalone: false
})
export class LoginComponent {
    loginForm: FormGroup;
    errorMessage: string = '';
    isLoading: boolean = false;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });

        // Check for Google callback errors from sessionStorage
        try {
            const googleError = sessionStorage.getItem('google_login_error');
            if (googleError) {
                this.errorMessage = googleError;
                sessionStorage.removeItem('google_login_error');
            }
        } catch (e) {}
    }

    onSubmit() {
        if (this.loginForm.invalid) {
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        this.authService.login(this.loginForm.value).subscribe({
            next: () => {
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.message || 'Login failed. Please check your credentials.';
                this.cdr.detectChanges();
            }
        });
    }

    loginWithGoogle() {
        this.isLoading = true;
        this.errorMessage = '';

        // Clear local auth state before attempting Google login
        // to prevent being logged in with a previous session
        try {
            localStorage.removeItem('auth_token');
        } catch (e) {}
        this.authService.currentUser.set(null);

        this.authService.loginWithGoogle().subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.cdr.detectChanges();
                if (res && res.url) {
                    window.location.href = res.url;
                } else {
                    this.errorMessage = 'Google login: invalid response';
                }
            },
            error: (err) => {
                this.isLoading = false;
                console.error('Google login error:', err);
                this.errorMessage = 'Google login failed: ' + (err.message || 'Unknown error');
                this.cdr.detectChanges();
            }
        });
    }
}
