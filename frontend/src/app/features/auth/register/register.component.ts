import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css'],
    standalone: false
})
export class RegisterComponent {
    registerForm: FormGroup;
    errorMessage: string = '';
    isLoading: boolean = false;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService
    ) {
        this.registerForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]],
            password_confirmation: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('password')?.value === g.get('password_confirmation')?.value
            ? null : { mismatch: true };
    }

    onSubmit() {
        if (this.registerForm.invalid) {
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        this.authService.register(this.registerForm.value).subscribe({
            next: () => {
                this.isLoading = false;
                // Navigation handled in AuthService
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.message || 'Registration failed. Please try again.';
            }
        });
    }
}
