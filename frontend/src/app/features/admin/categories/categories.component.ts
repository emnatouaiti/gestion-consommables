import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AdminStockService } from '../services/admin-stock.service';

interface CategoryNode {
  id: number;
  title: string;
  description: string;
  status: string;
  parent_id: number | null;
  level: number;
  recursive_children?: CategoryNode[];
}

@Component({
  selector: 'app-categories',
  standalone: false,
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css']
})
export class CategoriesComponent implements OnInit {
  categories: CategoryNode[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  expandedIds = new Set<number>();
  showModal = false;

  editingId: number | null = null;
  form = {
    title: '',
    description: '',
    status: 'active',
    parent_id: null as number | null
  };

  constructor(
    private readonly stockService: AdminStockService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.stockService.listCategories({ tree: true }).subscribe({
      next: (data) => {
        this.categories = Array.isArray(data) ? data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || 'Erreur de chargement.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get totalCount(): number {
    return this.countAll(this.categories);
  }

  private countAll(list: CategoryNode[]): number {
    let count = 0;
    for (const c of list) {
      count++;
      if (c.recursive_children) count += this.countAll(c.recursive_children);
    }
    return count;
  }

  toggleExpand(id: number): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  expandAll(): void {
    this.addAllIds(this.categories);
  }

  collapseAll(): void {
    this.expandedIds.clear();
  }

  private addAllIds(list: CategoryNode[]): void {
    for (const c of list) {
      if (c.recursive_children && c.recursive_children.length) {
        this.expandedIds.add(c.id);
        this.addAllIds(c.recursive_children);
      }
    }
  }

  isExpanded(id: number): boolean {
    return this.expandedIds.has(id);
  }

  hasChildren(cat: CategoryNode): boolean {
    return !!(cat.recursive_children && cat.recursive_children.length > 0);
  }

  childCount(cat: CategoryNode): number {
    return cat.recursive_children ? cat.recursive_children.length : 0;
  }

  // ─── Modal ───

  openAddModal(parentId: number | null = null): void {
    this.resetForm();
    this.form.parent_id = parentId;
    this.showModal = true;
    if (parentId) this.expandedIds.add(parentId);
  }

  openEditModal(cat: CategoryNode): void {
    this.editingId = cat.id;
    this.form = {
      title: cat.title || '',
      description: cat.description || '',
      status: cat.status || 'active',
      parent_id: cat.parent_id
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
    const payload: any = {
      title: (this.form.title || '').trim(),
      description: (this.form.description || '').trim(),
      status: this.form.status,
      parent_id: this.form.parent_id || null
    };

    if (!payload.title) {
      this.errorMessage = 'Le titre est obligatoire.';
      return;
    }

    this.errorMessage = '';

    const req$ = this.editingId
      ? this.stockService.updateCategory(this.editingId, payload)
      : this.stockService.createCategory(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Catégorie mise à jour !' : 'Catégorie créée !';
        this.closeModal();
        this.load();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || 'Erreur de sauvegarde.';
      }
    });
  }

  remove(id: number): void {
    if (!confirm('Supprimer cette catégorie et toutes ses sous-catégories ?')) return;
    this.stockService.deleteCategory(id).subscribe({
      next: () => {
        this.successMessage = 'Catégorie supprimée !';
        this.load();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || err?.message || 'Suppression impossible.';
      }
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { title: '', description: '', status: 'active', parent_id: null };
    this.errorMessage = '';
  }

  getParentTitle(parentId: number | null): string {
    if (!parentId) return '';
    return this.findTitle(this.categories, parentId) || `#${parentId}`;
  }

  private findTitle(list: CategoryNode[], id: number): string | null {
    for (const c of list) {
      if (c.id === id) return c.title;
      if (c.recursive_children) {
        const found = this.findTitle(c.recursive_children, id);
        if (found) return found;
      }
    }
    return null;
  }

  getLevelLabel(level: number): string {
    switch (level) {
      case 1: return 'Catégorie';
      case 2: return 'Sous-catégorie';
      case 3: return 'Sous-sous-catégorie';
      default: return 'Catégorie';
    }
  }

  getLevelIcon(level: number): string {
    switch (level) {
      case 1: return '📁';
      case 2: return '📂';
      case 3: return '📄';
      default: return '📁';
    }
  }
}
