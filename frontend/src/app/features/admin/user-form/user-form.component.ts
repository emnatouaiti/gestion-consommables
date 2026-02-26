import {
  Component,
  OnInit,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-user-form',
  standalone: false,
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css']
})
export class UserFormComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  userId: any = null;
  roles: any[] = [];
  isLoading = false;
  errorMessage = '';

  private readonly apiBase = '/api';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.form = this.fb.group({
      nomprenom: ['', Validators.required],
      email:     ['', [Validators.required, Validators.email]],
      adresse:   [''],
      telephone: [''],
      roles:     ['', Validators.required]
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.userId = this.route.snapshot.paramMap.get('id');
    this.isEdit = !!this.userId;

    // Charger les rôles depuis l'API
    this.loadRoles().then(() => {
      // Charger l'utilisateur seulement après avoir les rôles (mode édition)
      if (this.isEdit) {
        this.loadUser();
      }
    });
  }

  private getHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  private async loadRoles(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBase}/admin/roles`, { headers: this.getHeaders() });
      const data = await res.json();
      // L'API peut retourner un tableau direct ou { data: [...] }
      this.roles = Array.isArray(data) ? data : (data?.data ?? []);
      this.cdr.detectChanges();
    } catch (err) {
      console.error('[UserForm] Erreur chargement rôles:', err);
    }
  }

  private loadUser(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    fetch(`${this.apiBase}/admin/users/${this.userId}`, { headers: this.getHeaders() })
      .then(res => res.json())
      .then((u: any) => {
        // Récupérer le nom du rôle actuel de l'utilisateur
        const currentRole = u.roles?.[0]?.name || u.role || '';

        this.form.patchValue({
          nomprenom: u.nomprenom || '',
          email:     u.email     || '',
          adresse:   u.adresse   || '',
          telephone: u.telephone || '',
          roles:     currentRole
        });

        this.isLoading = false;
        this.cdr.detectChanges();
      })
      .catch(err => {
        console.error('[UserForm] Erreur chargement utilisateur:', err);
        this.errorMessage = 'Impossible de charger les données de l\'utilisateur.';
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.value;

    // Toujours envoyer roles comme tableau de strings
    const payload: any = {
      nomprenom: raw.nomprenom,
      email:     raw.email,
      adresse:   raw.adresse,
      telephone: raw.telephone,
      roles:     [raw.roles]  // ex: ["Administrateur"]
    };

    const url = this.isEdit
      ? `${this.apiBase}/admin/users/${this.userId}`
      : `${this.apiBase}/admin/users`;

    const method = this.isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('[UserForm] Erreur serveur:', err);
          this.errorMessage = err?.message || `Erreur serveur (${res.status})`;
          this.cdr.detectChanges();
          return;
        }
        this.router.navigate(['/admin']);
      })
      .catch(err => {
        console.error('[UserForm] Erreur fetch:', err);
        this.errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
        this.cdr.detectChanges();
      });
  }
}
