import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockMovementService } from '../../../services/stock-movement.service';
import { AdminWarehouseService } from '../services/admin-warehouse.service';
import { SupplierService } from '../../../core/services/supplier.service';

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-movements.component.html',
  styleUrls: ['./stock-movements.component.css']
})
export class StockMovementsComponent implements OnInit {
  movements: any[] = [];
  loading = false;
  message = '';
  selectedMovement: any = null;
  page = 1;
  perPage = 20;
  total = 0;
  lastPage = 1;
  filters: any = {
    status: '',
    movement_type: '',
    reference: '',
  };
  // create modal state
  creating = false;
  products: any[] = [];
  suppliers: any[] = [];

  warehouses: any[] = [];
  sourceRooms: any[] = [];
  sourceLocations: any[] = [];
  destRooms: any[] = [];
  destLocations: any[] = [];

  newMovement: any = {
    movement_type: 'out',
    reference: '',
    related_request_id: null,
    notes: '',
    supplier_id: null,

    source_kind: 'depot',
    source_warehouse_id: null,
    source_room_id: null,
    source_warehouse_location_id: null,

    destination_kind: 'local',
    destination_warehouse_id: null,
    destination_room_id: null,
    destination_warehouse_location_id: null,

    lines: [{ product_id: null, quantity: 1 }]
  };

  constructor(
    private svc: StockMovementService,
    private warehouseService: AdminWarehouseService,
    private supplierService: SupplierService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  loadProducts(): void {
    this.svc.getProducts().subscribe({
      next: (data: any) => { this.products = Array.isArray(data) ? data : []; },
      error: (err: any) => { console.error('Erreur produits', err); }
    });
  }

  load(): void {
    this.loading = true;
    this.svc.list({
      page: this.page,
      per_page: this.perPage,
      status: this.filters.status || undefined,
      movement_type: this.filters.movement_type || undefined,
      reference: this.filters.reference || undefined,
    }).subscribe({
      next: (data: any) => {
        const rows = Array.isArray(data) ? data : (data?.data ?? []);
        this.movements = Array.isArray(rows) ? rows : [];
        this.movements.forEach((m) => {
          m._productsSummary = this.buildProductsSummary(m);
        });
        this.total = Number(data?.total ?? this.movements.length);
        this.lastPage = Number(data?.last_page ?? 1);
        this.loading = false;
      },
      error: (err: any) => { console.error(err); this.message = 'Erreur'; this.loading = false; }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  prevPage(): void {
    if (this.page <= 1) return;
    this.page -= 1;
    this.load();
  }

  nextPage(): void {
    if (this.page >= this.lastPage) return;
    this.page += 1;
    this.load();
  }

  validate(m: any): void {
    if (!confirm('Valider ce mouvement ?')) return;
    this.svc.validate(m.id).subscribe({ next: () => this.load(), error: (e: any) => { console.error(e); alert('Erreur'); } });
  }

  cancel(m: any): void {
    if (!confirm('Annuler ce mouvement ?')) return;
    const reason = prompt("Motif d'annulation (optionnel) :") ?? undefined;
    this.svc.cancel(m.id, reason).subscribe({ next: () => this.load(), error: (e: any) => { console.error(e); alert('Erreur'); } });
  }

  openDetails(m: any): void {
    this.selectedMovement = null;
    this.svc.show(m.id).subscribe({
      next: (data: any) => { this.selectedMovement = data; },
      error: (err: any) => { console.error(err); alert('Erreur lors du chargement.'); }
    });
  }

  closeDetails(): void {
    this.selectedMovement = null;
  }

  openCreate(): void {
    this.creating = true;
    this.newMovement = {
      movement_type: 'out',
      reference: '',
      related_request_id: null,
      notes: '',
      supplier_id: null,

      source_kind: 'depot',
      source_warehouse_id: null,
      source_room_id: null,
      source_warehouse_location_id: null,

      destination_kind: 'local',
      destination_warehouse_id: null,
      destination_room_id: null,
      destination_warehouse_location_id: null,

      lines: [{ product_id: null, quantity: 1 }]
    };
    this.loadProducts();
    this.loadWarehouses();
    this.loadSuppliers();
  }

  closeCreate(): void {
    this.creating = false;
  }

  addLine(): void {
    this.newMovement.lines.push({ product_id: null, quantity: 1 });
  }

  removeLine(i: number): void {
    if (this.newMovement.lines.length <= 1) return;
    this.newMovement.lines.splice(i, 1);
  }

  submitCreate(): void {
    const validLines = (this.newMovement.lines || []).filter((l: any) => Number(l.product_id) > 0 && Number(l.quantity) >= 1);
    if (validLines.length === 0) { alert('Ajoutez au moins une ligne valide'); return; }

    if (this.newMovement.movement_type === 'in') {
      if (!Number(this.newMovement.supplier_id)) {
        alert('Selectionnez le fournisseur (livraison).');
        return;
      }
      if (!Number(this.newMovement.destination_warehouse_location_id)) {
        alert('Selectionnez le local/depot de destination (etage + salle).');
        return;
      }
    } else {
      if (!Number(this.newMovement.source_warehouse_location_id)) {
        alert('Selectionnez le depot source (etage + salle).');
        return;
      }
      if (!Number(this.newMovement.destination_warehouse_location_id)) {
        alert('Selectionnez le local de destination (etage + salle).');
        return;
      }
    }

    const payload = {
      movement_type: this.newMovement.movement_type,
      reference: this.newMovement.reference || undefined,
      related_request_id: this.newMovement.related_request_id || undefined,
      notes: this.newMovement.notes || undefined,
      supplier_id: this.newMovement.movement_type === 'in' ? Number(this.newMovement.supplier_id) : undefined,
      source_warehouse_location_id: this.newMovement.movement_type === 'out' ? Number(this.newMovement.source_warehouse_location_id) : undefined,
      destination_warehouse_location_id: Number(this.newMovement.destination_warehouse_location_id),
      lines: validLines.map((l: any) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }))
    };

    this.svc.create(payload).subscribe({
      next: () => { this.creating = false; this.load(); alert('Mouvement cree'); },
      error: (err) => { console.error(err); alert('Erreur creation'); }
    });
  }

  stockWarning(line: any): string {
    if (this.newMovement.movement_type !== 'out') return '';
    const productId = Number(line?.product_id);
    const qty = Number(line?.quantity);
    if (!productId || !qty) return '';
    const product = this.products.find(p => Number(p?.id) === productId);
    const available = Number(product?.stock_quantity ?? 0);
    if (qty > available) return `Stock insuffisant (dispo: ${available})`;
    return '';
  }

  get sourceWarehouses(): any[] {
    const kind = this.newMovement.source_kind || 'depot';
    return this.warehouses.filter(w => (w.kind || 'depot') === kind);
  }

  get destinationWarehouses(): any[] {
    const kind = this.newMovement.destination_kind || 'local';
    return this.warehouses.filter(w => (w.kind || 'depot') === kind);
  }

  onMovementTypeChange(): void {
    if (this.newMovement.movement_type === 'in') {
      this.newMovement.source_kind = 'depot';
      this.newMovement.source_warehouse_id = null;
      this.newMovement.source_room_id = null;
      this.newMovement.source_warehouse_location_id = null;
      this.sourceRooms = [];
      this.sourceLocations = [];

      if (!this.newMovement.destination_kind) {
        this.newMovement.destination_kind = 'depot';
      }
    } else {
      this.newMovement.destination_kind = this.newMovement.destination_kind || 'local';
      this.newMovement.source_kind = this.newMovement.source_kind || 'depot';
    }
  }

  onSourceWarehouseChange(): void {
    this.newMovement.source_room_id = null;
    this.newMovement.source_warehouse_location_id = null;
    this.sourceLocations = [];

    const warehouseId = Number(this.newMovement.source_warehouse_id);
    if (!warehouseId) { this.sourceRooms = []; return; }

    this.warehouseService.listRooms(warehouseId, null, 200, 'active').subscribe({
      next: (res: any) => { this.sourceRooms = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []); },
      error: () => { this.sourceRooms = []; }
    });
  }

  onSourceRoomChange(): void {
    this.newMovement.source_warehouse_location_id = null;
    const roomId = Number(this.newMovement.source_room_id);
    if (!roomId) { this.sourceLocations = []; return; }

    this.warehouseService.listLocations(roomId, null, 200, 'active').subscribe({
      next: (res: any) => { this.sourceLocations = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []); },
      error: () => { this.sourceLocations = []; }
    });
  }

  onDestinationWarehouseChange(): void {
    this.newMovement.destination_room_id = null;
    this.newMovement.destination_warehouse_location_id = null;
    this.destLocations = [];

    const warehouseId = Number(this.newMovement.destination_warehouse_id);
    if (!warehouseId) { this.destRooms = []; return; }

    this.warehouseService.listRooms(warehouseId, null, 200, 'active').subscribe({
      next: (res: any) => { this.destRooms = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []); },
      error: () => { this.destRooms = []; }
    });
  }

  onDestinationRoomChange(): void {
    this.newMovement.destination_warehouse_location_id = null;
    const roomId = Number(this.newMovement.destination_room_id);
    if (!roomId) { this.destLocations = []; return; }

    this.warehouseService.listLocations(roomId, null, 200, 'active').subscribe({
      next: (res: any) => { this.destLocations = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []); },
      error: () => { this.destLocations = []; }
    });
  }

  private loadWarehouses(): void {
    this.warehouseService.listWarehouses(null, 200, 'active').subscribe({
      next: (res: any) => { this.warehouses = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []); },
      error: () => { this.warehouses = []; }
    });
  }

  private loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (res: any) => { this.suppliers = Array.isArray(res) ? res : []; },
      error: () => { this.suppliers = []; }
    });
  }

  private buildProductsSummary(movement: any): { short: string; full: string } {
    const lines = Array.isArray(movement?.lines) ? movement.lines : [];
    if (lines.length === 0) {
      return { short: '-', full: '-' };
    }

    const byProduct = new Map<number, { title: string; qty: number }>();
    lines.forEach((line: any) => {
      const productId = Number(line?.product_id ?? line?.product?.id);
      if (!productId) return;
      const title = String(line?.product?.title ?? `Produit #${productId}`);
      const qty = Number(line?.quantity ?? 0);
      const current = byProduct.get(productId);
      if (current) current.qty += qty;
      else byProduct.set(productId, { title, qty });
    });

    const items = Array.from(byProduct.values())
      .filter((x) => x.qty > 0)
      .map((x) => `${x.title} x${x.qty}`);

    if (items.length === 0) {
      return { short: '-', full: '-' };
    }

    const full = items.join(', ');
    const shortItems = items.slice(0, 2);
    const more = items.length - shortItems.length;
    const short = more > 0 ? `${shortItems.join(', ')} +${more}` : shortItems.join(', ');

    return { short, full };
  }
}
