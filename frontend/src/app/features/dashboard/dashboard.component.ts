import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { AdminStockService } from '../admin/services/admin-stock.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnInit {
  isLoading = true;
  isBrowser: boolean;
  user: any = null;

  // Statistiques
  stats = {
    totalUsers: 0,
    activeUsers: 0,
    archivedUsers: 0,
    newUsersThisMonth: 0,
    totalRoles: 0,
    adminCount: 0,
    lowStockAlerts: 0,
    totalProducts: 0,
    totalCategories: 0,
    totalWarehouses: 0,
    totalValue: 0
  };

  categoryStock: any[] = [];
  movementsTrend: any[] = [];

  // Données simulées
  recentActivities: any[] = [];
  recentUsers: any[] = [];
  roles: any[] = [];
  dashboardCards: Array<{ label: string; value: string | number; icon: string; color: string; route?: string; critical?: boolean }> = [];
  quickLinks: Array<{ label: string; route: string; icon: string }> = [];


  constructor(
    private authService: AuthService,
    private router: Router,
    private adminStockService: AdminStockService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.user = this.authService.currentUser();
      this.loadDashboardData();
    } else {
      this.isLoading = false;
    }
  }

  loadDashboardData() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.adminStockService.getDashboardStats().subscribe({
      next: (res: any) => {
        this.stats = res.stats;
        this.recentActivities = res.recentActivities;
        this.recentUsers = res.recentUsers;
        this.roles = res.roles;
        this.categoryStock = res.categoryStock;
        this.movementsTrend = res.movementsTrend;
        this.buildDashboardView();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur chargement dashboard:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  refreshData() {
    this.loadDashboardData();
  }

  get isAdmin(): boolean {
    return this.authService.userHasAnyRole(this.user, ['Administrateur']);
  }

  get isDirector(): boolean {
    return this.authService.userHasAnyRole(this.user, ['Directeur', 'Validateur']);
  }

  get isManager(): boolean {
    return this.authService.userHasAnyRole(this.user, ['Agent', 'Responsable', 'Gestionnaire']);
  }

  get dashboardBadge(): string {
    if (this.isAdmin) return 'Administration';
    if (this.isDirector) return 'Direction';
    if (this.isManager) return 'Operations';
    return 'Espace utilisateur';
  }

  get dashboardTitle(): string {
    if (this.isAdmin) return `Pilotage global, ${this.user?.nomprenom || 'Administrateur'}`;
    if (this.isDirector) return `Vue decisionnelle, ${this.user?.nomprenom || 'Direction'}`;
    if (this.isManager) return `Suivi operationnel, ${this.user?.nomprenom || 'Responsable'}`;
    return `Bienvenue, ${this.user?.nomprenom || 'Utilisateur'}`;
  }

  get dashboardDescription(): string {
    if (this.isAdmin) return 'Supervisez les utilisateurs, le stock, les depots et les journaux d audit sans passer par le menu de connexion.';
    if (this.isDirector) return 'Retrouvez les indicateurs de validation, les alertes de stock et les acces rapides utiles a la direction.';
    if (this.isManager) return 'Suivez les mouvements, les demandes et les points de stockage utiles a vos operations quotidiennes.';
    return 'Accedez rapidement a votre profil, a vos demandes et a la situation generale du stock.';
  }

  get sidePanelTitle(): string {
    if (this.isAdmin) return 'Utilisateurs recents';
    if (this.isDirector) return 'Points de vigilance';
    if (this.isManager) return 'Actions rapides';
    return 'Mon espace';
  }

  private buildDashboardView(): void {
    if (this.isAdmin) {
      this.dashboardCards = [
        { label: 'Produits', value: this.stats.totalProducts, icon: '📦', color: 'blue', route: '/admin/gerer-produits' },
        { label: 'Depots', value: this.stats.totalWarehouses, icon: '🏬', color: 'purple', route: '/admin/gerer-depots' },
        { label: 'Utilisateurs actifs', value: this.stats.activeUsers, icon: '👥', color: 'green', route: '/admin/users' },
        { label: 'Valeur du stock', value: `${this.stats.totalValue || 0} TND`, icon: '💰', color: 'yellow' },
      ];

      if (this.stats.lowStockAlerts > 0) {
        this.dashboardCards.push({
          label: 'Alertes stock bas',
          value: this.stats.lowStockAlerts,
          icon: '⚠️',
          color: 'red',
          route: '/admin/gerer-produits',
          critical: true
        });
      }

      this.quickLinks = [
        { label: 'Mon profil', route: '/admin/profile', icon: '👤' },
        { label: 'Journal audit', route: '/admin/journal-audit', icon: '🧾' },
        { label: 'Documents OCR', route: '/admin/documents-ocr', icon: '📄' },
        { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
      ];
      return;
    }

    if (this.isDirector) {
      this.dashboardCards = [
        { label: 'Alertes stock bas', value: this.stats.lowStockAlerts, icon: '⚠️', color: 'red', route: '/admin/dashboard', critical: this.stats.lowStockAlerts > 0 },
        { label: 'Produits suivis', value: this.stats.totalProducts, icon: '📦', color: 'blue', route: '/admin/dashboard' },
        { label: 'Depots observes', value: this.stats.totalWarehouses, icon: '🏬', color: 'purple' },
        { label: 'Valeur du stock', value: `${this.stats.totalValue || 0} TND`, icon: '📈', color: 'yellow' },
      ];
      this.quickLinks = [
        { label: 'Mon profil', route: '/admin/profile', icon: '👤' },
        { label: 'Demandes a valider', route: '/admin/validation-demandes', icon: '✅' },
        { label: 'Previsions', route: '/admin/previsions', icon: '📊' },
        { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
      ];
      return;
    }

    if (this.isManager) {
      this.dashboardCards = [
        { label: 'Demandes en cours', value: this.stats.totalProducts, icon: '🗂️', color: 'blue', route: '/admin/demandes-consommables' },
        { label: 'Mouvements stock', value: this.movementsTrend.reduce((sum, item) => sum + Number(item.count || 0), 0), icon: '🔄', color: 'purple', route: '/admin/mouvements-stock' },
        { label: 'Depots utiles', value: this.stats.totalWarehouses, icon: '🏬', color: 'green' },
        { label: 'Alertes a traiter', value: this.stats.lowStockAlerts, icon: '🚨', color: 'yellow', route: '/admin/gerer-produits' },
      ];
      this.quickLinks = [
        { label: 'Mon profil', route: '/admin/profile', icon: '👤' },
        { label: 'Demandes', route: '/admin/demandes-consommables', icon: '📥' },
        { label: 'Produits', route: '/admin/gerer-produits', icon: '📦' },
        { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
      ];
      return;
    }

    this.dashboardCards = [
      { label: 'Produits disponibles', value: this.stats.totalProducts, icon: '📦', color: 'blue' },
      { label: 'Depots accessibles', value: this.stats.totalWarehouses, icon: '🏬', color: 'purple' },
      { label: 'Alertes stock', value: this.stats.lowStockAlerts, icon: '⚠️', color: 'yellow' },
      { label: 'Mon compte', value: this.user?.email || 'Profil', icon: '👤', color: 'green', route: '/admin/profile' },
    ];
    this.quickLinks = [
      { label: 'Mon profil', route: '/admin/profile', icon: '👤' },
      { label: 'Demandes consommables', route: '/admin/demandes-consommables', icon: '📥' },
      { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
    ];
  }

  getTotalStats(): number {
    return Object.keys(this.stats).length;
  }

  photoUrl(path: string | null): string {
    if (!path) return 'assets/default-avatar.svg';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/+/, '');
    return `http://localhost:8000/storage/${cleanPath}`;
  }

  onImageError(event: any) {
    event.target.src = 'assets/default-avatar.svg';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
