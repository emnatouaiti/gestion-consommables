import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AdminStockService } from '../services/admin-stock.service';
import { AdminWarehouseService } from '../services/admin-warehouse.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UnitService } from '../../../core/services/unit.service';
import JsBarcode from 'jsbarcode';

@Component({
  selector: 'app-products',
  standalone: false,
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  products: any[] = [];
  categories: any[] = [];
  suppliers: any[] = [];
  units: any[] = [];
  flatCategories: { id: number; title: string; level: number; displayTitle: string }[] = [];
  overview: any = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  scanCode = '';
  scanMessage = '';
  selectedSupplier: any | null = null;
  showSupplierDetailsModal = false;
  newReviewContent = '';
  newReviewRating: number | null = 5;
  scannedProduct: any | null = null;
  highlightedProductId: number | null = null;
  selectedPhotoFiles: File[] = [];
  photoPreviewUrls: string[] = [];
  showModal = false;
  private readonly barcodeCache = new Map<string, string>();

  warehouses: any[] = [];
  rooms: any[] = [];
  locations: any[] = [];

  pagination = {
    page: 1,
    per_page: 20,
    total: 0,
    last_page: 1
  };

  filters = {
    q: '',
    status: 'all',
    categorie_id: null as number | null,
    supplier_id: null as number | null,
    low_stock_only: false,
    out_of_stock_only: false
  };

  editingId: number | null = null;
  form = this.createEmptyForm();

  constructor(
    private readonly stockService: AdminStockService,
    private readonly warehouseService: AdminWarehouseService,
    private readonly supplierService: SupplierService,
    private readonly unitService: UnitService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) { }

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadSuppliers();
    this.loadUnits();
    this.loadAll();
  }

  private loadWarehouses(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.warehouseService.listWarehouses().subscribe({
      next: (res: any) => {
        this.warehouses = res.data || [];
        this.cdr.detectChanges();
      },
      error: () => this.warehouses = []
    });
  }

  private loadSuppliers(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.supplierService.getSuppliers().subscribe({
      next: (res: any) => {
        this.suppliers = res || [];
        this.cdr.detectChanges();
      },
      error: () => this.suppliers = []
    });
  }

  private loadUnits(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.unitService.list().subscribe({
      next: (res: any) => {
        this.units = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: () => this.units = []
    });
  }

  onWarehouseChange(): void {
    if (!this.form.warehouse_id) {
      this.rooms = [];
      this.locations = [];
      this.form.warehouse_room_id = null;
      this.form.warehouse_location_id = null;
      return;
    }

    this.warehouseService.listRooms(this.form.warehouse_id as number).subscribe({
      next: (res: any) => {
        this.rooms = res.data || [];
        this.locations = [];
        this.form.warehouse_room_id = null;
        this.form.warehouse_location_id = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.rooms = [];
      }
    });
  }

  onRoomChange(): void {
    if (!this.form.warehouse_room_id) {
      this.locations = [];
      this.form.warehouse_location_id = null;
      return;
    }
    this.warehouseService.listLocations(this.form.warehouse_room_id as number).subscribe({
      next: (res: any) => {
        this.locations = res.data || [];
        this.form.warehouse_location_id = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.locations = [];
      }
    });
  }

  private createEmptyForm() {
    return {
      status: 'active',
      title: '',
      short_description: '',
      description: '',
      commentaire: '',
      fabricant: '',
      num_serie: '',
      num_inventaire: '',
      model: '',
      marque: '',
      seuil_min: 0,
      reference: '',
      categorie_id: null as number | null,
      // Kept for compatibility with existing product listing & stock/location features.
      stock_quantity: null as number | null,
      purchase_price: null as number | null,
      unit_id: null as number | null,
      location: null as string | null,
      warehouse_id: null as number | null,
      warehouse_room_id: null as number | null,
      warehouse_location_id: null as number | null,
      supplier_id: null as number | null
    };
  }

  /* ─── Data Loading ─── */

  loadAll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLoading = true;
    this.errorMessage = '';

    this.stockService.listCategories({ tree: true }).subscribe({
      next: (cats) => {
        this.categories = Array.isArray(cats) ? cats : [];
        this.flatCategories = this.flattenTree(this.categories);
        // this.loadOverview(); // Route n'existe pas dans l'API
        this.loadProducts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err?.message || 'Erreur de chargement des catégories.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadProducts(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.stockService.listProducts({
      q: this.filters.q.trim(),
      status: this.filters.status,
      categorie_id: this.filters.categorie_id,
      supplier_id: this.filters.supplier_id,
      low_stock_only: this.filters.low_stock_only,
      out_of_stock_only: this.filters.out_of_stock_only,
      page: this.pagination.page,
      per_page: this.pagination.per_page
    }).subscribe({
      next: (data) => {
        this.products = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        this.pagination.total = Number(data?.total || this.products.length || 0);
        this.pagination.last_page = Number(data?.last_page || 1);
        this.pagination.page = Number(data?.current_page || this.pagination.page);
        this.refreshScannedProduct();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err?.message || 'Erreur de chargement des produits.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadOverview(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.stockService.productsOverview().subscribe({
      next: (data) => {
        this.overview = data || null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.overview = null;
        this.cdr.detectChanges();
      }
    });
  }

  /* ─── Modal ─── */

  openAddModal(): void {
    this.resetForm();
    this.showModal = true;
  }

  openEditModal(item: any): void {
    this.editingId = item.id;
    this.form = {
      status: item.status || 'active',
      title: item.title || '',
      short_description: item.short_description || '',
      description: item.description || '',
      commentaire: item.commentaire || '',
      fabricant: item.fabricant || '',
      num_serie: item.num_serie || '',
      num_inventaire: item.num_inventaire || '',
      model: item.model || '',
      marque: item.marque || '',
      seuil_min: item.seuil_min || 0,
      reference: item.reference || '',
      categorie_id: item.categorie_id ?? null,
      stock_quantity: null,
      purchase_price: item.purchase_price ?? null,
      unit_id: item.unit_id ?? item.unit?.id ?? null,
      location: null,
      warehouse_id: null,
      warehouse_room_id: null,
      warehouse_location_id: null,
      supplier_id: (item.suppliers && item.suppliers.length) ? item.suppliers[0].id : null
    };
    this.selectedPhotoFiles = [];
    this.photoPreviewUrls = [];
    const existingPhotos = Array.isArray(item.photos) && item.photos.length ? item.photos : (item.photo ? [{ path: item.photo }] : []);
    this.photoPreviewUrls = existingPhotos
      .map((p: any) => this.photoUrl(p?.path || p?.photo || p))
      .filter(Boolean);

    this.showModal = true;
  }

  manageProductStocks(product: any): void {
    this.router.navigate(['/admin/produit', product.id, 'stocks']);
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
    if (!this.form.categorie_id) {
      this.errorMessage = 'La catégorie est obligatoire.';
      return;
    }

    const unitId = this.form.unit_id ? Number(this.form.unit_id) : null;
    const selectedUnit = this.units.find((u: any) => u.id === unitId);

    const payload = {
      status: this.form.status,
      title: (this.form.title || '').trim(),
      short_description: (this.form.short_description || '').trim(),
      description: (this.form.description || '').trim(),
      commentaire: (this.form.commentaire || '').trim(),
      fabricant: (this.form.fabricant || '').trim(),
      num_serie: (this.form.num_serie || '').trim(),
      num_inventaire: (this.form.num_inventaire || '').trim(),
      model: (this.form.model || '').trim(),
      marque: (this.form.marque || '').trim(),
      seuil_min: Number(this.form.seuil_min || 0),
      reference: (this.form.reference || '').trim(),
      categorie_id: Number(this.form.categorie_id),
      purchase_price: this.form.purchase_price === null ? null : Number(this.form.purchase_price),
      unit_id: unitId,
      unit: selectedUnit?.name || '',
      supplier_ids: this.form.supplier_id ? [Number(this.form.supplier_id)] : [],
      photos: this.selectedPhotoFiles
    };

    if (!payload.title || !payload.reference) {
      this.errorMessage = 'Titre et référence sont obligatoires.';
      return;
    }
    this.errorMessage = '';

    const req$ = this.editingId
      ? this.stockService.updateProduct(this.editingId as number, payload)
      : this.stockService.createProduct(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Produit mis à jour !' : 'Produit créé !';
        this.closeModal();
        // this.loadOverview(); // Route n'existe pas dans l'API
        this.loadProducts();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = this.extractApiError(err, 'Impossible de sauvegarder le produit.');
      }
    });
  }

  remove(id: number): void {
    if (!confirm('Supprimer ce produit ?')) return;
    this.stockService.deleteProduct(id).subscribe({
      next: () => {
        this.successMessage = 'Produit supprimé !';
        // this.loadOverview(); // Route n'existe pas dans l'API
        this.loadProducts();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = this.extractApiError(err, 'Suppression impossible.');
      }
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form = this.createEmptyForm();
    this.selectedPhotoFiles = [];
    this.photoPreviewUrls = [];
    this.errorMessage = '';
  }

  /* ─── Barcode ─── */

  downloadBarcode(item: any): void {
    const value = item?.barcode_value || item?.reference || '';
    if (!value) {
      this.errorMessage = 'Aucune valeur de code-barres disponible.';
      return;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, value, {
      format: 'CODE128',
      displayValue: true,
      margin: 8,
      width: 1.6,
      height: 48
    });

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `barcode-${item.id}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  barcodeImage(value: string): string {
    const barcodeValue = (value || '').trim();
    if (!barcodeValue) return '';

    const cached = this.barcodeCache.get(barcodeValue);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    JsBarcode(canvas, barcodeValue, {
      format: 'CODE128',
      displayValue: false,
      margin: 2,
      width: 1.2,
      height: 30
    });

    const dataUrl = canvas.toDataURL('image/png');
    this.barcodeCache.set(barcodeValue, dataUrl);
    return dataUrl;
  }

  /* ─── Photo ─── */

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);

    if (!files.length) return;

    const maxBytes = 2 * 1024 * 1024;
    const nextFiles: File[] = [];
    const nextPreviewUrls: string[] = [];

    for (const file of files) {
      if (!file.type || !file.type.startsWith('image/')) {
        this.errorMessage = 'Veuillez choisir uniquement des fichiers image.';
        input.value = '';
        return;
      }
      if (file.size > maxBytes) {
        this.errorMessage = 'Chaque photo doit faire au maximum 2 Mo.';
        input.value = '';
        return;
      }
      nextFiles.push(file);
      nextPreviewUrls.push(URL.createObjectURL(file));
    }
    this.errorMessage = '';
    this.selectedPhotoFiles = [...this.selectedPhotoFiles, ...nextFiles];
    this.photoPreviewUrls = [...this.photoPreviewUrls, ...nextPreviewUrls];
    input.value = '';
  }

  photoUrl(path: string | null | undefined): string {
    if (!path) return 'assets/default-avatar.svg';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/+/, '');
    return `http://localhost:8000/storage/${cleanPath}`;
  }

  /* ─── Scan ─── */

  onScanSubmit(): void {
    const code = (this.scanCode || '').trim().toLowerCase();
    if (!code) {
      this.scanMessage = 'Scannez un code-barres.';
      this.scannedProduct = null;
      this.highlightedProductId = null;
      return;
    }

    const found = this.products.find((p: any) => {
      const barcode = String(p?.barcode_value || '').trim().toLowerCase();
      const ref = String(p?.reference || '').trim().toLowerCase();
      return code === barcode || code === ref;
    });

    if (!found) {
      this.scanMessage = 'Produit non trouvé pour ce code.';
      this.scannedProduct = null;
      this.highlightedProductId = null;
      return;
    }

    this.scanMessage = '';
    this.scannedProduct = found;
    this.highlightedProductId = found.id;
  }

  clearScan(): void {
    this.scanCode = '';
    this.scanMessage = '';
    this.scannedProduct = null;
    this.highlightedProductId = null;
  }

  /* ─── Filters & Pagination ─── */

  applyFilters(): void {
    this.pagination.page = 1;
    this.loadProducts();
  }

  clearFilters(): void {
    this.filters = {
      q: '',
      status: 'all',
      categorie_id: null,
      supplier_id: null,
      low_stock_only: false,
      out_of_stock_only: false
    };
    this.pagination.page = 1;
    this.loadProducts();
  }

  filterByCategory(categoryId: number | null): void {
    if (!categoryId) {
      return;
    }
    this.filters.categorie_id = categoryId;
    this.pagination.page = 1;
    this.loadProducts();
  }

  filterBySupplier(supplierId: number | null): void {
    if (!supplierId) {
      return;
    }
    this.filters.supplier_id = supplierId;
    this.pagination.page = 1;
    this.loadProducts();
  }

  prevPage(): void {
    if (this.pagination.page <= 1) return;
    this.pagination.page -= 1;
    this.loadProducts();
  }

  nextPage(): void {
    if (this.pagination.page >= this.pagination.last_page) return;
    this.pagination.page += 1;
    this.loadProducts();
  }

  getCategoryTitle(id: number | null): string {
    if (!id) return '-';
    const cat = this.flatCategories.find((c: any) => c.id === id);
    return cat ? cat.title : `#${id}`;
  }

  getStockStatus(p: any): string {
    if (p.stock_quantity <= 0) return 'rupture';
    if (p.seuil_min && p.stock_quantity <= p.seuil_min) return 'faible';
    return 'ok';
  }

  /* ─── Helpers ─── */

  private refreshScannedProduct(): void {
    if (!this.scannedProduct?.id) return;
    const found = this.products.find((p: any) => p.id === this.scannedProduct.id);
    this.scannedProduct = found || null;
    this.highlightedProductId = found ? found.id : null;
  }

  private extractApiError(err: any, fallback: string): string {
    if (!err) return fallback;
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
    const errors = err.errors;
    if (errors && typeof errors === 'object') {
      const firstField = Object.keys(errors)[0];
      const firstValue = firstField ? errors[firstField] : null;
      if (Array.isArray(firstValue) && firstValue.length) return String(firstValue[0]);
      if (typeof firstValue === 'string') return firstValue;
    }
    if (typeof err === 'object') {
      const topLevelField = Object.keys(err).find((key) => Array.isArray(err[key]));
      if (topLevelField) {
        const value = err[topLevelField];
        if (Array.isArray(value) && value.length) return String(value[0]);
      }
    }
    return fallback;
  }

  private flattenTree(nodes: any[], level = 0): { id: number; title: string; level: number; displayTitle: string }[] {
    const result: { id: number; title: string; level: number; displayTitle: string }[] = [];
    for (const node of nodes) {
      const prefix = level === 0 ? '' : '\u00A0\u00A0'.repeat(level) + '└ ';
      result.push({
        id: node.id,
        title: node.title,
        level: node.level || (level + 1),
        displayTitle: prefix + node.title
      });
      if (node.recursive_children && node.recursive_children.length) {
        result.push(...this.flattenTree(node.recursive_children, level + 1));
      }
    }
    return result;
  }

  getLocationDisplay(product: any): string {
    if (!product.warehouse_location_id) return '-';
    const location = product.warehouseLocation;
    if (!location) return 'Emplacement ' + product.warehouse_location_id;
    const room = location.room || {};
    const warehouse = room.warehouse || {};
    const parts = [warehouse.name || 'Dépôt', room.name || 'Salle', location.code || 'Emp.'];
    return parts.join(', ');
  }

  viewProductsByLocation(locationId: number | null): void {
    if (!locationId) return;
    this.router.navigate(['/admin/location', locationId, 'products']);
  }

  openSupplierDetails(supplierId: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!supplierId) return;
    this.isLoading = true;
    this.supplierService.getSupplier(supplierId).subscribe({
      next: (data) => {
        this.selectedSupplier = data;
        this.showSupplierDetailsModal = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading supplier details', err);
        this.isLoading = false;
        this.errorMessage = 'Erreur lors du chargement des détails du fournisseur';
        this.cdr.detectChanges();
      }
    });
  }

  closeSupplierDetails(): void {
    this.showSupplierDetailsModal = false;
    this.selectedSupplier = null;
    this.newReviewContent = '';
    this.newReviewRating = 5;
  }

  submitSupplierReview(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.selectedSupplier || !this.newReviewContent.trim()) return;

    this.isLoading = true;
    this.supplierService.addReview(this.selectedSupplier.id, {
      content: this.newReviewContent,
      rating: this.newReviewRating || 5
    }).subscribe({
      next: (review) => {
        if (this.selectedSupplier) {
          if (!this.selectedSupplier.reviews) this.selectedSupplier.reviews = [];
          this.selectedSupplier.reviews.unshift(review);
        }
        this.newReviewContent = '';
        this.newReviewRating = 5;
        this.isLoading = false;
        this.successMessage = 'Avis publié !';
        this.cdr.detectChanges();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error submitting review', err);
        this.errorMessage = 'Erreur lors de la publication de l\'avis';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
