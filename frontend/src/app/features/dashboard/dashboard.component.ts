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
  isDownloadingReport = false;
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
    totalValue: 0,
    // Statistiques personnelles de l'utilisateur
    myRequests: 0,
    myPendingRequests: 0,
    myApprovedRequests: 0,
    myRejectedRequests: 0,
    myMovements: 0,
    myPendingMovements: 0,
    myDocuments: 0,
    pendingValidations: 0,
    pendingStockMovements: 0
  };

  // Indicateurs de tendance
  trends = {
    usersTrend: 0,
    productsTrend: 0,
    requestsTrend: 0,
    movementsTrend: 0
  };

  // Filtres de période
  selectedPeriod: string = '7days';
  periodOptions = [
    { value: '7days', label: '7 derniers jours' },
    { value: '30days', label: '30 derniers jours' },
    { value: '90days', label: '90 derniers jours' },
    { value: 'all', label: 'Tout' }
  ];

  // État des alertes
  criticalAlerts: any[] = [];
  showCriticalAlerts = true;

  // État des graphiques interactifs
  selectedTrendDay: string | null = null;
  selectedTrendDetails: any = null;

  categoryStock: any[] = [];
  movementsTrend: any[] = [];

  // Données simulées
  recentActivities: any[] = [];
  recentUsers: any[] = [];
  roles: any[] = [];
  dashboardCards: Array<{ label: string; value: string | number; icon: string; color: string; route?: string; critical?: boolean; trend?: number; trendLabel?: string }> = [];
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
        this.calculateTrends();
        this.extractCriticalAlerts();
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

  private calculateTrends(): void {
    // Calculer les tendances basées sur les données historiques
    if (this.movementsTrend.length >= 2) {
      const recent = this.movementsTrend.slice(0, 3).reduce((sum, m) => sum + m.count, 0);
      const previous = this.movementsTrend.slice(3, 6).reduce((sum, m) => sum + m.count, 0);
      this.trends.movementsTrend = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
    }

    // Tendance des demandes
    this.trends.requestsTrend = this.stats.myRequests > 0 ?
      ((this.stats.myPendingRequests / this.stats.myRequests) * 100) : 0;

    // Tendance des utilisateurs (simulation)
    this.trends.usersTrend = this.stats.activeUsers > 0 ?
      ((this.stats.newUsersThisMonth / this.stats.activeUsers) * 100) : 0;
  }

  private extractCriticalAlerts(): void {
    this.criticalAlerts = [];

    if (this.stats.lowStockAlerts > 0) {
      this.criticalAlerts.push({
        type: 'stock',
        message: `${this.stats.lowStockAlerts} produits en stock critique`,
        severity: 'high',
        icon: '⚠️'
      });
    }

    if (this.stats.pendingValidations > 5) {
      this.criticalAlerts.push({
        type: 'validation',
        message: `${this.stats.pendingValidations} demandes en attente de validation`,
        severity: 'medium',
        icon: '📋'
      });
    }

    if (this.stats.pendingStockMovements > 3) {
      this.criticalAlerts.push({
        type: 'movements',
        message: `${this.stats.pendingStockMovements} mouvements en attente`,
        severity: 'medium',
        icon: '📦'
      });
    }
  }

  onPeriodChange(period: string): void {
    this.selectedPeriod = period;
    this.loadDashboardData(); // Recharger les données avec la nouvelle période
  }

  toggleCriticalAlerts(): void {
    this.showCriticalAlerts = !this.showCriticalAlerts;
  }

  showTrendDetails(trend: any): void {
    this.selectedTrendDay = trend.day;
    this.selectedTrendDetails = trend;
  }

  hideTrendDetails(): void {
    this.selectedTrendDay = null;
    this.selectedTrendDetails = null;
  }

  getMaxCategoryCount(): number {
    if (this.categoryStock.length === 0) return 1;
    return Math.max(...this.categoryStock.map(c => c.count));
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
    return this.authService.userHasAnyRole(this.user, ['Agent', 'Responsable', 'Gestionnaire', 'Responsable de stock']);
  }

  get dashboardBadge(): string {
    if (this.isAdmin) return 'Administration';
    if (this.isDirector) return 'Direction';
    if (this.isManager) return 'Opérations';
    return 'Espace utilisateur';
  }

  get dashboardTitle(): string {
    if (this.isAdmin) return `Pilotage global, ${this.user?.nomprenom || 'Administrateur'}`;
    if (this.isDirector) return `Vue décisionnelle, ${this.user?.nomprenom || 'Direction'}`;
    if (this.isManager) return `Suivi opérationnel, ${this.user?.nomprenom || 'Responsable'}`;
    return `Bienvenue, ${this.user?.nomprenom || 'Utilisateur'}`;
  }

  get dashboardDescription(): string {
    if (this.isAdmin) return 'Supervisez les utilisateurs, le stock et les dépôts sans passer par le menu de connexion.';
    if (this.isDirector) return 'Retrouvez les indicateurs de validation, les alertes de stock et les accès rapides utiles à la direction.';
    if (this.isManager) return 'Suivez les mouvements, les demandes et les points de stockage utiles à vos opérations quotidiennes.';
    return 'Accédez rapidement à votre profil, à vos demandes et à la situation générale du stock.';
  }

  get sidePanelTitle(): string {
    if (this.isAdmin) return 'Utilisateurs récents';
    if (this.isDirector) return 'Points de vigilance';
    if (this.isManager) return 'Actions rapides';
    return 'Mon espace';
  }

  private buildDashboardView(): void {
    // Réinitialiser les cartes
    this.dashboardCards = [];
    this.quickLinks = [];

    if (this.isAdmin) {
      // Admin voit SEULEMENT les statistiques des utilisateurs
      this.dashboardCards = [
        {
          label: 'Utilisateurs actifs',
          value: this.stats.activeUsers,
          icon: '👥',
          color: 'green',
          route: '/admin/users',
          trend: this.trends.usersTrend,
          trendLabel: this.trends.usersTrend > 0 ? '+ croissance' : '- stable'
        },
        {
          label: 'Total utilisateurs',
          value: this.stats.totalUsers,
          icon: '👤',
          color: 'blue',
          route: '/admin/users'
        },
        {
          label: 'Utilisateurs archivés',
          value: this.stats.archivedUsers,
          icon: '📁',
          color: 'yellow',
          route: '/admin/users'
        },
      ];

      this.quickLinks = [
        { label: 'Mon profil', route: '/admin/profile', icon: '👤' },
        { label: 'Gérer utilisateurs', route: '/admin/users', icon: '👥' },
        { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
      ];
      return;
    }

    if (this.isDirector) {
      // Directeur voit TOUT: produits, catégories, stock, demandes
      this.dashboardCards = [
        {
          label: 'Produits',
          value: this.stats.totalProducts,
          icon: '📦',
          color: 'blue',
          route: '/admin/gerer-produits',
          trend: this.trends.productsTrend,
          trendLabel: this.trends.productsTrend > 0 ? '+ croissance' : '- stable'
        },
        { label: 'Catégories', value: this.stats.totalCategories, icon: '📂', color: 'purple', route: '/admin/categories' },
        { label: 'Dépôts', value: this.stats.totalWarehouses, icon: '🏬', color: 'green', route: '/admin/gerer-depots' },
        {
          label: 'Demandes à valider',
          value: this.stats.pendingValidations,
          icon: '✅',
          color: 'yellow',
          route: '/admin/validation-demandes',
          critical: this.stats.pendingValidations > 0,
          trend: this.trends.requestsTrend,
          trendLabel: `${this.trends.requestsTrend.toFixed(1)}% en attente`
        },
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
        { label: 'Demandes à valider', route: '/admin/validation-demandes', icon: '✅' },
        { label: 'Gérer produits', route: '/admin/gerer-produits', icon: '📦' },
        { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
      ];
      return;
    }

    if (this.isManager) {
      // Responsable et Agent voient TOUT: produits, catégories, stock
      this.dashboardCards = [
        {
          label: 'Produits',
          value: this.stats.totalProducts,
          icon: '📦',
          color: 'blue',
          route: '/admin/gerer-produits',
          trend: this.trends.productsTrend,
          trendLabel: this.trends.productsTrend > 0 ? '+ croissance' : '- stable'
        },
        { label: 'Catégories', value: this.stats.totalCategories, icon: '📂', color: 'purple', route: '/admin/categories' },
        { label: 'Dépôts', value: this.stats.totalWarehouses, icon: '🏬', color: 'green', route: '/admin/gerer-depots' },
        {
          label: 'Mouvements en attente',
          value: this.stats.pendingStockMovements,
          icon: '📦',
          color: 'yellow',
          route: '/admin/mouvements-stock',
          critical: this.stats.pendingStockMovements > 0,
          trend: this.trends.movementsTrend,
          trendLabel: `${this.trends.movementsTrend.toFixed(1)}% tendance`
        },
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
        { label: 'Mouvements stock', route: '/admin/mouvements-stock', icon: '📦' },
        { label: 'Gérer produits', route: '/admin/gerer-produits', icon: '📦' },
        { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
      ];
      return;
    }

    // Utilisateur standard (Employé) voit SEULEMENT ses demandes
    this.dashboardCards = [
      {
        label: 'Mes demandes',
        value: this.stats.myRequests,
        icon: '📋',
        color: 'blue',
        route: '/admin/demandes-consommables',
        trend: this.trends.requestsTrend,
        trendLabel: `${this.trends.requestsTrend.toFixed(1)}% en attente`
      },
      {
        label: 'Demandes en attente',
        value: this.stats.myPendingRequests,
        icon: '⏳',
        color: 'yellow',
        route: '/admin/demandes-consommables',
        critical: this.stats.myPendingRequests > 0
      },
      { label: 'Demandes approuvées', value: this.stats.myApprovedRequests, icon: '✅', color: 'green', route: '/admin/demandes-consommables' },
      { label: 'Demandes rejetées', value: this.stats.myRejectedRequests, icon: '❌', color: 'red', route: '/admin/demandes-consommables' },
    ];
    this.quickLinks = [
      { label: 'Mon profil', route: '/admin/profile', icon: '👤' },
      { label: 'Nouvelle demande', route: '/admin/demandes-consommables', icon: '➕' },
      { label: 'Chat interne', route: '/admin/chat', icon: '💬' },
    ];
  }

  getTotalStats(): number {
    return Object.keys(this.stats).length;
  }

  photoUrl(path: string | null): string {
    if (!path) return 'assets/default-avatar.svg';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/+/, '').replace(/^storage\//, '');
    return `/api/docs/${cleanPath}`;
  }

  onImageError(event: any) {
    event.target.src = 'assets/default-avatar.svg';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  downloadReport(type: 'stock' | 'movements') {
    this.isDownloadingReport = true;
    this.adminStockService.downloadReport(type).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_${type}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.isDownloadingReport = false;
      },
      error: (err) => {
        console.error('Erreur tel', err);
        this.isDownloadingReport = false;
        alert('Erreur lors du telechargement du rapport.');
      }
    });
  }
}
