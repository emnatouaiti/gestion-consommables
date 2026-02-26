import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UnitService } from '../../../core/services/unit.service';

@Component({
  selector: 'app-units',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './units.component.html',
  styleUrls: ['./units.component.css']
})
export class UnitsComponent implements OnInit {
  units: any[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  showModal = false;
  editingId: number | null = null;
  form = {
    name: '',
    code: '',
    description: ''
  };

  constructor(
    private readonly unitService: UnitService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.isLoading = false;
      return;
    }

    this.load();
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.unitService.list().subscribe({
      next: (data) => {
        this.units = Array.isArray(data) ? data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = err?.message || 'Erreur de chargement des unites.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openAddModal(): void {
    this.resetForm();
    this.showModal = true;
  }

  openEditModal(unit: any): void {
    this.editingId = unit.id;
    this.form = {
      name: unit.name || '',
      code: unit.code || '',
      description: unit.description || ''
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  save(): void {
    const payload = {
      name: (this.form.name || '').trim(),
      code: (this.form.code || '').trim() || null,
      description: (this.form.description || '').trim() || null
    };

    if (!payload.name) {
      this.errorMessage = 'Le nom est obligatoire.';
      return;
    }

    this.errorMessage = '';

    const req$ = this.editingId
      ? this.unitService.update(this.editingId, payload)
      : this.unitService.create(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Unite mise a jour.' : 'Unite creee.';
        this.closeModal();
        this.load();
        this.cdr.detectChanges();
        setTimeout(() => (this.successMessage = ''), 2500);
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || err?.message || 'Erreur de sauvegarde.';
        this.cdr.detectChanges();
      }
    });
  }

  remove(id: number): void {
    if (!confirm('Supprimer cette unite ?')) {
      return;
    }

    this.unitService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Unite supprimee.';
        this.load();
        this.cdr.detectChanges();
        setTimeout(() => (this.successMessage = ''), 2000);
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || err?.message || 'Suppression impossible.';
        this.cdr.detectChanges();
      }
    });
  }

  private resetForm(): void {
    this.editingId = null;
    this.form = { name: '', code: '', description: '' };
    this.errorMessage = '';
  }
}
