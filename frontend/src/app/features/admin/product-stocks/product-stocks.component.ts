import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Modal properties
  showAddStockModal = false;
  editingStockId: number | null = null;

  newStockForm = {
    warehouse_location_id: '',
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

  activeSection: 'details' | 'stock' | 'documents' = 'stock';
  selectedPhotoIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private stockService: ProductStockService,
    private adminStockService: AdminStockService,
    private warehouseService: AdminWarehouseService
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
      }
    });
  }

  setSection(section: 'details' | 'stock' | 'documents'): void {
    this.activeSection = section;
    this.cdr.detectChanges();
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
      quantity: '',
      notes: '',
      supplier_id: ''
    };
    this.selectedWarehouseIdForForm = '';
    this.selectedRoomIdForForm = '';
  }

  saveStock(): void {
    if (!this.newStockForm.warehouse_location_id || !this.newStockForm.quantity) {
      this.errorMessage = 'Emplacement et quantité sont obligatoires.';
      return;
    }

    // Check if location is full
    const selectedLoc = this.locations.find((l: any) => l.id.toString() === this.newStockForm.warehouse_location_id.toString());
    if (selectedLoc && selectedLoc.capacity_units && selectedLoc.current_units >= selectedLoc.capacity_units) {
      this.errorMessage = 'Cet emplacement est plein (capacité maximale atteinte).';
      return;
    }

    if (!this.productId) {
      this.errorMessage = 'Produit non chargé.';
      return;
    }

    const payload = {
      warehouse_location_id: parseInt(this.newStockForm.warehouse_location_id),
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
        this.successMessage = this.editingStockId ? 'Stock mis à jour !' : 'Stock ajouté !';
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
    this.newStockForm = {
      warehouse_location_id: this.locations.find(l => l.code === stock.location_code)?.id.toString() || '',
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
}
