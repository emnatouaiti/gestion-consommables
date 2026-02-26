import { Component } from '@angular/core';
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
        private router: Router
    ) {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
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
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.message || 'Login failed. Please check your credentials.';
            }
        });
    }

    loginWithGoogle() {
        this.authService.loginWithGoogle().subscribe({
            next: (res: any) => {
                window.location.href = res.url;
            },
            error: () => {
                this.errorMessage = 'Google login failed';
            }
        });
    }
}
