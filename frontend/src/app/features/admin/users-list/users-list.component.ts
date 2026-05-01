import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AdminUsersService } from '../services/admin-users.service';

@Component({
  selector: 'app-users-list',
  standalone: false,
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {
  users: any[] = [];
  q: string = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Modal properties
  showModal = false;
  editingId: number | null = null;
  roles: any[] = [];
  selectedServiceFilter = '';
  selectedRoleFilter = '';
  selectedSiegeFilter = '';
  siegeOptions: string[] = [
    'Charguia_II_Ariana',
    'Mohamed_V_Tunis',
    'Kheireddine_Pacha_Tunis'
  ];
  serviceOptions: string[] = [
    'Direction Financiere',
    'Direction Informatique',
    'Direction Operations',
    'Direction RH',
    'Direction Logistique'
  ];
  private readonly servicePosteMap: Record<string, string[]> = {
    'Direction Financiere': [
      'Comptable',
      'Controleur de gestion',
      'Responsable RH'
    ],
    'Direction Informatique': [
      'Developpeur',
      'Analyste donnees'
    ],
    'Direction Operations': [
      'Ingenieur petrolier',
      'Technicien maintenance',
      'Superviseur de production'
    ],
    'Direction RH': [
      'Responsable RH',
      'Comptable'
    ],
    'Direction Logistique': [
      'Technicien maintenance',
      'Superviseur de production'
    ]
  };

  form = {
    nomprenom: '',
    email: '',
    adresse: '',
    telephone: '',
    service: '',
    poste: '',
    roles: '',
    siege: ''
  };

  // Avatar modal
  avatarModalOpen = false;
  avatarModalUrl = '';
  avatarModalName = '';

  private readonly apiBase = '/api';

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private usersService: AdminUsersService
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.q = this.route.snapshot.queryParams['q'] || '';
    this.loadRoles();
    this.load();

    this.route.queryParams.subscribe(params => {
      const newQ = params['q'] || '';
      if (newQ !== this.q) {
        this.q = newQ;
        this.load();
      }
    });
  }

  private loadRoles(): void {
    this.usersService.roles().subscribe({
      next: (res: any) => {
        this.roles = Array.isArray(res) ? res : (res?.data ?? []);
        this.ensureRoleMatchesService();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement roles:', err);
      }
    });
  }

  photoUrl(path: string | null | undefined): string {
    if (!path) return 'assets/default-avatar.svg';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/+/, '');
    return `http://localhost:8000/storage/${cleanPath}`;
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';

    this.usersService.list(this.q || null, 20, 'active').subscribe({
      next: (res: any) => {
        if (res?.data && Array.isArray(res.data)) {
          this.users = res.data;
        } else if (Array.isArray(res)) {
          this.users = res;
        } else {
          this.users = [];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'Impossible de charger la liste.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  search(): void {
    this.load();
  }

  /* --- Modal Utilisateur --- */

  openAddModal(): void {
    this.resetForm();
    this.editingId = null;
    this.showModal = true;
  }

  openEditModal(user: any): void {
    this.editingId = user.id;
    this.form = {
      nomprenom: user.nomprenom || '',
      email: user.email || '',
      adresse: user.adresse || '',
      telephone: user.telephone || '',
      service: user.service || '',
      poste: user.poste || '',
      siege: user.siege || '',
      roles: user.roles?.[0]?.name || user.role || ''
    };
    this.showModal = true;
    this.ensureRoleMatchesService();
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { nomprenom: '', email: '', adresse: '', telephone: '', service: '', poste: '', siege: '', roles: '' };
    this.errorMessage = '';
  }

  get filteredRoles(): string[] {
    return this.roles.map((r: any) => String(r?.name || r)).filter(Boolean);
  }

  get availablePostes(): string[] {
    return this.servicePosteMap[this.form.service] || [];
  }

  get serviceFilterOptions(): string[] {
    const fromData = this.users
      .map((u) => String(u?.service || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...this.serviceOptions, ...fromData]));
  }

  get roleFilterOptions(): string[] {
    const fromData = this.users
      .flatMap((u) => (u?.roles || []).map((r: any) => String(r?.name || r).trim()))
      .filter(Boolean);
    const fromLegacy = this.users
      .map((u) => String(u?.role || '').trim())
      .filter(Boolean);
    const base = this.roles.map((r: any) => String(r?.name || r).trim()).filter(Boolean);
    return Array.from(new Set([...base, ...fromData, ...fromLegacy]));
  }

  get siegeFilterOptions(): string[] {
    const fromData = this.users
      .map((u) => String(u?.siege || '').trim())
      .filter(Boolean);
    return Array.from(new Set(fromData));
  }
  get displayedUsers(): any[] {
    return this.users.filter((u) => {
      const serviceOk = !this.selectedServiceFilter || String(u?.service || '').toLowerCase() === this.selectedServiceFilter.toLowerCase();
      if (!serviceOk) {
        return false;
      }

      const siegeOk = !this.selectedSiegeFilter || String(u?.siege || '').toLowerCase() === this.selectedSiegeFilter.toLowerCase();
      if (!siegeOk) {
        return false;
      }

      if (!this.selectedRoleFilter) {
        return true;
      }

      const userRoles = (u?.roles || []).map((r: any) => String(r?.name || r).toLowerCase());
      const legacyRole = String(u?.role || '').toLowerCase();
      const wanted = this.selectedRoleFilter.toLowerCase();
      return userRoles.includes(wanted) || legacyRole === wanted;
    });
  }

  onServiceChange(): void {
    if (!this.availablePostes.includes(this.form.poste)) {
      this.form.poste = '';
    }
    this.ensureRoleMatchesService();
  }

  private ensureRoleMatchesService(): void {
    // Tous les rôles sont permis
  }



  save(): void {
    if (!this.form.nomprenom || !this.form.email || !this.form.roles) {
      this.errorMessage = 'Nom, email et role sont obligatoires.';
      return;
    }

    const payload: any = {
      nomprenom: (this.form.nomprenom || '').trim(),
      email: (this.form.email || '').trim(),
      adresse: (this.form.adresse || '').trim(),
      telephone: (this.form.telephone || '').trim(),
      service: (this.form.service || '').trim(),
      poste: (this.form.poste || '').trim(),
      siege: (this.form.siege || '').trim(),
      roles: [this.form.roles]
    };

    this.errorMessage = '';

    const req$ = this.editingId
      ? this.usersService.update(this.editingId, payload)
      : this.usersService.create(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Utilisateur mis a jour !' : 'Utilisateur cree !';
        this.closeModal();
        this.load();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || 'Erreur de sauvegarde.';
        this.cdr.detectChanges();
      }
    });
  }

  remove(id: any): void {
    if (!confirm('Archiver cet utilisateur ?')) return;

    this.usersService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Utilisateur archive !';
        this.load();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || "Impossible d'archiver cet utilisateur.";
        this.cdr.detectChanges();
      }
    });
  }

  resetFilters(): void {
    this.selectedServiceFilter = '';
    this.selectedRoleFilter = '';
    this.selectedSiegeFilter = '';
    this.cdr.detectChanges();
  }

  roleNames(u: any): string {
    return (u.roles || []).map((r: any) => r.name).join(', ');
  }

  /* --- Avatar Modal --- */

  openAvatarModal(u: any): void {
    this.avatarModalUrl = this.photoUrl(u.photo || u.avatar);
    this.avatarModalName = u.nomprenom || '';
    this.avatarModalOpen = true;
    this.cdr.detectChanges();
  }

  closeAvatarModal(): void {
    this.avatarModalOpen = false;
    this.cdr.detectChanges();
  }
}
