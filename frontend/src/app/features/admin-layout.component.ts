import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';
import { ChatService } from '../core/services/chat.service';
import { ChatStateService } from '../core/services/chat-state.service';
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
  private notificationPollTimer: any = null;
  miniChatOpen = false;

  private deferViewSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

    get userPhotoUrl(): string | null {
    const raw = this.user?.photo || this.user?.avatar;
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    const photo = raw.trim();
    if (!photo) {
      return null;
    }

    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      return photo;
    }

    if (photo.startsWith('/')) {
      return photo;
    }

    return `/storage/${photo}`;
  }
get userInitials(): string {
    const name = (this.userDisplayName || '').trim();
    if (!name) {
      return 'U';
    }

    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private readonly adminSections: NavSection[] = [
    {
      title: 'Pilotage',
      items: [
        { label: 'Tableau de bord', route: '/dashboard', exact: true }
      ]
    },
    {
      title: 'Administration',
      items: [
        { label: 'Utilisateurs', route: '/users' },
        { label: 'Archives Utilisateurs', route: '/archived' },
      ]
    },
    {
      title: 'Compte',
      items: [
        { label: 'Mon Profil', route: '/profile' }
      ]
    }
  ];

  private readonly managerSections: NavSection[] = [
    {
      title: "Tableau de bord",
      items: [
        { label: "Tableau de bord", route: "/dashboard" }
      ]
    },
    {
        title: 'Catalogue & Depots',
      items: [
        { label: 'Categories', route: '/gerer-categories' },
        { label: 'Unites', route: '/gerer-unites' },
        { label: 'Produits', route: '/gerer-produits' },
        { label: 'References', route: '/gerer-references' },
        { label: 'Depots', route: '/gerer-depots' },
        // 'Locaux' hidden for Responsable de stock
      ]
    },
    {
      title: 'Operations',
      items: [
        { label: 'Valider demandes', route: '/validation-demandes' },
        { label: 'Mouvements Stock', route: '/mouvements-stock' },
        { label: 'Import OCR', route: '/documents-ocr' },
        { label: 'Fournisseurs (Avis)', route: '/gerer-fournisseurs' }
      ]
    },
    {
      title: 'Compte',
      items: [
        { label: 'Mon Profil', route: '/profile' }
      ]
    }
  ];

  private readonly agentSections: NavSection[] = [
    {
      title: "Tableau de bord",
      items: [
        { label: "Tableau de bord", route: "/dashboard" }
      ]
    },
    {
      title: 'Operations',
      items: [
        { label: 'Catalogue', route: '/gerer-produits' },
        { label: 'Depots', route: '/gerer-depots' },
        { label: 'References', route: '/gerer-references' },
        { label: 'Mouvements Stock', route: '/mouvements-stock' },
        { label: 'Import OCR', route: '/documents-ocr' },
        { label: 'Fournisseurs (Avis)', route: '/gerer-fournisseurs' }
      ]
    },
    {
      title: 'Compte',
      items: [
        { label: 'Mon Profil', route: '/profile' }
      ]
    }
  ];

  private readonly directorSections: NavSection[] = [
    {
      title: 'Direction',
      items: [
        { label: 'Tableau de bord', route: '/dashboard' },
        { label: 'Valider demandes', route: '/validation-demandes', badge: 'Action' },
        { label: 'Mes Demandes', route: '/demandes-consommables', exact: true }
      ]
    },
    {
      title: 'Mon Compte',
      items: [
        { label: 'Mon Profil', route: '/profile' }
      ]
    }
  ];

  private readonly userSections: NavSection[] = [
    {
      title: "Tableau de bord",
      items: [
        { label: "Tableau de bord", route: "/dashboard" }
      ]
    },
    {
      title: 'Espace Employe',
      items: [
        { label: 'Mes Demandes', route: '/demandes-consommables', exact: true }
      ]
    },
    {
      title: 'Compte',
      items: [
        { label: 'Mon Profil', route: '/profile' }
      ]
    }
  ];

  private readonly fallbackSections: NavSection[] = [
    {
      title: 'Navigation',
      items: [
        { label: 'Mon Profil', route: '/profile' }
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
          this.initNotificationsIfAllowed();
          this.deferViewSync();
          this.redirectAdminRootToFirstMenu();
        }
      });
    } else {
      this.initNotificationsIfAllowed();
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
    if (this.notificationPollTimer) {
      clearInterval(this.notificationPollTimer);
      this.notificationPollTimer = null;
    }
  }

  get canUseNotifications(): boolean {
    return !this.authService.userHasAnyRole(this.user, ['Administrateur']);
  }

  get navSections(): NavSection[] {
    if (this.authService.userHasAnyRole(this.user, ['Administrateur'])) {
      return this.adminSections;
    }

    if (this.authService.userHasAnyRole(this.user, ['Directeur', 'Validateur'])) {
      return this.directorSections;
    }

    if (this.authService.userHasAnyRole(this.user, ['Responsable de stock', 'Responsable', 'Gestionnaire'])) {
      return this.managerSections;
    }

    if (this.authService.userHasAnyRole(this.user, ['Agent de stock', 'Agent'])) {
      return this.agentSections;
    }

    if (this.authService.userHasAnyRole(this.user, ['Utilisateur', 'Employe'])) {
      return this.userSections;
    }

    return this.fallbackSections;
  }

  get pageBreadcrumb(): string {
    if (this.authService.userHasAnyRole(this.user, ['Administrateur'])) {
      return 'Administration';
    }

    if (this.authService.userHasAnyRole(this.user, ['Directeur', 'Validateur'])) {
      return 'Direction';
    }

    if (this.authService.userHasAnyRole(this.user, ['Responsable de stock', 'Responsable', 'Gestionnaire'])) {
      return 'Gestion de Stock';
    }

    if (this.authService.userHasAnyRole(this.user, ['Agent de stock', 'Agent'])) {
      return 'Operations Stock';
    }

    if (this.authService.userHasAnyRole(this.user, ['Utilisateur', 'Employe'])) {
      return 'Espace Employe';
    }

    return 'Portail';
  }

  get userDisplayName(): string {
    return this.user?.nomprenom || this.user?.name || 'Utilisateur';
  }

  get userRoleLabel(): string {
    const roles = this.authService.getUserRoles(this.user);
    return roles.length ? roles[0].toUpperCase() : 'UTILISATEUR';
  }

  logout() {
    this.authService.logout();
  }

  openChat(): void {
    this.router.navigate(['/chat']);
  }

  toggleMiniChat(): void {
    // retour au comportement initial : ouvrir la page chat
    this.router.navigate(['/chat']);
  }

  doSearch() {
    this.router.navigate(['/users'], { queryParams: { q: (this.q || '').trim() } });
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
        this.deferViewSync();
      },
      error: () => {
        this.notifications = [];
        this.notificationsLoading = false;
        this.deferViewSync();
      }
    });

    this.markNotificationsRead();
  }

  markNotificationsRead(): void {
    this.apiService.put('notifications/read-all', {}).subscribe({
      next: () => {
        this.notifCount = 0;
        this.deferViewSync();
      }
    });
  }

  notificationLabel(notification: any): string {
    const data = notification?.data || {};
    if (data?.type === 'capacity_alert') {
      return (data.title || 'Alerte Capacite') + ': ' + (data.message || 'Espace sature');
    }
    if (data?.type === 'stock_movement') {
      return (data.title || 'Mouvement') + ': ' + (data.message || data.reference);
    }
    const item = data?.item_name || 'Article';
    const qty = data?.requested_quantity;
    return (qty && qty !== '-') ? `${item} (${qty})` : item;
  }

  onNotificationClick(notification: any): void {
    const data = notification?.data || {};
    const requestId = data?.consumable_request_id || data?.request_id;
    const movementId = data?.movement_id;
    let target = this.resolveNotificationTarget(data);
    this.notificationsOpen = false;

    if (requestId) {
      this.router.navigate([target], { queryParams: { request_id: requestId } });
      return;
    }

    if (movementId && target === '/validation-mouvements') {
      this.router.navigate(['/mouvements-stock'], { queryParams: { status: 'pending_validation', id: movementId } });
      return;
    }

    this.router.navigateByUrl(target);
  }

  private resolveNotificationTarget(data: any): string {
    // Always use role-based routing for consumable requests
    if (data?.consumable_request_id || data?.request_id) {
      return this.authService.userHasAnyRole(this.user, ['Directeur', 'Validateur', 'Administrateur'])
        ? '/validation-demandes'
        : '/demandes-consommables';
    }

    if (data?.movement_id) {
      return '/mouvements-stock';
    }

    const rawTarget = String(data?.action_url || data?.url || '').trim();
    if (!rawTarget || rawTarget === 'null' || rawTarget === 'undefined' || rawTarget === '/') {
      return '/dashboard';
    }

    if (rawTarget.startsWith('/')) {
      return rawTarget;
    }

    try {
      const parsed = new URL(rawTarget);
      const path = parsed.pathname + (parsed.search || '');
      if (path && path !== '/') return path;
    } catch {
      // ignore
    }

    return '/dashboard';
  }
  private redirectAdminRootToFirstMenu(): void {
    const isAdminRoot = this.router.url === '' || this.router.url === '/';
    if (!isAdminRoot) return;

    const firstRoute = this.navSections[0]?.items[0]?.route;
    if (firstRoute) {
      this.router.navigateByUrl(firstRoute);
    }
  }

  private loadUnreadNotifications(): void {
    this.apiService.get('notifications/unread-count').subscribe({
      next: (res) => {
        this.notifCount = Number(res?.count || 0);
        this.deferViewSync();
      },
      error: () => {
        this.notifCount = 0;
      }
    });
  }

  private initNotificationsIfAllowed(): void {
    if (!this.canUseNotifications) {
      this.notifCount = 0;
      return;
    }

    this.loadUnreadNotifications();
    if (!this.notificationPollTimer && isPlatformBrowser(this.platformId)) {
      this.notificationPollTimer = setInterval(() => this.loadUnreadNotifications(), 300000);
    }
  }

  private startChatBadge(): void {
    this.chatSub?.unsubscribe();
    this.chatSub = this.chatService.pollConversations(7000).subscribe({
      next: (convs: any[]) => {
        const arr = Array.isArray(convs) ? convs : [];
        this.chatUnread = arr.reduce((sum, c: any) => sum + Number(c?.unread || 0), 0);
        this.deferViewSync();
      },
      error: () => { this.chatUnread = 0; }
    });
  }
}

