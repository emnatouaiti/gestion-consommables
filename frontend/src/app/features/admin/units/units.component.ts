import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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

  constructor(private readonly unitService: UnitService) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.unitService.list().subscribe({
      next: (data) => {
        this.units = Array.isArray(data) ? data : [];
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err?.message || 'Erreur de chargement des unités.';
        this.isLoading = false;
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
        this.successMessage = this.editingId ? 'Unité mise à jour.' : 'Unité créée.';
        this.closeModal();
        this.load();
        setTimeout(() => this.successMessage = '', 2500);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || 'Erreur de sauvegarde.';
      }
    });
  }

  remove(id: number): void {
    if (!confirm('Supprimer cette unité ?')) return;
    this.unitService.delete(id).subscribe({
      next: () => {
        this.successMessage = 'Unité supprimée.';
        this.load();
        setTimeout(() => this.successMessage = '', 2000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || 'Suppression impossible.';
      }
    });
  }

  private resetForm(): void {
    this.editingId = null;
    this.form = { name: '', code: '', description: '' };
    this.errorMessage = '';
  }
}
