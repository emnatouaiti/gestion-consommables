import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AdminUsersService } from '../services/admin-users.service';

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
  isBrowser: boolean;  // ← Ajout d'une propriété

  constructor(
    private svc: AdminUsersService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Déterminer si on est dans le navigateur
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Si on est côté serveur, on initialise avec des valeurs par défaut
    // mais on ne fait pas d'appel API
    if (!this.isBrowser) {
      this.isLoading = false;
      this.users = [];
      return;
    }

    // Côté navigateur seulement : charger les données
    this.load();
  }

  load() {
    if (!this.isBrowser) return; // Sécurité supplémentaire

    this.isLoading = true;
    this.errorMessage = '';

    // Forcer la détection de changements pour afficher le spinner
    this.cdr.detectChanges();

    const searchTerm = this.q && this.q.trim() !== '' ? this.q.trim() : undefined;

    this.svc.listArchived(searchTerm).subscribe({
      next: (res: any) => {
        console.log('Réponse API archives:', res); // Debug

        // Gestion plus robuste de la réponse
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

        // Forcer la détection de changements
        this.cdr.detectChanges();

        console.log('Utilisateurs archivés chargés:', this.users.length);
      },
      error: (err: any) => {
        console.error('Erreur chargement archives:', err);

        this.isLoading = false;
        this.users = [];
        this.errorMessage = err?.message || 'Impossible de charger les utilisateurs archivés.';

        // Forcer la détection de changements
        this.cdr.detectChanges();
      }
    });
  }

  search() {
    if (!this.isBrowser) return;
    this.load();
  }

  restore(id: any) {
    if (!this.isBrowser) return;
    if (!confirm('Restaurer cet utilisateur ?')) return;

    this.svc.restore(id).subscribe({
      next: () => {
        this.load();
      },
      error: (err) => {
        console.error('Erreur restauration:', err);
        this.errorMessage = 'Erreur lors de la restauration.';
        this.cdr.detectChanges();
      }
    });
  }

  forceDelete(id: any) {
    if (!this.isBrowser) return;
    if (!confirm('Supprimer définitivement cet utilisateur ? Cette action est irréversible.')) return;

    this.svc.forceDelete(id).subscribe({
      next: () => {
        this.load();
      },
      error: (err) => {
        console.error('Erreur suppression définitive:', err);
        this.errorMessage = 'Erreur lors de la suppression.';
        this.cdr.detectChanges();
      }
    });
  }

  roleNames(u: any): string {
    return (u.roles || []).map((r: any) => r.name).join(', ');
  }
}
