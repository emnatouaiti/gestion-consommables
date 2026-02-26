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
