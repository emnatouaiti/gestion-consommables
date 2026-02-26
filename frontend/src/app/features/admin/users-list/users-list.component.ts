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

  form = {
    nomprenom: '',
    email: '',
    adresse: '',
    telephone: '',
    roles: ''
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement rôles:', err);
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

  /* ─── Modal Utilisateur ─── */

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
      roles: user.roles?.[0]?.name || user.role || ''
    };
    this.showModal = true;
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
    this.form = { nomprenom: '', email: '', adresse: '', telephone: '', roles: '' };
    this.errorMessage = '';
  }



  save(): void {
    if (!this.form.nomprenom || !this.form.email || !this.form.roles) {
      this.errorMessage = 'Nom, email et rôle sont obligatoires.';
      return;
    }

    const payload: any = {
      nomprenom: (this.form.nomprenom || '').trim(),
      email: (this.form.email || '').trim(),
      adresse: (this.form.adresse || '').trim(),
      telephone: (this.form.telephone || '').trim(),
      roles: [this.form.roles]
    };

    this.errorMessage = '';

    const req$ = this.editingId
      ? this.usersService.update(this.editingId, payload)
      : this.usersService.create(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Utilisateur mis à jour !' : 'Utilisateur créé !';
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
        this.successMessage = 'Utilisateur archivé !';
        this.load();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || "Impossible d'archiver cet utilisateur.";
        this.cdr.detectChanges();
      }
    });
  }

  roleNames(u: any): string {
    return (u.roles || []).map((r: any) => r.name).join(', ');
  }

  /* ─── Avatar Modal ─── */

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
