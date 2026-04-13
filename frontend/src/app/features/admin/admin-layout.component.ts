import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ChatService } from '../../services/chat.service';
import { ChatStateService } from '../../services/chat-state.service';
import { Subscription } from 'rxjs';

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
export class AdminLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  q: string | null = null;
  user: any = null;
  notifCount = 0;
  notifications: any[] = [];
  notificationsOpen = false;
  notificationsLoading = false;
  chatUnread = 0;
  private chatSub?: Subscription;
  miniChatOpen = false;

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
          { label: 'Mouvements de stock', route: '/admin/mouvements-stock' },
        { label: 'Archives', route: '/admin/archived' },
        { label: 'Gerer categories', route: '/admin/gerer-categories' },
        { label: 'Gerer unites', route: '/admin/gerer-unites' },
        { label: 'Gerer produits', route: '/admin/gerer-produits' },
        { label: 'Gerer depots', route: '/admin/gerer-depots' },
        { label: 'Gerer locaux', route: '/admin/gerer-locaux' },
        { label: 'Gerer fournisseurs', route: '/admin/gerer-fournisseurs' },
        { label: 'Consulter le journal d audit', route: '/admin/journal-audit' },
        { label: 'Documents OCR', route: '/admin/documents-ocr' },
        { label: 'Chat interne', route: '/admin/chat' },
        { label: 'Mon Profil', route: '/admin/profile' }
      ]
    }
  ];

  private readonly directorSections: NavSection[] = [
    {
      title: 'Direction',
      items: [
        { label: 'Validation des demandes', route: '/admin/validation-demandes', exact: true, badge: 'Priorite' },
        { label: 'Consulter tableaux de bord', route: '/admin/dashboard' },
        { label: 'Consulter anomalies critiques', route: '/admin/anomalies-critiques' },
        { label: 'Consulter previsions', route: '/admin/previsions' },
        { label: 'Chat interne', route: '/admin/chat' }
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
      title: 'Operations',
      items: [
        { label: 'Demandes consommables', route: '/admin/demandes-consommables', exact: true },
        { label: 'Mouvements de stock', route: '/admin/mouvements-stock' },
        { label: 'Gerer produits', route: '/admin/gerer-produits' },
        { label: 'Gerer fournisseurs', route: '/admin/gerer-fournisseurs' },
        { label: 'Chat interne', route: '/admin/chat' }
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
        { label: 'Demandes consommables', route: '/admin/demandes-consommables', exact: true },
        { label: 'Tableau de bord', route: '/admin/dashboard' },
        { label: 'Chat interne', route: '/admin/chat' }
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
    private apiService: ApiService,
    private router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly chatService: ChatService,
    private readonly chatState: ChatStateService,
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
          this.loadUnreadNotifications();
          this.cdr.detectChanges();
          this.redirectAdminRootToFirstMenu();
        }
      });
    } else {
      this.loadUnreadNotifications();
    }

    this.redirectAdminRootToFirstMenu();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.startChatBadge(), 0);
    }
  }

  ngOnDestroy(): void {
    this.chatSub?.unsubscribe();
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
      return 'Operations';
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

  openChat(): void {
    this.router.navigate(['/admin/chat']);
  }

  toggleMiniChat(): void {
    // retour au comportement initial : ouvrir la page chat
    this.router.navigate(['/admin/chat']);
  }

  doSearch() {
    this.router.navigate(['/admin/users'], { queryParams: { q: (this.q || '').trim() } });
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    if (!this.notificationsOpen) {
      return;
    }

    this.notificationsLoading = true;
    this.apiService.get('notifications').subscribe({
      next: (res) => {
        this.notifications = Array.isArray(res) ? res : [];
        this.notificationsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notifications = [];
        this.notificationsLoading = false;
        this.cdr.detectChanges();
      }
    });

    this.markNotificationsRead();
  }

  markNotificationsRead(): void {
    this.apiService.put('notifications/read-all', {}).subscribe({
      next: () => {
        this.notifCount = 0;
        this.cdr.detectChanges();
      }
    });
  }

  notificationLabel(notification: any): string {
    const data = notification?.data || {};
    const item = data?.item_name || 'Article';
    const qty = data?.requested_quantity ?? '-';
    return `${item} (${qty})`;
  }

  onNotificationClick(notification: any): void {
    const requestId = notification?.data?.consumable_request_id;
    const target = notification?.data?.url || '/admin/validation-demandes';
    this.notificationsOpen = false;

    if (requestId) {
      this.router.navigate([target], { queryParams: { request_id: requestId } });
      return;
    }

    this.router.navigate([target]);
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

  private loadUnreadNotifications(): void {
    this.apiService.get('notifications/unread-count').subscribe({
      next: (res) => {
        this.notifCount = Number(res?.count || 0);
        this.cdr.detectChanges();
      },
      error: () => {
        this.notifCount = 0;
      }
    });
  }

  private startChatBadge(): void {
    this.chatSub?.unsubscribe();
    this.chatSub = this.chatService.pollConversations(7000).subscribe({
      next: (convs: any[]) => {
        const arr = Array.isArray(convs) ? convs : [];
        this.chatUnread = arr.reduce((sum, c: any) => sum + Number(c?.unread || 0), 0);
        this.cdr.detectChanges();
      },
      error: () => { this.chatUnread = 0; }
    });
  }
}
