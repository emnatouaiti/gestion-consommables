import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-forgot-password',
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.css'],
    standalone: false
})
export class ForgotPasswordComponent {
    step = 1; // 1: Email, 2: Code, 3: New Password
    emailForm: FormGroup;
    codeForm: FormGroup;
    passwordForm: FormGroup;
    isLoading = false;
    message = '';
    error = '';
    email = '';

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) {
        this.emailForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]]
        });

        this.codeForm = this.fb.group({
            code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
        });

        this.passwordForm = this.fb.group({
            password: ['', [Validators.required, Validators.minLength(8)]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('password')?.value === g.get('confirmPassword')?.value
            ? null : { mismatch: true };
    }

    sendCode() {
        if (this.emailForm.invalid) return;
        this.isLoading = true;
        this.error = '';
        this.message = '';

        const email = this.emailForm.get('email')?.value;

        this.authService.forgotPassword(email).subscribe({
            next: () => {
                this.isLoading = false;
                this.step = 2;
                this.email = email;
                this.message = 'Un code de verification a ete envoye a votre adresse email.';
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.isLoading = false;
                this.error = err.errors?.email?.[0] || err.message || 'Erreur lors de l\'envoi du code.';
                this.cdr.detectChanges();
            }
        });
    }

    verifyCode() {
        if (this.codeForm.invalid) return;
        this.isLoading = true;
        this.error = '';

        const code = this.codeForm.get('code')?.value;

        this.authService.verifyCode(this.email, code).subscribe({
            next: () => {
                this.isLoading = false;
                this.step = 3;
                this.message = 'Code verifie. Veuillez definir votre nouveau mot de passe.';
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.isLoading = false;
                this.error = err.errors?.code?.[0] || err.message || 'Code invalide.';
                this.cdr.detectChanges();
            }
        });
    }

    resetPassword() {
        if (this.passwordForm.invalid) return;
        if (this.passwordForm.get('password')?.value !== this.passwordForm.get('confirmPassword')?.value) {
            this.error = 'Les mots de passe ne correspondent pas.';
            return;
        }

        this.isLoading = true;
        this.error = '';

        const data = {
            email: this.email,
            code: this.codeForm.get('code')?.value,
            password: this.passwordForm.get('password')?.value,
            password_confirmation: this.passwordForm.get('confirmPassword')?.value
        };

        this.authService.resetPassword(data).subscribe({
            next: () => {
                this.isLoading = false;
                this.message = 'Mot de passe reinitialise avec succes ! Redirection...';
                this.cdr.detectChanges();
                setTimeout(() => {
                    this.router.navigate(['/login']);
                }, 2000);
            },
            error: (err) => {
                this.isLoading = false;
                this.error = err.errors?.password?.[0] || err.message || 'Erreur lors de la reinitialisation.';
                this.cdr.detectChanges();
            }
        });
    }
}
