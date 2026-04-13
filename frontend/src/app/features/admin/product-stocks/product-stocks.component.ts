import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProductStockService } from '../services/product-stock.service';
import { AdminStockService } from '../services/admin-stock.service';
import { AdminWarehouseService } from '../services/admin-warehouse.service';

@Component({
  selector: 'app-product-stocks',
  standalone: false,
  templateUrl: './product-stocks.component.html',
  styleUrls: ['./product-stocks.component.css']
})
export class ProductStocksComponent implements OnInit {
  productId: number | null = null;
  product: any = null;
  stocks: any[] = [];
  locations: any[] = [];
  allWarehouses: any[] = [];
  allRooms: any[] = [];
  allCabinets: any[] = [];

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Modal properties
  showAddStockModal = false;
  editingStockId: number | null = null;

  newStockForm = {
    warehouse_location_id: '',
    cabinet_id: '',
    quantity: '',
    notes: '',
    supplier_id: ''
  };

  productSuppliers: any[] = [];

  totalStock: any = {
    product_name: '',
    total_quantity: 0,
    is_in_stock: false,
    details: []
  };

  warehousesAvailability: any[] = [];
  selectedWarehouseId: number | null = null;
  selectedWarehouseIdForForm: string = '';
  selectedRoomIdForForm: string = '';
  storageTargetForForm: 'location' | 'cabinet' = 'location';

  activeSection: 'details' | 'stock' | 'documents' | 'images' = 'stock';
  selectedPhotoIndex = 0;
  photoUploadInProgress = false;
  productDocuments: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private stockService: ProductStockService,
    private adminStockService: AdminStockService,
    private warehouseService: AdminWarehouseService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.route.params.subscribe(params => {
      this.productId = params['productId'];
      if (this.productId) {
        this.activeSection = 'stock';
        this.loadProductDetails();
        this.loadStocks();
        this.loadWarehouses();
        this.loadRooms();
        this.loadLocations();
        this.loadCabinets();
        this.loadDocuments();
      }
    });
  }

  setSection(section: 'details' | 'stock' | 'documents' | 'images'): void {
    this.activeSection = section;
    this.cdr.detectChanges();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length || !this.productId) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Veuillez choisir une image.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.errorMessage = 'Image trop lourde (max 2 Mo).';
      return;
    }

    this.photoUploadInProgress = true;
    this.errorMessage = '';
    const payload = this.buildUpdatePayload();
    (payload as any).photos = [file];

    this.adminStockService.updateProduct(this.productId, payload).subscribe({
      next: () => {
        this.successMessage = 'Photo mise à jour.';
        this.photoUploadInProgress = false;
        this.loadProductDetails();
        this.setSection('images');
        setTimeout(() => this.successMessage = '', 2000);
      },
      error: (err) => {
        this.errorMessage = this.extractApiError(err, 'Impossible de mettre à jour la photo.');
        this.photoUploadInProgress = false;
      }
    });
  }

  setDefaultPhoto(photoPath: string): void {
    if (!this.productId) return;
    this.photoUploadInProgress = true;
    const payload = this.buildUpdatePayload();
    (payload as any).photo = photoPath;

    this.adminStockService.updateProduct(this.productId, payload).subscribe({
      next: () => {
        this.successMessage = 'Image par défaut mise à jour.';
        this.photoUploadInProgress = false;
        this.loadProductDetails();
        setTimeout(() => this.successMessage = '', 2000);
      },
      error: (err) => {
        this.errorMessage = this.extractApiError(err, 'Impossible de définir l\'image par défaut.');
        this.photoUploadInProgress = false;
      }
    });
  }

  private buildUpdatePayload(): any {
    const p: any = this.product || {};
    return {
      status: p.status || 'active',
      title: p.title || '',
      short_description: p.short_description || '',
      description: p.description || '',
      commentaire: p.commentaire || '',
      fabricant: p.fabricant || '',
      num_serie: p.num_serie || '',
      num_inventaire: p.num_inventaire || '',
      model: p.model || '',
      marque: p.marque || '',
      seuil_min: p.seuil_min ?? 0,
      reference: p.reference || '',
      categorie_id: p.categorie_id || p.category?.id,
      stock_quantity: p.stock_quantity ?? 0,
      purchase_price: p.purchase_price ?? null,
      sale_price: p.sale_price ?? null,
      unit_id: p.unit_id || p.unit?.id || null,
      unit: p.unit?.name || p.unit || '',
      location: p.location || '',
      warehouse_location_id: p.warehouse_location_id || null,
      supplier_ids: Array.isArray(p.suppliers) ? p.suppliers.map((s: any) => s.id) : [],
    };
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
    return fallback;
  }

  getProductPhotos(): any[] {
    const p = this.product as any;
    if (!p) return [];
    if (Array.isArray(p.photos) && p.photos.length) return p.photos;
    if (p.photo) return [{ path: p.photo }];
    return [];
  }

  getSelectedPhotoUrl(): string {
    const photos = this.getProductPhotos();
    const idx = Math.max(0, Math.min(this.selectedPhotoIndex, photos.length - 1));
    const item = photos[idx];
    const path = item?.path || item?.image_path || item?.url || '';
    if (!path) return 'assets/images/placeholder-product.png';
    if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))) return path;
    return `http://localhost:8000/storage/${path}`;
  }

  // Documents liés au produit
  loadDocuments(): void {
    if (!isPlatformBrowser(this.platformId) || !this.productId) return;
    this.http.get(`/api/admin/documents`).subscribe({
      next: (docs: any) => {
        const arr = Array.isArray(docs) ? docs : [];
        const title = (this.product?.title || '').toString().toLowerCase();
        this.productDocuments = arr.filter((d: any) => {
          if (this.productId && d.product_id === this.productId) return true;
          const lines = Array.isArray(d.ocr_lines) ? d.ocr_lines : [];
          return title && lines.some((l: any) => (l.title || '').toString().toLowerCase().includes(title));
        });
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  downloadDoc(doc: any): void {
    const path = doc?.path;
    if (!path) return;
    const url = 'http://localhost:8000/storage/' + path;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc?.title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  getPhotoUrl(path: string | null | undefined): string {
    if (!path) return 'assets/images/placeholder-product.png';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `http://localhost:8000/storage/${path}`;
  }

  unitLabel(): string {
    const unit = (this.product as any)?.unit;
    if (!unit) return '—';
    if (typeof unit === 'object') return unit.name || '—';
    return unit || '—';
  }

  selectPhoto(index: number): void {
    this.selectedPhotoIndex = index;
    this.cdr.detectChanges();
  }

  loadProductDetails(): void {
    if (!this.productId) return;

    this.adminStockService.getProduct(this.productId).subscribe({
      next: (res: any) => {
        this.product = res.data || res;
        this.productSuppliers = this.product.suppliers || [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = 'Impossible de charger le produit.';
        this.cdr.detectChanges();
      }
    });
  }

  loadStocks(): void {
    if (!this.productId) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.stockService.getTotalStock(this.productId).subscribe({
      next: (res: any) => {
        this.totalStock = res;
        this.stocks = res.details || [];
        this.warehousesAvailability = res.warehouses_availability || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = 'Impossible de charger les stocks.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadWarehouses(): void {
    this.warehouseService.listWarehouses(null, 100).subscribe({
      next: (res: any) => {
        this.allWarehouses = res.data || res;
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Erreur chargement dépôts:', err)
    });
  }

  loadRooms(): void {
    this.warehouseService.listRooms(null, null, 500).subscribe({
      next: (res: any) => {
        this.allRooms = res.data || res;
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Erreur chargement salles:', err)
    });
  }

  loadLocations(): void {
    this.warehouseService.listLocations(null, null, 1000).subscribe({
      next: (res: any) => {
        this.locations = res.data || (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur chargement emplacements:', err);
      }
    });
  }

  loadCabinets(): void {
    this.warehouseService.listCabinets(null, null, 1000).subscribe({
      next: (res: any) => {
        this.allCabinets = res.data || (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Erreur chargement armoires:', err)
    });
  }

  openAddStockModal(warehouseId?: number): void {
    this.resetForm();
    this.editingStockId = null;
    if (warehouseId) {
      this.selectedWarehouseIdForForm = warehouseId.toString();
    }
    this.showAddStockModal = true;
  }

  closeAddStockModal(): void {
    this.showAddStockModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newStockForm = {
      warehouse_location_id: '',
      cabinet_id: '',
      quantity: '',
      notes: '',
      supplier_id: ''
    };
    this.selectedWarehouseIdForForm = '';
    this.selectedRoomIdForForm = '';
    this.storageTargetForForm = 'location';
  }

  saveStock(): void {
    const hasStorage = this.storageTargetForForm === 'cabinet'
      ? !!this.newStockForm.cabinet_id
      : !!this.newStockForm.warehouse_location_id;

    if (!hasStorage || !this.newStockForm.quantity) {
      this.errorMessage = 'Emplacement ou armoire et quantite sont obligatoires.';
      return;
    }

    const selectedLoc = this.storageTargetForForm === 'location'
      ? this.locations.find((l: any) => l.id.toString() === this.newStockForm.warehouse_location_id.toString())
      : null;
    if (selectedLoc && selectedLoc.capacity_units && selectedLoc.current_units >= selectedLoc.capacity_units) {
      this.errorMessage = 'Cet emplacement est plein (capacite maximale atteinte).';
      return;
    }

    if (!this.productId) {
      this.errorMessage = 'Produit non charge.';
      return;
    }

    const payload = {
      warehouse_location_id: this.storageTargetForForm === 'location' && this.newStockForm.warehouse_location_id
        ? parseInt(this.newStockForm.warehouse_location_id)
        : null,
      cabinet_id: this.storageTargetForForm === 'cabinet' && this.newStockForm.cabinet_id
        ? parseInt(this.newStockForm.cabinet_id)
        : null,
      quantity: parseInt(this.newStockForm.quantity),
      notes: this.newStockForm.notes,
      supplier_id: this.newStockForm.supplier_id ? parseInt(this.newStockForm.supplier_id) : null
    };

    this.errorMessage = '';

    const req$ = this.editingStockId
      ? this.stockService.updateStock(this.editingStockId, payload)
      : this.stockService.addStock(this.productId, payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingStockId ? 'Stock mis a jour !' : 'Stock ajoute !';
        this.closeAddStockModal();
        this.loadStocks();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Erreur de sauvegarde.';
        this.cdr.detectChanges();
      }
    });
  }

  editStock(stock: any): void {
    this.editingStockId = stock.id;
    this.storageTargetForForm = stock.storage_type === 'cabinet' ? 'cabinet' : 'location';

    const room = this.allRooms.find((r: any) => r.name === stock.room);
    if (room) {
      this.selectedRoomIdForForm = room.id.toString();
      this.selectedWarehouseIdForForm = room.warehouse_id?.toString() || '';
    }

    this.newStockForm = {
      warehouse_location_id: this.storageTargetForForm === 'location'
        ? this.locations.find(l => l.code === stock.location_code)?.id.toString() || ''
        : '',
      cabinet_id: this.storageTargetForForm === 'cabinet'
        ? this.allCabinets.find((c: any) => c.code === stock.location_code)?.id.toString() || ''
        : '',
      quantity: stock.quantity.toString(),
      notes: stock.notes || '',
      supplier_id: stock.supplier_id?.toString() || ''
    };
    this.showAddStockModal = true;
  }

  deleteStock(stockId: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce stock ?')) return;

    this.stockService.deleteStock(stockId).subscribe({
      next: () => {
        this.successMessage = 'Stock supprimé !';
        this.loadStocks();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Impossible de supprimer ce stock.';
        this.cdr.detectChanges();
      }
    });
  }

  getStockStatus(): string {
    if (this.totalStock.is_in_stock) {
      return `En stock (${this.totalStock.total_quantity} unités)`;
    }
    return 'Rupture de stock';
  }

  getStockStatusClass(): string {
    return this.totalStock.is_in_stock ? 'in-stock' : 'out-of-stock';
  }

  getLocationLabel(loc: any): string {
    const warehouse = loc.room?.warehouse?.name || 'Dépôt';
    const room = loc.room?.name || 'Salle';
    return `${warehouse}, ${room}, ${loc.code}`;
  }

  isLocationFull(loc: any): boolean {
    if (!loc.capacity_units) return false;
    return (loc.current_units || 0) >= loc.capacity_units;
  }

  toggleDepot(wh: any): void {
    if (this.selectedWarehouseId === wh.warehouse_id) {
      this.selectedWarehouseId = null;
    } else {
      this.selectedWarehouseId = wh.warehouse_id;
    }
    this.cdr.detectChanges();
  }

  getStocksForWarehouse(warehouseId: number): any[] {
    return this.stocks.filter(s => s.warehouse_id === warehouseId);
  }

  getWarehousesFromLocations(): any[] {
    return this.allWarehouses.sort((a, b) => a.name.localeCompare(b.name));
  }

  getRoomsForWarehouse(): any[] {
    if (!this.selectedWarehouseIdForForm) return [];
    return this.allRooms
      .filter(room => room.warehouse_id.toString() === this.selectedWarehouseIdForForm)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getLocationsForRoom(): any[] {
    if (!this.selectedRoomIdForForm) return [];
    return this.locations
      .filter(loc => loc.room_id.toString() === this.selectedRoomIdForForm)
      .sort((a, b) => a.code.localeCompare(b.code));
  }


  getCabinetsForRoom(): any[] {
    if (!this.selectedRoomIdForForm) return [];
    return this.allCabinets
      .filter(cabinet => cabinet.room_id.toString() === this.selectedRoomIdForForm)
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  onWarehouseFormChange(): void {
    this.selectedRoomIdForForm = '';
    this.newStockForm.warehouse_location_id = '';
    this.newStockForm.cabinet_id = '';
  }

  onRoomFormChange(): void {
    this.newStockForm.warehouse_location_id = '';
    this.newStockForm.cabinet_id = '';
  }

  setStorageTarget(target: 'location' | 'cabinet'): void {
    this.storageTargetForForm = target;
    if (target === 'location') {
      this.newStockForm.cabinet_id = '';
    } else {
      this.newStockForm.warehouse_location_id = '';
    }
  }
}
