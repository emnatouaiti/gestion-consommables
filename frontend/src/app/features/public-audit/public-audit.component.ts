import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-public-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-audit.component.html',
  styleUrls: ['./public-audit.component.css']
})
export class PublicAuditComponent implements OnInit {
  auditLogs: any[] = [];
  isLoading = false;
  currentPage = 1;
  perPage = 20;
  totalPages = 1;
  searchQuery = '';
  selectedAction = '';
  fromDate = '';
  toDate = '';
  errorMessage = '';
  successMessage = '';

  actions: string[] = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'VIEW',
    'DOWNLOAD',
    'EXPORT',
    'ISSUE'
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAuditLogs();
  }

  loadAuditLogs() {
    this.isLoading = true;
    this.errorMessage = '';

    let url = `/api/audit-logs/public?page=${this.currentPage}&per_page=${this.perPage}`;

    if (this.searchQuery.trim()) {
      url += `&q=${encodeURIComponent(this.searchQuery)}`;
    }
    if (this.selectedAction) {
      url += `&action=${encodeURIComponent(this.selectedAction)}`;
    }
    if (this.fromDate) {
      url += `&from=${encodeURIComponent(this.fromDate)}`;
    }
    if (this.toDate) {
      url += `&to=${encodeURIComponent(this.toDate)}`;
    }

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.auditLogs = response.data || [];
        this.totalPages = response.last_page || 1;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading audit logs:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du chargement des logs d\'audit';
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  onActionChange() {
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  onDateChange() {
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedAction = '';
    this.fromDate = '';
    this.toDate = '';
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadAuditLogs();
    }
  }

  getActionColor(action: string): string {
    switch (action) {
      case 'CREATE':
        return '#4CAF50';
      case 'UPDATE':
        return '#2196F3';
      case 'DELETE':
        return '#F44336';
      case 'LOGIN':
        return '#9C27B0';
      case 'LOGOUT':
        return '#FF9800';
      case 'VIEW':
        return '#00BCD4';
      case 'DOWNLOAD':
        return '#673AB7';
      case 'EXPORT':
        return '#E91E63';
      case 'ISSUE':
        return '#D32F2F';
      default:
        return '#607D8B';
    }
  }

  getStatusIcon(action: string): string {
    switch (action) {
      case 'CREATE':
        return '✚';
      case 'UPDATE':
        return '✎';
      case 'DELETE':
        return '✕';
      case 'LOGIN':
        return '→';
      case 'LOGOUT':
        return '←';
      case 'VIEW':
        return '👁';
      case 'DOWNLOAD':
        return '⬇';
      case 'EXPORT':
        return '⤳';
      case 'ISSUE':
        return '⚠';
      default:
        return '•';
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
