import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

interface UserProfile {
  nomprenom: string;
  email: string;
  adresse?: string;
  telephone?: string;
  photo?: string;
  avatar?: string;
  photo_url?: string;
}

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit, OnDestroy {
  // Formulaires
  profileForm: FormGroup;
  passwordForm: FormGroup;

  // Gestion de la photo
  selectedPhotoFile: File | null = null;
  photoPreviewUrl = '';
  private originalPhotoUrl = '';

  // États de chargement
  isLoading = false;
  isSavingProfile = false;
  isChangingPassword = false;

  // Messages
  successMessage = '';
  errorMessage = '';
  passwordSuccessMessage = '';
  passwordErrorMessage = '';

  // Modal
  isModalOpen = false;

  // Configuration
  private readonly apiBase = '/api';
  private readonly storageBase = 'http://localhost:8000/storage';

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Formulaire profil
    this.profileForm = this.fb.group({
      nomprenom: ['', Validators.required],
      email:     ['', [Validators.required, Validators.email]],
      adresse:   [''],
      telephone: ['']
    });

    // Formulaire mot de passe avec validation personnalisée
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword:     ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadProfile();
  }

  ngOnDestroy(): void {
    if (this.photoPreviewUrl && this.photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreviewUrl);
    }
  }

  // ─── Validateur personnalisé ──────────────────────────────────────────

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      control.get('confirmPassword')?.setErrors({ mismatch: true });
      return { passwordMismatch: true };
    }

    return null;
  }

  // ─── Gestion du token ─────────────────────────────────────────────────

  private getToken(): string | null {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }

  private authHeaders(): Record<string, string> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // ─── Résolution des URLs de photo ─────────────────────────────────────

  private resolvePhotoUrl(photo: string | null | undefined): string {
    if (!photo) {
      console.log('[Photo] Aucune photo fournie');
      return '';
    }

    let normalizedPhoto = String(photo).trim().replace(/\\/g, '/');
    console.log('[Photo] Entrée brute:', photo, '→ Normalisée:', normalizedPhoto);

    if (normalizedPhoto.startsWith('http://') || normalizedPhoto.startsWith('https://')) {
      console.log('[Photo] URL absolue détectée');
      return normalizedPhoto;
    }

    if (normalizedPhoto.startsWith('/storage/')) {
      const url = `http://localhost:8000${normalizedPhoto}`;
      console.log('[Photo] Chemin /storage détecté →', url);
      return url;
    }

    if (normalizedPhoto.startsWith('/')) {
      const url = `http://localhost:8000${normalizedPhoto}`;
      console.log('[Photo] Chemin absolu détecté →', url);
      return url;
    }

    // Supposer que c'est un chemin relatif
    const url = `${this.storageBase}/${normalizedPhoto}`;
    console.log('[Photo] Chemin relatif →', url);
    return url;
  }

  // ─── Chargement du profil ─────────────────────────────────────────────

  loadProfile(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    fetch(`${this.apiBase}/user`, {
      headers: this.authHeaders()
    })
      .then(async res => {
        if (!res.ok) {
          throw new Error(`Erreur HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((user: UserProfile) => {
        console.log('Profil chargé:', user);

        const photoUrl = user.photo || user.avatar || user.photo_url || '';
        this.photoPreviewUrl = this.resolvePhotoUrl(photoUrl);
        this.originalPhotoUrl = this.photoPreviewUrl;

        this.profileForm.patchValue({
          nomprenom: user.nomprenom || '',
          email:     user.email     || '',
          adresse:   user.adresse   || '',
          telephone: user.telephone || ''
        });

        this.isLoading = false;
        this.cdr.detectChanges();
      })
      .catch(error => {
        console.error('Erreur chargement profil:', error);
        this.errorMessage = 'Impossible de charger le profil. Veuillez réessayer.';
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  // ─── Mise à jour du profil ────────────────────────────────────────────

  updateProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.cdr.detectChanges();

    const formData = new FormData();

    Object.keys(this.profileForm.controls).forEach(key => {
      const value = this.profileForm.get(key)?.value;
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    if (this.selectedPhotoFile) {
      formData.append('photo', this.selectedPhotoFile);
      formData.append('avatar', this.selectedPhotoFile);
      console.log('Photo ajoutée:', this.selectedPhotoFile.name);
    }

    formData.append('_method', 'PUT');

    fetch(`${this.apiBase}/user/profile`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: formData
    })
      .then(async res => {
        const data = await res.json();
        console.log('Réponse serveur:', data);

        if (!res.ok) {
          if (data.errors) {
            const firstErrorKey = Object.keys(data.errors)[0];
            const firstError = data.errors[firstErrorKey];
            this.errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
          } else {
            this.errorMessage = data.message || `Erreur serveur (${res.status})`;
          }
          throw new Error(this.errorMessage);
        }

        const updatedUser = data.user || data;

        console.log('Données utilisateur retournées:', updatedUser);

        if (updatedUser.photo) {
          console.log('Photo détectée:', updatedUser.photo);
          this.photoPreviewUrl = this.resolvePhotoUrl(updatedUser.photo);
        } else if (updatedUser.avatar) {
          console.log('Avatar détecté:', updatedUser.avatar);
          this.photoPreviewUrl = this.resolvePhotoUrl(updatedUser.avatar);
        } else if (updatedUser.photo_url) {
          console.log('Photo URL détectée:', updatedUser.photo_url);
          this.photoPreviewUrl = updatedUser.photo_url;
        }

        console.log('URL résolue:', this.photoPreviewUrl);

        this.originalPhotoUrl = this.photoPreviewUrl;
        this.successMessage = 'Profil mis à jour avec succès !';
        this.selectedPhotoFile = null;

        const fileInput = document.getElementById('photo') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        this.cdr.detectChanges();

        // Recharger le profil après un court délai pour s'assurer que la photo est bien mise à jour
        setTimeout(() => {
          this.loadProfile();
        }, 500);

      })
      .catch(error => {
        console.error('Erreur updateProfile:', error);
      })
      .finally(() => {
        this.isSavingProfile = false;
        this.cdr.detectChanges();
      });
  }

  // ─── Sélection photo ──────────────────────────────────────────────────

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) return;

    console.log('Fichier sélectionné:', file);

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    const ext = file.name.toLowerCase().split('.').pop() || '';

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      this.errorMessage = 'Veuillez choisir une image valide (JPG, PNG, GIF, WebP).';
      this.selectedPhotoFile = null;
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.errorMessage = 'Image trop grande (max 5 Mo).';
      this.selectedPhotoFile = null;
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    this.errorMessage = '';
    this.selectedPhotoFile = file;

    if (this.photoPreviewUrl && this.photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreviewUrl);
    }

    this.photoPreviewUrl = URL.createObjectURL(file);
    this.cdr.detectChanges();
  }

  onImageError(): void {
    console.warn('Erreur de chargement de l\'image');
    this.photoPreviewUrl = '';
    this.cdr.detectChanges();
  }

  // ─── CHANGEMENT DE MOT DE PASSE - VERSION CORRIGÉE AVEC camelCase ─────

  changePassword(): void {
    // 1. Vérifications côté client
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();

      if (this.passwordForm.hasError('passwordMismatch')) {
        this.passwordErrorMessage = 'Les mots de passe ne correspondent pas.';
      }
      this.cdr.detectChanges();
      return;
    }

    const currentPassword = this.passwordForm.get('currentPassword')?.value;
    const newPassword = this.passwordForm.get('newPassword')?.value;
    const confirmPassword = this.passwordForm.get('confirmPassword')?.value;

    if (newPassword !== confirmPassword) {
      this.passwordErrorMessage = 'Les mots de passe ne correspondent pas.';
      this.passwordForm.get('confirmPassword')?.setErrors({ mismatch: true });
      this.cdr.detectChanges();
      return;
    }

    this.isChangingPassword = true;
    this.passwordSuccessMessage = '';
    this.passwordErrorMessage = '';
    this.cdr.detectChanges();

    // ✅ FORMAT CORRECT d'après les logs : camelCase
    const passwordData = {
      currentPassword: currentPassword,  // camelCase
      newPassword: newPassword,          // camelCase
      // Le serveur n'attend pas confirmPassword d'après les logs
      // Mais on peut l'ajouter au cas où
      password_confirmation: confirmPassword
    };

    console.log('🔐 Données envoyées (format camelCase):', passwordData);
    console.log('🔐 Token:', this.getToken());

    fetch(`${this.apiBase}/user/password`, {
      method: 'PUT',
      headers: {
        ...this.authHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(passwordData)
    })
      .then(async res => {
        console.log('📡 Status code:', res.status);

        const responseText = await res.text();
        console.log('📡 Response brute:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
          console.log('📡 Response JSON:', data);
        } catch (e) {
          data = { message: responseText };
        }

        if (!res.ok) {
          if (res.status === 422 && data.errors) {
            console.log('❌ Erreurs de validation:', data.errors);

            // Construire un message d'erreur clair
            const errorMessages: string[] = [];
            Object.keys(data.errors).forEach(field => {
              const messages = data.errors[field];
              if (Array.isArray(messages)) {
                errorMessages.push(`${field}: ${messages.join(', ')}`);
              } else {
                errorMessages.push(`${field}: ${messages}`);
              }
            });

            this.passwordErrorMessage = errorMessages.join(' | ');
          } else {
            this.passwordErrorMessage = data.message || `Erreur serveur (${res.status})`;
          }

          throw new Error(this.passwordErrorMessage);
        }

        // Succès
        console.log('✅ SUCCÈS! Mot de passe changé');
        this.passwordSuccessMessage = 'Mot de passe modifié avec succès !';
        this.passwordForm.reset();

        Object.keys(this.passwordForm.controls).forEach(key => {
          this.passwordForm.get(key)?.setErrors(null);
        });

      })
      .catch(error => {
        console.error('❌ Erreur catch:', error);
        if (!this.passwordErrorMessage) {
          this.passwordErrorMessage = error.message || 'Erreur lors du changement de mot de passe';
        }
      })
      .finally(() => {
        this.isChangingPassword = false;
        this.cdr.detectChanges();
      });
  }

  // ─── Version alternative si la première ne fonctionne pas ────────────

  changePasswordAlternative(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const currentPassword = this.passwordForm.get('currentPassword')?.value;
    const newPassword = this.passwordForm.get('newPassword')?.value;

    this.isChangingPassword = true;
    this.passwordSuccessMessage = '';
    this.passwordErrorMessage = '';
    this.cdr.detectChanges();

    // Format strictement d'après les logs d'erreur
    const passwordData = {
      currentPassword: currentPassword,
      newPassword: newPassword
      // Pas de confirmation car les logs ne montrent pas cette erreur
    };

    console.log('🔐 Format strict:', passwordData);

    fetch(`${this.apiBase}/user/password`, {
      method: 'PUT',
      headers: {
        ...this.authHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(passwordData)
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur');
        this.passwordSuccessMessage = 'Mot de passe modifié avec succès !';
        this.passwordForm.reset();
      })
      .catch(error => {
        console.error('Erreur:', error);
        this.passwordErrorMessage = error.message;
      })
      .finally(() => {
        this.isChangingPassword = false;
        this.cdr.detectChanges();
      });
  }

  // ─── Gestion de la modal ─────────────────────────────────────────────

  openModal(): void {
    if (this.photoPreviewUrl && !this.photoPreviewUrl.startsWith('blob:')) {
      this.isModalOpen = true;
      this.cdr.detectChanges();
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.cdr.detectChanges();
  }
}
