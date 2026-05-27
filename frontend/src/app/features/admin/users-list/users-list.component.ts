import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AdminUsersService } from '../services/admin-users.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-users-list',
  standalone: false,
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css'],
  providers: [AdminUsersService]
})
export class UsersListComponent implements OnInit {
  // Liste des utilisateurs et gestion des rôles
  users: any[] = [];
  q: string = '';
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  // Modal properties
  showModal = false;
  editingId: number | null = null;
  roles: any[] = [];
  selectedServiceFilter = '';
  selectedRoleFilter = '';
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
    siege: '',
    depot_id: null
  };

  depots: any[] = [];
  selectedRole: string = '';

  // Avatar modal
  avatarModalOpen = false;
  avatarModalUrl = '';
  avatarModalName = '';

  private readonly apiBase = '/api';

  constructor(
    private usersService: AdminUsersService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.q = this.route.snapshot.queryParams['q'] || '';
    this.loadRoles();
    this.loadDepots();
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

  private async loadDepots(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBase}/warehouses/list`, { headers: this.getHeaders() });
      const data = await res.json();
      const warehouses = Array.isArray(data) ? data : (data?.data ?? []);
      this.depots = warehouses.filter((w: any) => !w.kind || w.kind === 'depot');
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Erreur chargement dépôts:', err);
    }
  }

  private getHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  onRoleChange(): void {
    this.selectedRole = this.form.roles;
    this.updateFieldVisibility();
    this.cdr.detectChanges();
  }

  get isDirecteurRestricted(): boolean {
    const user = this.getCurrentUser();
    const hasSiege = user?.siege && user.siege !== 'Non defini';
    const roles = this.authService.getUserRoles(user);
    const isRestrictedRole = roles.includes('directeur');
    return isRestrictedRole && !!hasSiege;
  }

  get currentUserSiege(): string {
    return this.getCurrentUser()?.siege || '';
  }

  isStorageRole(role: any): boolean {
    const r = String(role || '').toLowerCase();
    return ['responsable', 'agent', 'responsable de stock', 'agent de stock'].includes(r);
  }

  isAdministrativeRole(role: any): boolean {
    const r = String(role || '').toLowerCase();
    return ['administrateur', 'directeur', 'validateur'].includes(r);
  }

  updateFieldVisibility(): void {
    // La logique d'affichage est gérée dans le template avec les helpers
  }

  photoUrl(path: string | null | undefined): string {
    if (!path) return 'assets/default-avatar.svg';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/+/, '').replace(/^storage\//, '');
    return `/api/docs/${cleanPath}`;
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
    this.currentPage = 1;
    this.load();
  }

  resetSearch(): void {
    this.q = '';
    this.currentPage = 1;
    this.load();
  }

  /* --- Modal Utilisateur --- */

  openAddModal(): void {
    this.resetForm();
    this.editingId = null;
    
    // Default to current user's siege
    const currentUser = this.getCurrentUser();
    if (currentUser?.siege) {
      this.form.siege = currentUser.siege;
    }
    
    this.showModal = true;
    this.cdr.detectChanges(); // Force update to show pre-selected siege
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
      roles: user.roles?.[0]?.name || user.role || '',
      depot_id: user.depot_id || null
    };
    this.selectedRole = this.form.roles;
    this.showModal = true;
    this.ensureRoleMatchesService();
    this.cdr.detectChanges();
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
    this.form = { nomprenom: '', email: '', adresse: '', telephone: '', service: '', poste: '', siege: '', roles: '', depot_id: null };
    this.selectedRole = '';
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

  get displayedUsers(): any[] {
    // Récupérer le rôle de l'utilisateur connecté
    const currentUser = this.getCurrentUser();
    const userRole = currentUser?.role || '';
    const userSiege = currentUser?.siege || '';

    return this.users.filter((u) => {
      // Pour les Administrateurs et Directeurs : ne montrer que les users de son siège
      if (this.isDirecteurRestricted) {
        const userSiege = this.currentUserSiege;
        const isStorageRole = this.isStorageRole(u.role);
        
        if (!isStorageRole && u.siege !== userSiege) {
          return false;
        }
        
        // Exclure les autres de même niveau (un siège n'a qu'un seul responsable de ce type)
        if (!isStorageRole && (u.role === 'Administrateur' || u.role === 'Directeur') && u.id !== currentUser?.id) {
          return false;
        }
      }

      const serviceOk = !this.selectedServiceFilter || String(u?.service || '').toLowerCase() === this.selectedServiceFilter.toLowerCase();
      if (!serviceOk) {
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

  private getCurrentUser(): any {
    return this.authService.getCurrentUserSnapshot();
  }

  // Pagination
  pageSize: number = 10;
  currentPage: number = 1;

  get paginatedUsers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.displayedUsers.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.displayedUsers.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
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
    if (this.isSaving) return;

    if (!this.form.nomprenom || !this.form.email || !this.form.roles) {
      this.errorMessage = 'Nom, email et role sont obligatoires.';
      return;
    }

    // Pour Responsable/Agent, depot_id est obligatoire
    const needsDepot = this.isStorageRole(this.form.roles);
    if (needsDepot && !this.form.depot_id) {
      this.errorMessage = 'Le dépôt est obligatoire pour les responsables et agents.';
      return;
    }

    // Pour Administrateur, siege est obligatoire
    if (this.form.roles === 'Administrateur' && !this.form.siege) {
      this.errorMessage = 'Le siège est obligatoire pour les administrateurs.';
      return;
    }

    // Vérifier qu'il n'y a qu'un seul admin par siège
    if (this.form.roles === 'Administrateur' && this.form.siege) {
      const existingAdmin = this.users.find(u =>
        u.role === 'Administrateur' &&
        u.siege === this.form.siege &&
        u.id !== this.editingId
      );
      if (existingAdmin) {
        this.errorMessage = `Un administrateur existe déjà pour le siège ${this.form.siege}.`;
        return;
      }
    }

    const payload: any = {
      nomprenom: (this.form.nomprenom || '').trim(),
      email: (this.form.email || '').trim(),
      adresse: (this.form.adresse || '').trim(),
      telephone: (this.form.telephone || '').trim(),
      service: needsDepot ? '' : (this.form.service || '').trim(),
      poste: needsDepot ? '' : (this.form.poste || '').trim(),
      siege: this.form.siege || '',
      depot_id: needsDepot ? this.form.depot_id : null,
      roles: [this.form.roles]
    };

    this.errorMessage = '';
    this.isSaving = true;

    const req$ = this.editingId
      ? this.usersService.update(this.editingId, payload)
      : this.usersService.create(payload);

    req$.subscribe({
      next: () => {
        this.isSaving = false;
        this.successMessage = this.editingId ? 'Utilisateur mis a jour !' : 'Utilisateur cree !';
        this.closeModal();
        this.load();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = this.api.extractErrorMessage(err, 'Erreur de sauvegarde.');
        this.cdr.detectChanges();
      }
    });
  }

  canDelete(user: any): boolean {
    // Cannot delete Administrateur users
    if (user.role === 'Administrateur') return false;
    // Also check roles array
    const roleNames = (user.roles || []).map((r: any) => r.name);
    if (roleNames.includes('Administrateur')) return false;
    return true;
  }

  remove(id: any, user?: any): void {
    // Check if user is an Admin
    if (user && !this.canDelete(user)) {
      this.errorMessage = 'Les administrateurs ne peuvent pas être archivés.';
      this.cdr.detectChanges();
      return;
    }

    if (!confirm('Archiver cet utilisateur ?')) return;

    this.usersService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Utilisateur archive !';
        this.load();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = this.api.extractErrorMessage(err, "Impossible d'archiver cet utilisateur.");
        this.cdr.detectChanges();
      }
    });
  }

  resetFilters(): void {
    this.selectedServiceFilter = '';
    this.selectedRoleFilter = '';
    this.currentPage = 1;
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

  onImageError(event: any): void {
    event.target.src = 'assets/default-avatar.svg';
  }
}
