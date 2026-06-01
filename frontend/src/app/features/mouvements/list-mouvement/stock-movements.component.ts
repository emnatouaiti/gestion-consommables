import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockMovementService } from '../../../core/services/stock-movement.service';
import { AdminWarehouseService } from '../../../core/services/admin-warehouse.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { AdminUsersService } from '../../../core/services/admin-users.service';
import { AdminStockService } from '../../../core/services/admin-stock.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

const MOTIFS_IN  = ['Achat', 'Don', 'Inventaire (ajustement)', 'Transfert entrant', 'Autre'];
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
  readonly perPageOptions = [5, 10, 20];
  total = 0;
  lastPage = 1;
  filters: any = { status: '', movement_type: '', reference: '' };

  /* ─── Reference data ─── */
  products: any[] = [];
  suppliers: any[] = [];
  supplierContacts: any[] = [];
  warehouses: any[] = [];
  allUsers: any[] = [];
  filteredUsers: any[] = [];
  siegeOptions: string[] = ['Charguia_II_Ariana', 'Mohamed_V_Tunis', 'Kheireddine_Pacha_Tunis'];

  /* ─── Source (cascading) ─── */
  sourceRooms: any[] = [];
  sourceLocations: any[] = [];
  sourceCabinets: any[] = [];
  mergedSourceOptions: any[] = [];

  /* ─── Destination (cascading) ─── */
  destRooms: any[] = [];
  destLocations: any[] = [];
  destCabinets: any[] = [];
  mergedDestOptions: any[] = [];

  /* ─── Motif options per type ─── */
  readonly motifsIn       = MOTIFS_IN;
  readonly motifsOut      = MOTIFS_OUT;
  readonly motifsTransfer = MOTIFS_TRANSFER;

  /* ─── Create modal state ─── */
  creating = false;
  today = new Date().toISOString().slice(0, 10);

  newMovement: any = this.emptyForm();
  selectedFileName: string | null = null;

  /* ─── Decision Modal state ─── */
  approvingMovement: any = null;
  rejectionMode = false;
  responseNotes = '';
  submittingDecision = false;

  /* ─── Confirmation Modal state ─── */
  confirmationModal: any = null;
  confirmationCallback: (() => void) | null = null;
  confirmationInProgress = false;

  private emptyForm(): any {
    return {
      movement_type: 'in',
      reference: '',
      motif: '',
      destination_text: '',
      destination_siege: '',
      destination_user_id: null,
      notes: '',
      date: this.today,
      // Entrée fields
      supplier_id: null,
      supplier_contact_id: null,
      // Source location (Sortie / Transfert)
      source_warehouse_id: null,
      source_room_id: null,
      source_warehouse_location_id: null,
      source_cabinet_id: null,
      // Destination location (Entrée / Transfert)
      destination_warehouse_id: null,
      destination_room_id: null,
      destination_warehouse_location_id: null,
      destination_cabinet_id: null,
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
    private usersService: AdminUsersService,
    private stockService: AdminStockService,
    public auth: AuthService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get isResponsible(): boolean {
    const user = this.auth.currentUser();
    return this.auth.userHasAnyRole(user, ['administrateur', 'responsable', 'responsable de stock', 'gestionnaire', 'validateur']);
  }

  get isSourceDepotLocked(): boolean {
    const user = this.auth.currentUser();
    if (!user?.depot_id) return false;
    const type = this.newMovement.movement_type;
    return type === 'out' || type === 'transfer';
  }

  get isDestDepotLocked(): boolean {
    const user = this.auth.currentUser();
    if (!user?.depot_id) return false;
    const type = this.newMovement.movement_type;
    return type === 'in';
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.route.queryParams.subscribe(params => {
      if (params['status']) {
        this.filters.status = params['status'];
      }
      if (params['id']) {
        this.openDetails({ id: params['id'] });
      }
      this.load();
      this.loadUsers();
    });

    this.route.data.subscribe(data => {
      if (data['mode'] === 'validation') {
        this.filters.status = 'pending_validation';
        this.load();
      }
    });
  }

  get destinationWarehouses(): any[] {
    const user = this.auth.currentUser();
    const myDepotId = user?.depot_id;
    if (this.newMovement.movement_type === 'transfer' && myDepotId) {
      return this.warehouses.filter(w => Number(w.id) !== Number(myDepotId));
    }
    return this.warehouses;
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

  loadUsers(): void {
    this.usersService.listAll().subscribe({
      next: (res: any) => {
        // Handle both direct array and paginated response
        this.allUsers = Array.isArray(res) ? res : (res?.data ?? []);
        console.log('Loaded users:', this.allUsers.length);
        this.onSiegeChange();
        this.cdr.detectChanges();
      }
    });
  }

  onSiegeChange(): void {
    const siege = (this.newMovement.destination_siege || '').trim();
    if (siege) {
      this.filteredUsers = this.allUsers.filter(u => 
        (u.siege || '').trim().toLowerCase() === siege.toLowerCase()
      );
    } else {
      this.filteredUsers = [...this.allUsers];
    }
    console.log('Filtered users for siege', siege, ':', this.filteredUsers.length);
    this.cdr.detectChanges();
  }

  applyFilters(): void { this.page = 1; this.load(); }
  prevPage(): void { if (this.page > 1) { this.page--; this.load(); } }
  nextPage(): void { if (this.page < this.lastPage) { this.page++; this.load(); } }
  onPerPageChange(): void {
    this.page = 1;
    this.load();
  }

  validate(m: any): void {
    this.confirmationModal = {
      type: 'validate',
      title: 'Appliquer au Stock',
      message: 'Mettre à jour les quantités physiques avec ce mouvement ?',
      movement: m,
      icon: 'check'
    };
    this.confirmationCallback = () => this.executeValidate(m);
    this.cdr.detectChanges();
  }

  private executeValidate(m: any): void {
    m.executing = true;
    this.confirmationModal = null;
    this.selectedMovement = null;
    this.cdr.detectChanges();

    this.svc.validate(m.id).subscribe({
      next: () => {
        this.message = 'Stock mis à jour avec succès.';
        m.executing = false;
        this.load();
      },
      error: (err) => {
        m.executing = false;
        alert(err?.error?.message || 'Erreur lors de l\'exécution.');
        this.cdr.detectChanges();
      }
    });
  }

  openApproveModal(m: any): void {
    this.approvingMovement = m;
    this.rejectionMode = false;
    this.responseNotes = '';
  }

  openRejectModal(m: any): void {
    this.approvingMovement = m;
    this.rejectionMode = true;
    this.responseNotes = '';
  }

  closeDecisionModal(): void {
    this.approvingMovement = null;
    this.responseNotes = '';
  }

  submitDecision(): void {
    if (!this.approvingMovement) return;

    if (this.rejectionMode && !this.responseNotes.trim()) {
      alert('Un motif est obligatoire pour rejeter un mouvement.');
      return;
    }

    const m = this.approvingMovement;
    m.executing = true;

    // Close modals immediately for better UX
    this.approvingMovement = null;
    this.selectedMovement = null;
    this.cdr.detectChanges();

    const obs = this.rejectionMode
      ? this.svc.reject(m.id, this.responseNotes)
      : this.svc.approve(m.id, this.responseNotes);

    obs.subscribe({
      next: () => {
        this.message = this.rejectionMode ? 'Mouvement rejeté.' : 'Mouvement approuvé et exécuté.';
        m.executing = false;
        this.load();
      },
      error: (err) => {
        m.executing = false;
        alert(err?.error?.message || 'Erreur lors du traitement.');
        this.cdr.detectChanges();
      }
    });
  }

  approve(m: any): void {
    this.openApproveModal(m);
  }

  reject(m: any): void {
    this.openRejectModal(m);
  }

  closeConfirmationModal(): void {
    this.confirmationModal = null;
    this.confirmationCallback = null;
    this.cdr.detectChanges();
  }

  submitConfirmation(): void {
    if (this.confirmationCallback) {
      this.confirmationCallback();
    }
  }

  cancel(m: any): void {
    this.confirmationModal = {
      type: 'cancel',
      title: 'Annuler le Mouvement',
      message: 'Êtes-vous sûr de vouloir annuler ce mouvement de stock ?',
      movement: m,
      icon: 'x',
      showReason: true,
      reason: ''
    };
    this.confirmationCallback = () => this.executeCancel(m);
    this.cdr.detectChanges();
  }

  private executeCancel(m: any): void {
    const reason = this.confirmationModal?.reason || undefined;

    m.executing = true;
    this.confirmationModal = null;
    this.selectedMovement = null;
    this.cdr.detectChanges();

    this.svc.cancel(m.id, reason).subscribe({
      next: () => {
        this.message = 'Mouvement annulé.';
        m.executing = false;
        this.load();
      },
      error: () => {
        m.executing = false;
        alert('Erreur lors de l\'annulation.');
        this.cdr.detectChanges();
      }
    });
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
    this.sourceRooms = []; this.sourceLocations = []; this.sourceCabinets = []; this.mergedSourceOptions = [];
    this.destRooms   = []; this.destLocations   = []; this.destCabinets   = []; this.mergedDestOptions   = [];
    this.supplierContacts = [];
    // load reference data
    this.loadProducts();
    this.loadWarehouses();
    this.loadSuppliers();

    // Auto-select depot
    this.applyUserDepotSelection();
  }

  changeMovementType(type: string): void {
    this.newMovement.movement_type = type;
    this.applyUserDepotSelection();
  }

  private applyUserDepotSelection(): void {
    const user = this.auth.currentUser();
    if (!user?.depot_id) return;
    
    const depotId = user.depot_id;
    const type = this.newMovement.movement_type;

    if (type === 'in') {
      this.newMovement.destination_warehouse_id = depotId;
      this.onDestWarehouseChange();
    } else if (type === 'out') {
      this.newMovement.source_warehouse_id = depotId;
      this.onSourceWarehouseChange();
    } else if (type === 'transfer') {
      this.newMovement.source_warehouse_id = depotId;
      this.onSourceWarehouseChange();
    }
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
    this.warehouseService.listWarehouses(null, 200).subscribe({
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
    this.newMovement.source_cabinet_id = null;
    this.sourceRooms = []; this.sourceLocations = []; this.sourceCabinets = []; this.mergedSourceOptions = [];
    const id = Number(this.newMovement.source_warehouse_id);
    if (!id) return;
    this.warehouseService.listRooms(id, null, 200).subscribe({
      next: (r: any) => { this.sourceRooms = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []); this.cdr.detectChanges(); },
      error: () => this.sourceRooms = []
    });
  }

  onSourceRoomChange(): void {
    this.newMovement.source_warehouse_location_id = null;
    this.newMovement.source_cabinet_id = null;
    this.sourceLocations = [];
    this.sourceCabinets = [];
    this.mergedSourceOptions = [];
    const id = Number(this.newMovement.source_room_id);
    if (!id) return;

    // Load Locations
    this.warehouseService.listLocations(id, null, 200).subscribe({
      next: (r: any) => {
        this.sourceLocations = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
        this.updateMergedSource();
      }
    });

    // Load Cabinets
    this.warehouseService.listCabinets(id, null, 200).subscribe({
      next: (r: any) => {
        this.sourceCabinets = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
        this.updateMergedSource();
      }
    });
  }

  private updateMergedSource(): void {
    const locs = this.sourceLocations.map(l => {
      const isFull = l.capacity_units > 0 && l.current_units >= l.capacity_units;
      return { 
        id: l.id, 
        name: l.name, 
        type: 'location', 
        label: isFull ? `📦 ${l.name} (PLEIN)` : `📦 ${l.name}`,
        disabled: false // Never disable source, even if full
      };
    });
    const cabs = this.sourceCabinets.map(c => {
      const isFull = c.capacity_units > 0 && c.current_units >= c.capacity_units;
      return { 
        id: c.id, 
        name: c.name, 
        type: 'cabinet', 
        label: isFull ? `🗄️ ${c.name} (PLEIN)` : `🗄️ ${c.name}`,
        disabled: false
      };
    });
    
    this.mergedSourceOptions = [...locs, ...cabs].sort((a, b) => a.name.localeCompare(b.name));
    this.cdr.detectChanges();
  }

  onSourceSelectionChange(event: any): void {
    const val = event.target.value;
    if (!val) {
      this.newMovement.source_warehouse_location_id = null;
      this.newMovement.source_cabinet_id = null;
      return;
    }
    const [type, id] = val.split(':');
    if (type === 'location') {
      this.newMovement.source_warehouse_location_id = Number(id);
      this.newMovement.source_cabinet_id = null;
    } else {
      this.newMovement.source_cabinet_id = Number(id);
      this.newMovement.source_warehouse_location_id = null;
    }
  }

  /* ────────────────── CASCADING LOCATION: DESTINATION ────────────────── */

  onDestWarehouseChange(): void {
    this.newMovement.destination_room_id = null;
    this.newMovement.destination_warehouse_location_id = null;
    this.newMovement.destination_cabinet_id = null;
    this.destRooms = []; this.destLocations = []; this.destCabinets = []; this.mergedDestOptions = [];
    const id = Number(this.newMovement.destination_warehouse_id);
    if (!id) return;
    this.warehouseService.listRooms(id, null, 200).subscribe({
      next: (r: any) => { this.destRooms = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []); this.cdr.detectChanges(); },
      error: () => this.destRooms = []
    });
  }

  onDestRoomChange(): void {
    this.newMovement.destination_warehouse_location_id = null;
    this.newMovement.destination_cabinet_id = null;
    this.destLocations = [];
    this.destCabinets = [];
    this.mergedDestOptions = [];
    const id = Number(this.newMovement.destination_room_id);
    if (!id) return;

    // Load Locations
    this.warehouseService.listLocations(id, null, 200).subscribe({
      next: (r: any) => {
        this.destLocations = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
        this.updateMergedDest();
      }
    });

    // Load Cabinets
    this.warehouseService.listCabinets(id, null, 200).subscribe({
      next: (r: any) => {
        this.destCabinets = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
        this.updateMergedDest();
      }
    });
  }

  private updateMergedDest(): void {
    const locs = this.destLocations.map(l => {
      const isFull = l.capacity_units > 0 && l.current_units >= l.capacity_units;
      return { 
        id: l.id, 
        name: l.name, 
        type: 'location', 
        label: isFull ? `📦 ${l.name} (PLEIN)` : `📦 ${l.name}`,
        disabled: isFull 
      };
    });
    const cabs = this.destCabinets.map(c => {
      const isFull = c.capacity_units > 0 && c.current_units >= c.capacity_units;
      return { 
        id: c.id, 
        name: c.name, 
        type: 'cabinet', 
        label: isFull ? `🗄️ ${c.name} (PLEIN)` : `🗄️ ${c.name}`,
        disabled: isFull 
      };
    });
    
    this.mergedDestOptions = [...locs, ...cabs].sort((a, b) => a.name.localeCompare(b.name));
    this.cdr.detectChanges();
  }

  onDestSelectionChange(event: any): void {
    const val = event.target.value;
    if (!val) {
      this.newMovement.destination_warehouse_location_id = null;
      this.newMovement.destination_cabinet_id = null;
      return;
    }
    const [type, id] = val.split(':');
    if (type === 'location') {
      this.newMovement.destination_warehouse_location_id = Number(id);
      this.newMovement.destination_cabinet_id = null;
    } else {
      this.newMovement.destination_cabinet_id = Number(id);
      this.newMovement.destination_warehouse_location_id = null;
    }
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
    if (this.loading) return;
    this.message = '';

    // Frontend validation for Out / Transfer
    if (this.newMovement.movement_type !== 'in') {
      for (const line of this.newMovement.lines) {
        const product = this.products.find(p => Number(p?.id) === Number(line?.product_id));
        if (product) {
          const available = Number(product.stock_quantity ?? 0);
          if (Number(line.quantity) > available) {
            this.message = `Stock insuffisant pour ${product.title}. (Dispo: ${available})`;
            return;
          }
        }
      }
    }

    if (this.newMovement.movement_type === 'in' && !this.newMovement.supplier_id) {
      this.message = 'Veuillez sélectionner un fournisseur.';
      return;
    }

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
    if ((type === 'out' || type === 'transfer') && !Number(this.newMovement.source_warehouse_location_id) && !Number(this.newMovement.source_cabinet_id)) {
      this.message = 'Sélectionnez l\'emplacement source (dépôt → salle → emplacement/armoire).';
      this.loading = false;
      return;
    }
    if ((type === 'in' || type === 'transfer') && !Number(this.newMovement.destination_warehouse_location_id) && !Number(this.newMovement.destination_cabinet_id)) {
      this.message = 'Sélectionnez l\'emplacement de destination.';
      this.loading = false;
      return;
    }
    const sourceKey = this.newMovement.source_cabinet_id ? `cab:${this.newMovement.source_cabinet_id}` : `loc:${this.newMovement.source_warehouse_location_id}`;
    const destKey = this.newMovement.destination_cabinet_id ? `cab:${this.newMovement.destination_cabinet_id}` : `loc:${this.newMovement.destination_warehouse_location_id}`;

    if (type === 'transfer' && sourceKey === destKey) {
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
      if (this.newMovement.destination_cabinet_id)
        form.append('destination_cabinet_id', String(this.newMovement.destination_cabinet_id));
    }
    if (type === 'out' || type === 'transfer') {
      if (this.newMovement.source_warehouse_location_id)
        form.append('source_warehouse_location_id', String(this.newMovement.source_warehouse_location_id));
      if (this.newMovement.source_cabinet_id)
        form.append('source_cabinet_id', String(this.newMovement.source_cabinet_id));
      
      if (type === 'out') {
        if (this.newMovement.destination_siege)
          form.append('destination_siege', this.newMovement.destination_siege);
        if (this.newMovement.destination_user_id)
          form.append('destination_user_id', String(this.newMovement.destination_user_id));
      }
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
      case 'executed':           return 'tag-success';
      case 'cancelled':          return 'tag-danger';
      case 'pending_validation': return 'tag-warning';
      case 'approved':           return 'tag-info';
      default:                   return 'tag-neutral';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'draft':              return 'Brouillon';
      case 'pending_validation': return 'Attente Validation';
      case 'approved':           return 'Approuvé (Attente exécution)';
      case 'executed':           return 'Exécuté';
      case 'cancelled':          return 'Annulé / Rejeté';
      default:                   return status;
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
    return `http://localhost:8000/api/docs/${clean}`;
  }

  getTotalQuantity(lines: any[]): number {
    if (!Array.isArray(lines)) return 0;
    return lines.reduce((total, line) => total + (Number(line.quantity) || 0), 0);
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

