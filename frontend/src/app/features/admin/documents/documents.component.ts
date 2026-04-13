import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AdminWarehouseService } from '../services/admin-warehouse.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsComponent implements OnInit {
  documents: any[] = [];
  file: File | null = null;
  title = '';
  type = '';
  direction = 'unknown';
  product_id: number | null = null;
  supplier_id: number | null = null;
  warehouse_id: number | null = null;
  isLoading = false;
  message = '';
  error = '';
  expandedDocId: number | null = null;
  showEditLines: number | null = null;

  categories: any[] = [];
  warehouses: any[] = [];
  supplierConfirmation: any = null;
  productConfirmation: any = null;
  locationConfirmation: any = null;
  locationStepIndex = 0;

  constructor(
    private http: HttpClient,
    private warehouseService: AdminWarehouseService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.load();
    this.loadCategories();
    this.loadWarehouses();
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLoading = true;
    this.http.get('/api/admin/documents').subscribe({
      next: (res: any) => {
        this.documents = Array.isArray(res) ? res : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const status = err?.status || err?.statusCode || 'inconnu';
        const msg = err?.error?.message || err?.statusText || 'Erreur de connexion';
        this.error = `Impossible de charger les documents (${status}) : ${msg}`;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadCategories(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.http.get('/api/admin/categories?status=active').subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : [];
        if (this.categories.length === 0) {
          this.http.get('/api/admin/categories?tree=1').subscribe({
            next: (tree: any) => { this.categories = Array.isArray(tree) ? tree : []; },
            error: () => { this.categories = []; }
          });
        }
      },
      error: () => { this.categories = []; }
    });
  }

  loadWarehouses(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.warehouseService.listWarehouses(null, 200).subscribe({
      next: (res: any) => {
        this.warehouses = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: () => {
        this.warehouses = [];
      }
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = (input.files && input.files.length) ? input.files[0] : null;
  }

  upload(): void {
    if (!this.file) {
      this.error = 'Choisissez un fichier.';
      return;
    }

    this.error = '';
    this.message = '';
    const form = new FormData();
    form.append('file', this.file);
    if (this.title) form.append('title', this.title);
    if (this.type) form.append('type', this.type);
    if (this.direction) form.append('direction', this.direction);
    if (this.product_id) form.append('product_id', String(this.product_id));
    if (this.supplier_id) form.append('supplier_id', String(this.supplier_id));
    if (this.warehouse_id) form.append('warehouse_id', String(this.warehouse_id));
    form.append('auto_create_supplier', 'false');

    this.isLoading = true;
    this.http.post('/api/admin/documents', form).subscribe({
      next: (doc: any) => {
        this.message = 'Document importe. OCR en cours...';
        this.title = doc?.title || '';
        this.type = doc?.type || '';
        this.direction = doc?.direction || 'unknown';
        this.file = null;
        this.supplierConfirmation = null;
        this.load();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const suggested = err?.suggested_supplier || err?.error?.suggested_supplier;
        const suggestedExisting = err?.suggested_existing_supplier || err?.error?.suggested_existing_supplier;
        if (suggested) {
          this.supplierConfirmation = {
            suggested,
            existing: suggestedExisting || null,
            name: suggested.name || '',
            email: suggested.email || '',
            title: this.title,
            type: this.type,
            direction: this.direction,
            product_id: this.product_id,
            warehouse_id: this.warehouse_id,
            file: this.file
          };
          this.error = '';
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        this.error = err?.message || err?.error?.message || 'Upload impossible.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleExpanded(docId: number): void {
    this.expandedDocId = this.expandedDocId === docId ? null : docId;
  }

  toggleEditLines(docId: number): void {
    this.showEditLines = this.showEditLines === docId ? null : docId;
  }

  apply(doc: any): void {
    const items = (doc?.ocr_lines || []).map((l: any) => ({
      title: l.title,
      reference: l.reference || null,
      quantity: l.quantity,
      direction: doc.direction || 'unknown',
      product_id: l.product_id || null,
      warehouse_id: l.warehouse_id || null,
      room_id: l.room_id || null,
      warehouse_location_id: l.warehouse_location_id || l.location_id || null,
      cabinet_id: l.cabinet_id || null
    }));

    if (items.length === 0) {
      this.error = 'Aucune ligne OCR trouvee. Verifiez le fichier.';
      return;
    }

    this.openLocationConfirmation(doc, items, false);
  }

  private executeApply(doc: any, items: any[], autoCreateProduct: boolean): void {
    this.isLoading = true;
    this.http.post(`/api/admin/documents/${doc.id}/apply`, { items, auto_create_product: autoCreateProduct }).subscribe({
      next: (res: any) => {
        this.message = res?.message || 'Document applique au stock.';
        this.error = '';
        this.showEditLines = null;
        this.locationConfirmation = null;
        this.productConfirmation = null;
        setTimeout(() => this.load(), 500);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const suggested = err?.error?.suggested_products || err?.suggested_products || err?.error?.suggested_product || err?.suggested_product;
        if (suggested) {
          const formatted = Array.isArray(suggested) ? suggested : [suggested];
          this.productConfirmation = {
            doc,
            items,
            suggestedProducts: formatted.map((p: any) => ({ ...p, category_id: p.category_id || p.categorie_id || null }))
          };
          this.locationConfirmation = null;
          this.supplierConfirmation = null;
          this.error = 'Produit(s) inconnu(s) detecte(s). Choisissez une categorie pour chacun.';
          this.loadCategories();
        } else {
          this.error = err?.error?.message || err?.message || 'Erreur lors de l application.';
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openLocationConfirmation(doc: any, items: any[], autoCreateProduct: boolean): void {
    this.locationConfirmation = {
      doc,
      autoCreateProduct,
      items: items.map((item: any) => ({
        ...item,
        storage_target: item.warehouse_location_id ? 'location' : (item.cabinet_id ? 'cabinet' : 'location'),
        rooms: [],
        locations: [],
        cabinets: []
      }))
    };
    this.locationStepIndex = 0;

    this.locationConfirmation.items.forEach((item: any) => {
      if (item.warehouse_id) {
        this.onWarehouseSelected(item, false);
      }
      if (item.room_id) {
        this.onRoomSelected(item, false);
      }
    });

    this.cdr.detectChanges();
  }

  cancelLocationConfirmation(): void {
    this.locationConfirmation = null;
    this.locationStepIndex = 0;
  }

  onWarehouseSelected(item: any, reset = true): void {
    if (reset) {
      item.room_id = null;
      item.warehouse_location_id = null;
      item.cabinet_id = null;
      item.storage_target = 'location';
      item.locations = [];
      item.cabinets = [];
    }

    if (!item.warehouse_id) {
      item.rooms = [];
      return;
    }

    this.warehouseService.listRooms(Number(item.warehouse_id), null, 200).subscribe({
      next: (res: any) => {
        item.rooms = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: () => {
        item.rooms = [];
      }
    });
  }

  onRoomSelected(item: any, reset = true): void {
    if (reset) {
      item.warehouse_location_id = null;
      item.cabinet_id = null;
      item.storage_target = 'location';
    }

    if (!item.room_id) {
      item.locations = [];
      item.cabinets = [];
      return;
    }

    this.warehouseService.listLocations(Number(item.room_id), null, 500).subscribe({
      next: (res: any) => {
        item.locations = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: () => {
        item.locations = [];
      }
    });

    this.warehouseService.listCabinets(Number(item.room_id), null, 500).subscribe({
      next: (res: any) => {
        item.cabinets = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: () => {
        item.cabinets = [];
      }
    });
  }

  onLocationSelected(item: any): void {
    if (item.warehouse_location_id) {
      item.cabinet_id = null;
      item.storage_target = 'location';
    }
  }

  onCabinetSelected(item: any): void {
    if (item.cabinet_id) {
      item.warehouse_location_id = null;
      item.storage_target = 'cabinet';
    }
  }

  selectStorageTarget(item: any, target: 'location' | 'cabinet'): void {
    item.storage_target = target;
    if (target === 'location') {
      item.cabinet_id = null;
    } else {
      item.warehouse_location_id = null;
    }
  }

  currentLocationItem(): any | null {
    if (!this.locationConfirmation?.items?.length) return null;
    return this.locationConfirmation.items[this.locationStepIndex] || null;
  }

  canGoNextLocation(): boolean {
    const item = this.currentLocationItem();
    if (!item) return false;
    if (!item.warehouse_id || !item.room_id) return false;
    if (item.storage_target === 'cabinet') return !!item.cabinet_id;
    return !!item.warehouse_location_id;
  }

  nextLocationStep(): void {
    if (!this.locationConfirmation || !this.canGoNextLocation()) return;
    if (this.locationStepIndex < this.locationConfirmation.items.length - 1) {
      this.locationStepIndex += 1;
      this.cdr.detectChanges();
      return;
    }
    this.confirmLocationSelection();
  }

  previousLocationStep(): void {
    if (this.locationStepIndex > 0) {
      this.locationStepIndex -= 1;
      this.cdr.detectChanges();
    }
  }

  confirmLocationSelection(): void {
    if (!this.locationConfirmation) return;

    for (const item of this.locationConfirmation.items) {
      if (Number(item.quantity) > 0 && (!item.warehouse_id || !item.room_id || (!item.warehouse_location_id && !item.cabinet_id))) {
        this.error = `Veuillez choisir depot, salle, puis emplacement ou armoire pour "${item.title}".`;
        this.cdr.detectChanges();
        return;
      }
    }

    const items = this.locationConfirmation.items.map((item: any) => ({
      title: item.title,
      reference: item.reference,
      quantity: item.quantity,
      direction: item.direction,
      product_id: item.product_id,
      warehouse_id: item.warehouse_id ? Number(item.warehouse_id) : null,
      room_id: item.room_id ? Number(item.room_id) : null,
      warehouse_location_id: item.warehouse_location_id ? Number(item.warehouse_location_id) : null,
      cabinet_id: item.cabinet_id ? Number(item.cabinet_id) : null
    }));

    this.executeApply(this.locationConfirmation.doc, items, this.locationConfirmation.autoCreateProduct);
  }

  confirmProductCreation(): void {
    if (!this.productConfirmation || !Array.isArray(this.productConfirmation.suggestedProducts)) return;

    const required = this.productConfirmation.suggestedProducts;
    for (const prod of required) {
      if (!prod.category_id || Number.isNaN(Number(prod.category_id)) || Number(prod.category_id) <= 0) {
        this.error = 'Veuillez selectionner une categorie pour chaque produit inconnu.';
        return;
      }
    }

    const items = this.productConfirmation.items.map((item: any) => {
      const found = required.find((prod: any) => prod.title === item.title && prod.reference === item.reference);
      if (!found) return item;

      return {
        ...item,
        category_id: Number(found.category_id),
        categorie_id: Number(found.category_id),
        warehouse_id: item.warehouse_id ? Number(item.warehouse_id) : null,
        room_id: item.room_id ? Number(item.room_id) : null,
        warehouse_location_id: item.warehouse_location_id ? Number(item.warehouse_location_id) : null,
        cabinet_id: item.cabinet_id ? Number(item.cabinet_id) : null
      };
    });

    this.executeApply(this.productConfirmation.doc, items, true);
  }

  cancelProductCreation(): void {
    this.productConfirmation = null;
  }

  confirmSupplierCreation(): void {
    if (!this.supplierConfirmation) return;

    const { suggested, name, email, file, title, type, direction, product_id, warehouse_id } = this.supplierConfirmation;
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('auto_create_supplier', 'true');
    form.append('name', name || suggested.name || '');
    form.append('supplier_name', name || suggested.name || '');
    if (email) form.append('supplier_email', email);
    if (this.supplierConfirmation?.existing?.id && this.supplierConfirmation.useExisting) {
      form.append('supplier_id', String(this.supplierConfirmation.existing.id));
      form.append('confirm_supplier_match', 'true');
      form.set('auto_create_supplier', 'false');
    }
    if (title) form.append('title', title);
    if (type) form.append('type', type);
    if (direction) form.append('direction', direction);
    if (product_id) form.append('product_id', String(product_id));
    if (warehouse_id) form.append('warehouse_id', String(warehouse_id));

    this.isLoading = true;
    this.http.post('/api/admin/documents', form).subscribe({
      next: () => {
        this.message = 'Document importe avec le fournisseur confirme.';
        this.supplierConfirmation = null;
        this.load();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de confirmation fournisseur.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelSupplierCreation(): void {
    this.supplierConfirmation = null;
  }

  chooseExistingSupplier(): void {
    if (!this.supplierConfirmation?.existing?.id) return;
    this.supplierConfirmation.useExisting = true;
    this.confirmSupplierCreation();
  }

  chooseNewSupplier(): void {
    if (!this.supplierConfirmation) return;
    this.supplierConfirmation.useExisting = false;
  }

  runDiagnostic(doc: any): void {
    if (!doc?.path) {
      this.error = 'Impossible de diagnostiquer: fichier non trouve.';
      return;
    }

    this.isLoading = true;
    this.http.post('/api/admin/documents/diagnostic', { path: doc.path }).subscribe({
      next: (res: any) => {
        this.message = `OCR: ${res?.ocr_lines_count || 0} lignes trouvees. Tesseract: ${res?.tesseract_found ? 'OK' : 'NON TROUVE'}`;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du diagnostic.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private saveDocumentOcrLines(doc: any): void {
    if (!doc?.id) return;

    this.http.put(`/api/admin/documents/${doc.id}`, { ocr_lines: doc.ocr_lines || [] }).subscribe({
      next: () => {
        this.message = 'Lignes OCR enregistrees.';
        this.error = '';
      },
      error: (err) => {
        this.error = 'Impossible de sauvegarder les lignes OCR : ' + (err?.error?.message || err?.message || 'Erreur inconnue');
      }
    });
  }

  removeOcrLine(doc: any, index: number): void {
    if (doc.ocr_lines) {
      doc.ocr_lines.splice(index, 1);
      this.saveDocumentOcrLines(doc);
    }
  }

  addOcrLine(doc: any): void {
    if (!doc.ocr_lines) {
      doc.ocr_lines = [];
    }
    doc.ocr_lines.push({
      reference: '',
      title: '',
      quantity: 1
    });
    this.saveDocumentOcrLines(doc);
  }

  download(doc: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const path = doc?.path;
    if (!path) return;
    const cleanPath = path.replace(/^[/\\]+/, '');
    const url = 'http://localhost:8000/storage/' + cleanPath;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc?.title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  // ── À ajouter dans ta classe ──────────────────────────────────

// Pagination
pageSizes    = [5, 10, 20];
pageSize     = 10;
currentPage  = 1;
min          = Math.min;

// Filtres
statusFilter: string | null    = null;
directionFilter: string | null = null;

// ── Filtrage ──────────────────────────────────────────────────
get filteredDocuments() {
  return this.documents.filter(d => {
    const matchStatus    = !this.statusFilter    || d.status    === this.statusFilter;
    const matchDirection = !this.directionFilter || d.direction === this.directionFilter;
    return matchStatus && matchDirection;
  });
}

filterByStatus(status: string | null): void {
  this.statusFilter = this.statusFilter === status ? null : status;
  this.currentPage  = 1;
  this.expandedDocId = null;
}

filterByDirection(dir: string | null): void {
  this.directionFilter = this.directionFilter === dir ? null : dir;
  this.currentPage     = 1;
  this.expandedDocId   = null;
}

clearFilters(): void {
  this.statusFilter    = null;
  this.directionFilter = null;
  this.currentPage     = 1;
  this.expandedDocId   = null;
}

// ── Stats ─────────────────────────────────────────────────────
countByStatus(status: string): number {
  return this.documents.filter(d => d.status === status).length;
}

countByDirection(dir: string): number {
  return this.documents.filter(d => d.direction === dir).length;
}

// ── Pagination ────────────────────────────────────────────────
get totalPages(): number {
  return Math.ceil(this.filteredDocuments.length / this.pageSize);
}

get paginatedDocuments() {
  const start = (this.currentPage - 1) * this.pageSize;
  return this.filteredDocuments.slice(start, start + this.pageSize);
}

get pageNumbers(): (number | string)[] {
  const total   = this.totalPages;
  const current = this.currentPage;
  const pages: (number | string)[] = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (current > 3)             pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2)     pages.push('...');
  pages.push(total);
  return pages;
}

goToPage(page: number): void {
  if (page < 1 || page > this.totalPages) return;
  this.currentPage   = page;
  this.expandedDocId = null;
}

setPageSize(size: number): void {
  this.pageSize      = size;
  this.currentPage   = 1;
  this.expandedDocId = null;
}
}
