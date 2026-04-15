import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockMovementService } from '../../../services/stock-movement.service';
import { AdminWarehouseService } from '../services/admin-warehouse.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { AdminStockService } from '../services/admin-stock.service';
import { environment } from '../../../../environments/environment';

const MOTIFS_IN  = ['Achat', 'Retour fournisseur', 'Don', 'Inventaire (ajustement)', 'Transfert entrant', 'Autre'];
const MOTIFS_OUT = ['Consommation interne', 'Livraison client', 'Retour client', 'Transfert sortant', 'Perte/Casse', 'Inventaire (ajustement)', 'Autre'];
const MOTIFS_TRANSFER = ['Réorganisation dépôt', 'Transfert inter-sites', 'Optimisation stock', 'Autre'];

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-movements.component.html',
  styleUrls: ['./stock-movements.component.css']
})
export class StockMovementsComponent implements OnInit {

  /* ─── List state ─── */
  movements: any[] = [];
  loading = false;
  message = '';
  selectedMovement: any = null;
  page = 1;
  perPage = 20;
  total = 0;
  lastPage = 1;
  filters: any = { status: '', movement_type: '', reference: '' };

  /* ─── Reference data ─── */
  products: any[] = [];
  suppliers: any[] = [];
  supplierContacts: any[] = [];
  warehouses: any[] = [];

  /* ─── Source (cascading) ─── */
  sourceRooms: any[] = [];
  sourceLocations: any[] = [];

  /* ─── Destination (cascading) ─── */
  destRooms: any[] = [];
  destLocations: any[] = [];

  /* ─── Motif options per type ─── */
  readonly motifsIn       = MOTIFS_IN;
  readonly motifsOut      = MOTIFS_OUT;
  readonly motifsTransfer = MOTIFS_TRANSFER;

  /* ─── Create modal state ─── */
  creating = false;
  today = new Date().toISOString().slice(0, 10);

  newMovement: any = this.emptyForm();
  selectedFileName: string | null = null;

  private emptyForm(): any {
    return {
      movement_type: 'in',
      reference: '',
      motif: '',
      destination_text: '',
      notes: '',
      date: this.today,
      // Entrée fields
      supplier_id: null,
      supplier_contact_id: null,
      // Source location (Sortie / Transfert)
      source_warehouse_id: null,
      source_room_id: null,
      source_warehouse_location_id: null,
      // Destination location (Entrée / Transfert)
      destination_warehouse_id: null,
      destination_room_id: null,
      destination_warehouse_location_id: null,
      // Document
      document: null as File | null,
      // Lines
      lines: [{ product_id: null, quantity: 1 }]
    };
  }

  constructor(
    private svc: StockMovementService,
    private warehouseService: AdminWarehouseService,
    private supplierService: SupplierService,
    private stockService: AdminStockService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.load();
  }

  /* ────────────────── LIST ────────────────── */

  load(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loading = true;
    this.svc.list({
      page: this.page, per_page: this.perPage,
      status: this.filters.status || undefined,
      movement_type: this.filters.movement_type || undefined,
      reference: this.filters.reference || undefined,
    }).subscribe({
      next: (data: any) => {
        const rows = Array.isArray(data) ? data : (data?.data ?? []);
        this.movements = rows.map((m: any) => ({ ...m, _summary: this.buildSummary(m) }));
        this.total = Number(data?.total ?? this.movements.length);
        this.lastPage = Number(data?.last_page ?? 1);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.message = 'Erreur de chargement.'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applyFilters(): void { this.page = 1; this.load(); }
  prevPage(): void { if (this.page > 1) { this.page--; this.load(); } }
  nextPage(): void { if (this.page < this.lastPage) { this.page++; this.load(); } }

  validate(m: any): void {
    if (!confirm('Valider et exécuter ce mouvement de stock ?')) return;
    this.svc.validate(m.id).subscribe({ next: () => this.load(), error: () => alert('Erreur lors de la validation.') });
  }

  cancel(m: any): void {
    if (!confirm('Annuler ce mouvement ?')) return;
    const reason = prompt("Motif d'annulation (optionnel) :") ?? undefined;
    this.svc.cancel(m.id, reason).subscribe({ next: () => this.load(), error: () => alert('Erreur.') });
  }

  openDetails(m: any): void {
    this.selectedMovement = null;
    this.svc.show(m.id).subscribe({
      next: (data: any) => { this.selectedMovement = data; this.cdr.detectChanges(); },
      error: () => alert('Erreur de chargement.')
    });
  }

  closeDetails(): void { this.selectedMovement = null; this.cdr.detectChanges(); }

  /* ────────────────── OPEN CREATE FORM ────────────────── */

  openCreate(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.creating = true;
    this.loading = false; // Ensure button is not disabled
    this.message = ''; // Clear previous errors
    this.today = new Date().toISOString().slice(0, 10);
    this.newMovement = this.emptyForm();
    // reset cascades
    this.sourceRooms = []; this.sourceLocations = [];
    this.destRooms   = []; this.destLocations   = [];
    this.supplierContacts = [];
    // load reference data
    this.loadProducts();
    this.loadWarehouses();
    this.loadSuppliers();
  }

  closeCreate(): void { this.creating = false; this.cdr.detectChanges(); }

  /* ────────────────── REFERENCE DATA ────────────────── */

  private loadProducts(): void {
    this.stockService.listProducts({ per_page: 500, status: 'active' }).subscribe({
      next: (d: any) => { this.products = Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []); this.cdr.detectChanges(); },
      error: () => this.products = []
    });
  }

  private loadWarehouses(): void {
    this.warehouseService.listWarehouses(null, 200, 'active').subscribe({
      next: (r: any) => { this.warehouses = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []); this.cdr.detectChanges(); },
      error: () => this.warehouses = []
    });
  }

  private loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (r: any) => { this.suppliers = Array.isArray(r) ? r : []; this.cdr.detectChanges(); },
      error: () => this.suppliers = []
    });
  }

  /* ────────────────── SUPPLIER CONTACTS ────────────────── */

  onSupplierChange(): void {
    this.newMovement.supplier_contact_id = null;
    this.supplierContacts = [];
    const id = Number(this.newMovement.supplier_id);
    if (!id) return;
    // Load contacts via supplier endpoint (contacts sub-resource)
    this.supplierService.getSupplierContacts(id).subscribe({
      next: (r: any) => { this.supplierContacts = Array.isArray(r) ? r : []; this.cdr.detectChanges(); },
      error: () => this.supplierContacts = []
    });
  }

  /* ────────────────── CASCADING LOCATION: SOURCE ────────────────── */

  onSourceWarehouseChange(): void {
    this.newMovement.source_room_id = null;
    this.newMovement.source_warehouse_location_id = null;
    this.sourceRooms = []; this.sourceLocations = [];
    const id = Number(this.newMovement.source_warehouse_id);
    if (!id) return;
    this.warehouseService.listRooms(id, null, 200, 'active').subscribe({
      next: (r: any) => { this.sourceRooms = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []); this.cdr.detectChanges(); },
      error: () => this.sourceRooms = []
    });
  }

  onSourceRoomChange(): void {
    this.newMovement.source_warehouse_location_id = null;
    this.sourceLocations = [];
    const id = Number(this.newMovement.source_room_id);
    if (!id) return;
    this.warehouseService.listLocations(id, null, 200, 'active').subscribe({
      next: (r: any) => { this.sourceLocations = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []); this.cdr.detectChanges(); },
      error: () => this.sourceLocations = []
    });
  }

  /* ────────────────── CASCADING LOCATION: DESTINATION ────────────────── */

  onDestWarehouseChange(): void {
    this.newMovement.destination_room_id = null;
    this.newMovement.destination_warehouse_location_id = null;
    this.destRooms = []; this.destLocations = [];
    const id = Number(this.newMovement.destination_warehouse_id);
    if (!id) return;
    this.warehouseService.listRooms(id, null, 200, 'active').subscribe({
      next: (r: any) => { this.destRooms = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []); this.cdr.detectChanges(); },
      error: () => this.destRooms = []
    });
  }

  onDestRoomChange(): void {
    this.newMovement.destination_warehouse_location_id = null;
    this.destLocations = [];
    const id = Number(this.newMovement.destination_room_id);
    if (!id) return;
    this.warehouseService.listLocations(id, null, 200, 'active').subscribe({
      next: (r: any) => { this.destLocations = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []); this.cdr.detectChanges(); },
      error: () => this.destLocations = []
    });
  }

  /* ────────────────── LINES ────────────────── */

  addLine(): void { this.newMovement.lines.push({ product_id: null, quantity: 1 }); }
  removeLine(i: number): void { if (this.newMovement.lines.length > 1) this.newMovement.lines.splice(i, 1); }

  stockWarning(line: any): string {
    if (this.newMovement.movement_type === 'in') return '';
    const product = this.products.find(p => Number(p?.id) === Number(line?.product_id));
    if (!product) return '';
    const available = Number(product?.stock_quantity ?? 0);
    return Number(line.quantity) > available ? `⚠ Stock dispo: ${available}` : '';
  }

  onDocumentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.newMovement.document = input.files[0];
      this.selectedFileName = input.files[0].name;
    } else {
      this.newMovement.document = null;
      this.selectedFileName = null;
    }
    this.cdr.detectChanges();
  }

  /* ────────────────── SUBMIT ────────────────── */

  submitCreate(): void {
    this.message = '';
    const validLines = (this.newMovement.lines || []).filter((l: any) => Number(l.product_id) > 0 && Number(l.quantity) >= 1);
    if (validLines.length === 0) { this.message = 'Ajoutez au moins un produit valide.'; return; }
    
    this.loading = true;
    this.cdr.detectChanges();

    const type = this.newMovement.movement_type;

    if (type === 'in' && !Number(this.newMovement.supplier_id)) {
      this.message = 'Sélectionnez le fournisseur.'; 
      this.loading = false;
      return; 
    }
    if ((type === 'out' || type === 'transfer') && !Number(this.newMovement.source_warehouse_location_id)) {
      this.message = 'Sélectionnez l\'emplacement source (dépôt → salle → emplacement).'; 
      this.loading = false;
      return; 
    }
    if ((type === 'in' || type === 'transfer') && !Number(this.newMovement.destination_warehouse_location_id)) {
      this.message = 'Sélectionnez l\'emplacement de destination.'; 
      this.loading = false;
      return; 
    }
    if (type === 'transfer' && Number(this.newMovement.source_warehouse_location_id) === Number(this.newMovement.destination_warehouse_location_id)) {
      this.message = 'La destination doit être différente de la source.';
      this.loading = false;
      return;
    }

    const form = new FormData();
    form.append('movement_type', type);
    if (this.newMovement.reference)        form.append('reference', this.newMovement.reference);
    if (this.newMovement.motif)            form.append('motif', this.newMovement.motif);
    if (this.newMovement.destination_text) form.append('destination_text', this.newMovement.destination_text);
    if (this.newMovement.notes)            form.append('notes', this.newMovement.notes);

    if (type === 'in' || type === 'transfer') {
      if (this.newMovement.supplier_id)         form.append('supplier_id', String(this.newMovement.supplier_id));
      if (this.newMovement.supplier_contact_id) form.append('supplier_contact_id', String(this.newMovement.supplier_contact_id));
      if (this.newMovement.destination_warehouse_location_id)
        form.append('destination_warehouse_location_id', String(this.newMovement.destination_warehouse_location_id));
    }
    if (type === 'out' || type === 'transfer') {
      if (this.newMovement.source_warehouse_location_id)
        form.append('source_warehouse_location_id', String(this.newMovement.source_warehouse_location_id));
    }
    if (type === 'out' && this.newMovement.destination_text) {
      // For sortie, destination is a free text field (external department or person)
    }

    if (this.newMovement.document) {
      // Determine field based on type: Entrada -> in_image, others -> out_image
      const fieldName = (type === 'in') ? 'in_image' : 'out_image';
      form.append(fieldName, this.newMovement.document);
    }

    validLines.forEach((l: any, i: number) => {
      form.append(`lines[${i}][product_id]`, String(l.product_id));
      form.append(`lines[${i}][quantity]`, String(l.quantity));
    });

    this.svc.create(form).subscribe({
      next: () => {
        this.creating = false;
        this.loading = false;
        this.selectedFileName = null;
        this.message = 'Mouvement créé avec succès !';
        this.load();
        setTimeout(() => this.message = '', 4000);
      },
      error: (err: any) => {
        this.loading = false;
        const errors = err?.error?.errors;
        if (errors) {
          this.message = Object.values(errors).flat().join(' | ');
        } else {
          this.message = err?.error?.message || 'Erreur lors de la création.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  /* ────────────────── HELPERS ────────────────── */

  typeLabel(type: string): string {
    return type === 'in' ? 'Entrée' : type === 'out' ? 'Sortie' : type === 'transfer' ? 'Transfert' : type;
  }

  typeClass(type: string): string {
    return type === 'in' ? 'tag-success' : type === 'out' ? 'tag-danger' : 'tag-info';
  }

  statusClass(status: string): string {
    switch (status) {
      case 'executed':  return 'tag-success';
      case 'cancelled': return 'tag-danger';
      case 'validated': return 'tag-info';
      default:          return 'tag-neutral';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'draft':     return 'Brouillon';
      case 'validated': return 'Validé';
      case 'executed':  return 'Exécuté';
      case 'cancelled': return 'Annulé';
      default:          return status;
    }
  }

  locationLabel(loc: any): string {
    if (!loc) return '—';
    const wh   = loc?.room?.warehouse?.name ?? '';
    const room = loc?.room?.name ?? '';
    const name = loc?.name ?? '';
    return [wh, room, name].filter(Boolean).join(' › ');
  }

  getDocumentUrl(path: string): string {
    if (!path) return '#';
    const clean = path.replace(/^[/\\]+/, '').replace(/^storage\//, '');
    return `/api/docs/${clean}`;
  }

  private buildSummary(movement: any): { short: string; full: string } {
    const lines = Array.isArray(movement?.lines) ? movement.lines : [];
    if (!lines.length) return { short: '—', full: '—' };
    const items = lines
      .map((l: any) => `${l?.product?.title ?? `#${l?.product_id}`} ×${l?.quantity}`)
      .filter(Boolean);
    const full  = items.join(', ');
    const short = items.length > 2 ? items.slice(0, 2).join(', ') + ` +${items.length - 2}` : full;
    return { short, full };
  }
}
