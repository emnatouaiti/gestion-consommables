import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AdminUsersService } from '../../../core/services/admin-users.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-archived-users',
  standalone: false,
  templateUrl: './archived-users.component.html',
  styleUrls: ['./archived-users.component.css']
})
export class ArchivedUsersComponent implements OnInit {
  users: any[] = [];
  q: string = '';
  isLoading = false;
  errorMessage = '';
  isBrowser: boolean;  // ← Ajout d'une propriete

  // Avatar modal
  avatarModalOpen = false;
  avatarModalUrl = '';
  avatarModalName = '';

  // Confirm modal
  confirmModalVisible = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmText = 'Confirmer';
  confirmModalCancelText = 'Annuler';
  confirmModalType: 'danger' | 'warning' | 'info' = 'warning';
  confirmModalAlertOnly = false;
  private pendingAction: (() => void) | null = null;

  constructor(
    private svc: AdminUsersService,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Determiner si on est dans le navigateur
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Si on est cote serveur, on initialise avec des valeurs par defaut
    // mais on ne fait pas d'appel API
    if (!this.isBrowser) {
      this.isLoading = false;
      this.users = [];
      return;
    }

    // Cote navigateur seulement : charger les donnees
    this.load();
  }

  load() {
    if (!this.isBrowser) return; // Securite supplementaire

    this.isLoading = true;
    this.errorMessage = '';

    // Forcer la detection de changements pour afficher le spinner
    this.cdr.detectChanges();

    const searchTerm = this.q && this.q.trim() !== '' ? this.q.trim() : undefined;

    this.svc.listArchived(searchTerm).subscribe({
      next: (res: any) => {
        console.log('Reponse API archives:', res); // Debug

        // Gestion plus robuste de la reponse
        if (res?.data?.data) {
          // Format pagination Laravel standard
          this.users = res.data.data;
        } else if (res?.data && Array.isArray(res.data)) {
          // Format simple { data: [...] }
          this.users = res.data;
        } else if (Array.isArray(res)) {
          // Format direct tableau
          this.users = res;
        } else if (res && typeof res === 'object') {
          // Chercher le premier tableau dans l'objet
          const firstArray = Object.values(res).find(v => Array.isArray(v));
          this.users = firstArray || [];
        } else {
          this.users = [];
        }

        this.isLoading = false;
        this.errorMessage = '';

        // Forcer la detection de changements
        this.cdr.detectChanges();

        console.log('Utilisateurs archives charges:', this.users.length);
      },
      error: (err: any) => {
        console.error('Erreur chargement archives:', err);

        this.isLoading = false;
        this.users = [];
        this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de charger les utilisateurs archives.');

        // Forcer la detection de changements
        this.cdr.detectChanges();
      }
    });
  }

  search() {
    if (!this.isBrowser) return;
    this.load();
  }

  resetSearch(): void {
    if (!this.isBrowser) return;
    this.q = '';
    this.load();
  }

  restore(id: any) {
    if (!this.isBrowser) return;

    this.openConfirmModal(
      'Restaurer l\'utilisateur',
      'Etes-vous sur de vouloir restaurer cet utilisateur ?',
      () => {
        this.svc.restore(id).subscribe({
          next: () => {
            this.load();
          },
          error: (err: any) => {
            console.error('Erreur restauration:', err);
            this.errorMessage = this.api.extractErrorMessage(err, 'Erreur lors de la restauration.');
            this.cdr.detectChanges();
          }
        });
      },
      'info',
      'Restaurer'
    );
  }

  forceDelete(id: any) {
    if (!this.isBrowser) return;

    this.openConfirmModal(
      'Supprimer definitivement',
      'Supprimer definitivement cet utilisateur ? Cette action est irreversible.',
      () => {
        this.svc.forceDelete(id).subscribe({
          next: () => {
            this.load();
          },
          error: (err: any) => {
            console.error('Erreur suppression definitive:', err);
            this.errorMessage = this.api.extractErrorMessage(err, 'Erreur lors de la suppression.');
            this.cdr.detectChanges();
          }
        });
      },
      'danger',
      'Supprimer definitivement'
    );
  }

  /* --- Confirm Modal helpers --- */

  private openConfirmModal(title: string, message: string, action: () => void, type: 'danger' | 'warning' | 'info' = 'warning', confirmText = 'Confirmer'): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalConfirmText = confirmText;
    this.confirmModalType = type;
    this.confirmModalAlertOnly = false;
    this.pendingAction = action;
    this.confirmModalVisible = true;
    this.cdr.detectChanges();
  }

  onConfirmModalConfirmed(): void {
    this.confirmModalVisible = false;
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }

  roleNames(u: any): string {
    return (u.roles || []).map((r: any) => r.name).join(', ');
  }

  photoUrl(path: string | null | undefined): string {
    if (!path) return 'assets/default-avatar.svg';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/+/, '').replace(/^storage\//, '');
    return `/api/docs/${cleanPath}`;
  }

  onImageError(event: any): void {
    event.target.src = 'assets/default-avatar.svg';
  }

  /* --- Avatar Modal --- */
  openAvatarModal(u: any): void {
    if (!this.isBrowser) return;
    this.avatarModalUrl = this.photoUrl(u.photo || u.avatar);
    this.avatarModalName = u.nomprenom || '';
    this.avatarModalOpen = true;
    this.cdr.detectChanges();
  }

  closeAvatarModal(): void {
    if (!this.isBrowser) return;
    this.avatarModalOpen = false;
    this.cdr.detectChanges();
  }
}
