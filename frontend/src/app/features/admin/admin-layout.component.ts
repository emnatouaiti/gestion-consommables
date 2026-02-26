import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  exact?: boolean;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-admin-layout',
  standalone: false,
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit {
  q: string | null = null;
  user: any = null;

  private readonly adminSections: NavSection[] = [
    {
      title: 'Pilotage',
      items: [
        { label: 'Tableau de bord', route: '/admin/dashboard', exact: true, badge: 'Live' }
      ]
    },
    {
      title: 'Administration',
      items: [
        { label: 'Utilisateurs', route: '/admin/users', exact: true },
        { label: 'Archivés', route: '/admin/archived' },
        { label: 'Gérer catégories', route: '/admin/gerer-categories' },
        { label: 'Gérer unités', route: '/admin/gerer-unites' },
        { label: 'Gérer produits', route: '/admin/gerer-produits' },
        { label: 'Gérer dépôts', route: '/admin/gerer-depots' },
        { label: 'Gérer fournisseurs', route: '/admin/gerer-fournisseurs' },

        { label: 'Mon Profil', route: '/admin/profile' }
      ]
    }
  ];

  private readonly directorSections: NavSection[] = [
    {
      title: 'Direction',
      items: [
        { label: 'Validation des demandes', route: '/admin/validation-demandes', exact: true, badge: 'Priorité' },
        { label: 'Consulter tableaux de bord', route: '/admin/dashboard' },
        { label: 'Consulter anomalies critiques', route: '/admin/anomalies-critiques' },
        { label: 'Consulter prévisions', route: '/admin/previsions' }
      ]
    },
    {
      title: 'Compte',
      items: [
        { label: 'Mon Profil', route: '/admin/profile' }
      ]
    }
  ];

  private readonly agentManagerSections: NavSection[] = [
    {
      title: 'Opérations',
      items: [
        { label: 'Gérer produits', route: '/admin/gerer-produits', exact: true },
        { label: 'Gérer fournisseurs', route: '/admin/gerer-fournisseurs' }
      ]
    },
    {
      title: 'Compte',
      items: [
        { label: 'Mon Profil', route: '/admin/profile' }
      ]
    }
  ];

  private readonly userSections: NavSection[] = [
    {
      title: 'Espace utilisateur',
      items: [
        { label: 'Mes demandes', route: '/admin/mes-demandes', exact: true },
        { label: 'Tableau de bord', route: '/admin/dashboard' }
      ]
    },
    {
      title: 'Compte',
      items: [
        { label: 'Mon Profil', route: '/admin/profile' }
      ]
    }
  ];

  private readonly fallbackSections: NavSection[] = [
    {
      title: 'Navigation',
      items: [
        { label: 'Tableau de bord', route: '/admin/dashboard', exact: true },
        { label: 'Mon Profil', route: '/admin/profile' }
      ]
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.user = this.authService.getCurrentUserSnapshot();

    if (!this.user) {
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.user = user;
          this.cdr.detectChanges();
          this.redirectAdminRootToFirstMenu();
        }
      });
    }

    this.redirectAdminRootToFirstMenu();
  }

  get navSections(): NavSection[] {
    if (this.authService.userHasAnyRole(this.user, ['Administrateur'])) {
      return this.adminSections;
    }

    if (this.authService.userHasAnyRole(this.user, ['Directeur', 'Validateur'])) {
      return this.directorSections;
    }

    if (this.authService.userHasAnyRole(this.user, ['Agent', 'Responsable', 'Gestionnaire'])) {
      return this.agentManagerSections;
    }

    if (this.authService.userHasAnyRole(this.user, ['Utilisateur'])) {
      return this.userSections;
    }

    return this.fallbackSections;
  }

  get pageBreadcrumb(): string {
    if (this.authService.userHasAnyRole(this.user, ['Directeur', 'Validateur'])) {
      return 'Direction';
    }

    if (this.authService.userHasAnyRole(this.user, ['Agent', 'Responsable', 'Gestionnaire'])) {
      return 'Opérations';
    }

    if (this.authService.userHasAnyRole(this.user, ['Utilisateur'])) {
      return 'Espace Utilisateur';
    }

    return 'Administration';
  }

  get userDisplayName(): string {
    return this.user?.nomprenom || this.user?.name || 'Utilisateur';
  }

  get userRoleLabel(): string {
    const roles = this.authService.getUserRoles(this.user);
    return roles.length ? roles[0].toUpperCase() : 'SESSION';
  }

  logout() {
    this.authService.logout();
  }

  doSearch() {
    this.router.navigate(['/admin/users'], { queryParams: { q: (this.q || '').trim() } });
  }

  private redirectAdminRootToFirstMenu(): void {
    const isAdminRoot = this.router.url === '/admin' || this.router.url === '/admin/';

    if (!isAdminRoot) {
      return;
    }

    const firstRoute = this.navSections[0]?.items[0]?.route;
    if (firstRoute) {
      this.router.navigateByUrl(firstRoute);
    }
  }
}
