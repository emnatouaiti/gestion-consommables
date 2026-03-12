import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';

interface AuditLogEntry {
  id: number;
  action: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
  user?: {
    nomprenom?: string;
    email?: string;
    service?: string;
    poste?: string;
  } | null;
}

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css']
})
export class AuditLogsComponent implements OnInit {
  logs: AuditLogEntry[] = [];
  availableActions: string[] = [];
  isLoading = false;
  errorMessage = '';

  q = '';
  action = '';
  from = '';
  to = '';

  page = 1;
  perPage = 20;
  total = 0;
  lastPage = 1;

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.load();
  }

  load(resetPage = false): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (resetPage) {
      this.page = 1;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    let params = new HttpParams()
      .set('page', this.page)
      .set('per_page', this.perPage);

    if (this.q.trim()) {
      params = params.set('q', this.q.trim());
    }
    if (this.action.trim()) {
      params = params.set('action', this.action.trim());
    }
    if (this.from) {
      params = params.set('from', this.from);
    }
    if (this.to) {
      params = params.set('to', this.to);
    }

    this.api.get('admin/audit-logs', params).subscribe({
      next: (res: any) => {
        this.logs = Array.isArray(res?.data) ? res.data : [];
        this.total = Number(res?.total || 0);
        this.page = Number(res?.current_page || 1);
        this.lastPage = Number(res?.last_page || 1);
        this.availableActions = this.extractActions(this.logs);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.logs = [];
        this.errorMessage = err?.message || 'Impossible de charger le journal d audit.';
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    this.load(true);
  }

  clearFilters(): void {
    this.q = '';
    this.action = '';
    this.from = '';
    this.to = '';
    this.load(true);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.page) {
      return;
    }
    this.page = page;
    this.load(false);
  }

  userLabel(log: AuditLogEntry): string {
    return log.user?.nomprenom || log.user?.email || 'Systeme';
  }

  private extractActions(entries: AuditLogEntry[]): string[] {
    const set = new Set<string>();
    entries.forEach((entry) => {
      if (entry.action) {
        set.add(entry.action);
      }
    });
    return Array.from(set).sort();
  }
}
