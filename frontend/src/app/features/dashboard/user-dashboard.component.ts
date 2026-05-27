import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.css']
})
export class UserDashboardComponent implements OnInit {
  role: string | null = null;
  userName = 'Utilisateur';
  todayLabel = '';
  isLoading = false;

  stats = {
    myRequests: 0,
    pendingRequests: 0,
    requestsToday: 0,
    pendingValidations: 0,
    unreadNotifications: 0,
  };

  constructor(
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.role = this.authService.getUserRole();
    const user = this.authService.getCurrentUserSnapshot();
    this.userName = user?.nomprenom || user?.name || 'Utilisateur';
    this.todayLabel = new Date().toLocaleDateString('fr-FR');
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    this.apiService.get('consumable-requests').subscribe({
      next: (requests: any[]) => {
        const items = Array.isArray(requests) ? requests : [];
        const today = new Date().toDateString();
        const lowerRole = (this.role || '').toLowerCase();
        const canValidate = lowerRole.includes('directeur') || lowerRole.includes('responsable') || lowerRole.includes('gestionnaire');

        this.stats.myRequests = items.length;
        this.stats.pendingRequests = items.filter((r: any) => {
          const status = String(r?.status || '').toLowerCase();
          return status === 'pending' || status === 'approved_pending_exit' || status === 'validated_by_manager';
        }).length;
        this.stats.requestsToday = items.filter((r: any) => {
          const created = r?.created_at ? new Date(r.created_at).toDateString() : '';
          return created === today;
        }).length;
        this.stats.pendingValidations = canValidate
          ? items.filter((r: any) => String(r?.status || '').toLowerCase() === 'pending').length
          : 0;

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    this.apiService.get('notifications/unread-count').subscribe({
      next: (res: any) => {
        this.stats.unreadNotifications = Number(res?.count || 0);
      },
      error: () => {
        this.stats.unreadNotifications = 0;
      }
    });
  }
}
