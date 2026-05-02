import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConsumableRequestService } from '../services/consumable-request.service';
import { AuthService } from '../core/services/auth.service';
import { AdminWarehouseService } from '../features/admin/services/admin-warehouse.service';

type NavTab = 'pending' | 'history' | 'exits';

@Component({
  selector: 'app-consumable-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DatePipe],
  templateUrl: './consumable-request.html',
  styleUrls: ['./consumable-request.css']
})
export class ConsumableRequestComponent implements OnInit {

  // ── Data ──────────────────────────────────────────────────────────────────
  requests: any[] = [];
  products: any[] = [];

  // ── UI State ──────────────────────────────────────────────────────────────
  activeTab: NavTab = 'pending';
  loading = false;
  loadingProducts = false;
  message = '';

  // ── Access rights ─────────────────────────────────────────────────────────
  currentUser: any = null;
  viewMode: 'request' | 'validation' = 'request';
  canApprove = false;
  canCreateRequest = true;
  canEditDeleteOwnRequests = false;
  isResponsable = false;

  // ── Filters ───────────────────────────────────────────────────────────────
  statusFilter = 'all';
  pageSize = 10;
  productSearchTerm = '';

  // ── Request Modal ─────────────────────────────────────────────────────────
  form: FormGroup;
  requestModalOpen = false;
  requestModalEditMode = false;
  editingRequestId: number | null = null;
  deletingRequestId: number | null = null;
  requestLines: Array<{ product_id: number | null; requested_quantity: number | null }> = [
    { product_id: null, requested_quantity: null }
  ];
  currentBatchCode: string | null = null;

  // ── Approve Modal ─────────────────────────────────────────────────────────
  selectedRequestForApproval: any = null;
  modalApprovedQuantity = 0;
  approving = false;

  // ── Details Modal ─────────────────────────────────────────────────────────
  selectedRequestDetails: any = null;

  // ── Reject Modal ──────────────────────────────────────────────────────────
  selectedRequestForRejection: any = null;
  rejectReason = '';
  rejecting = false;

  // ── Exit Modal ────────────────────────────────────────────────────────────
  selectedRequestForExit: any = null;
  exitSourceStocks: any[] = [];
  exitSourceLocationId: number | null = null;
  exitMotif = '';
  exitRequesterName = '';
  exitLocalText = '';
  exitMode: 'depot' | 'adresse' = 'depot';   // 'depot' = choisir dépôt/salle/emplacement, 'adresse' = saisie libre
  exitAdresseLibre = '';                        // ex: "Avenue Mohamed 5, Siège"
  confirmingExit = false;
  selectedDepot: any = null;
  selectedSalle: any = null;
  selectedEmplacement: any = null;
  depotsList: any[] = [];
  sallesList: any[] = [];
  locationsList: any[] = [];
  cabinetsList: any[] = [];

  // ── Expanded rows ─────────────────────────────────────────────────────────
  expandedRequestIds = new Set<number>();

  constructor(
    private consumableRequestService: ConsumableRequestService,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly adminWarehouseService: AdminWarehouseService,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    this.form = this.formBuilder.group({
      product_id: [null],
      item_name: ['', [Validators.minLength(3)]],
      requested_quantity: ['', [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const routeMode = this.route.snapshot.data['mode'];
    this.viewMode = routeMode === 'validation' ? 'validation' : 'request';
    this.canCreateRequest = this.viewMode === 'request';

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.resolveAccessRights(user);

        // Set default tab AFTER resolveAccessRights so isResponsable is known
        if (this.isResponsable) {
          this.activeTab = 'exits';
        } else if (this.viewMode === 'validation') {
          this.activeTab = 'pending';
        } else {
          this.activeTab = 'history';
        }

        this.loadProducts();
        this.loadRequests();
        this.cdr.detectChanges();
      },
      error: () => {
        this.message = 'Impossible de charger les informations utilisateur.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadProducts(): void {
    this.loadingProducts = true;
    this.consumableRequestService.getProducts().subscribe({
      next: (data) => { this.products = Array.isArray(data) ? data : []; this.loadingProducts = false; this.cdr.detectChanges(); },
      error: () => { this.loadingProducts = false; this.cdr.detectChanges(); }
    });
  }

  loadRequests(): void {
    this.loading = true;
    this.consumableRequestService.getRequests().subscribe({
      next: (data) => { this.requests = Array.isArray(data) ? data : []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  setTab(tab: NavTab): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  get tabs(): Array<{ id: NavTab; label: string; count?: number }> {
    const tabs: Array<{ id: NavTab; label: string; count?: number }> = [];
    
    // 1. Pending Validation (ONLY for actual Directors)
    if (this.isDirectorUser(this.currentUser)) {
      tabs.push({ id: 'pending', label: 'Demandes à valider', count: this.pendingValidationRequests.length });
    }
    
    // 2. Physical Exits (for Responsable)
    if (this.isResponsable) {
      tabs.push({ id: 'exits', label: 'Sorties physiques', count: this.pendingExitRequests.length });
    }

    // 3. History (for everyone)
    const historyLabel = (this.viewMode === 'request' && !this.isResponsable) ? 'Mes demandes' : 'Historique';
    tabs.push({ id: 'history', label: historyLabel, count: this.historyRequests.length });
    
    return tabs;
  }

  // ── Sorted & filtered lists ───────────────────────────────────────────────

  /** All requests sorted by date desc */
  private get sortedByDate(): any[] {
    return [...this.requests].sort((a, b) => {
      const da = new Date(a?.created_at || 0).getTime();
      const db = new Date(b?.created_at || 0).getTime();
      return db - da;
    });
  }

  get pendingValidationRequests(): any[] {
    return this.sortedByDate.filter(r => r.status === 'pending');
  }

  get pendingExitRequests(): any[] {
    return this.sortedByDate.filter(r => r.status === 'approved_pending_exit');
  }

  get historyRequests(): any[] {
    let data = this.sortedByDate;

    if (this.isResponsable) {
      // Responsable only sees what they handle: approved (waiting exit) and delivered
      data = data.filter(r => r.status === 'approved_pending_exit' || r.status === 'approved');
      if (this.statusFilter !== 'all') {
        data = data.filter(r => r.status === this.statusFilter);
      }
      return data;
    }

    if (this.viewMode === 'validation') {
      data = data.filter(r => r.status !== 'pending');
    }

    if (this.statusFilter !== 'all') {
      data = data.filter(r => r.status === this.statusFilter);
    }

    return data;
  }

  get paginatedHistory(): any[] {
    return this.historyRequests.slice(0, this.pageSize);
  }

  get filteredProducts(): any[] {
    const term = this.productSearchTerm.trim().toLowerCase();
    if (!term) return this.products;
    return this.products.filter(p =>
      String(p.title || '').toLowerCase().includes(term) ||
      String(p.reference || '').toLowerCase().includes(term)
    );
  }

  // ── Kept from original — used for exit modal stock source selection ────────

  /** Unique warehouses extracted from exitSourceStocks — supports multiple API response shapes */
  updateAvailableDepots(): void {
    const depotsMap = new Map<number, any>();
    if (!this.exitSourceStocks || !Array.isArray(this.exitSourceStocks)) {
      this.depotsList = [];
      return;
    }

    for (const s of this.exitSourceStocks) {
      const whId = s.warehouse_id || s.warehouseId;
      const whName = s.warehouse_name || s.warehouseName;
      if (whId && (s.quantity > 0)) {
        const idNum = Number(whId);
        if (!depotsMap.has(idNum)) {
          depotsMap.set(idNum, { id: idNum, name: whName || `Dépôt ${idNum}` });
        }
      }
    }
    this.depotsList = Array.from(depotsMap.values());
    console.log('Filtered depots for selection:', this.depotsList);
  }

  updateAvailableSalles(): void {
    if (!this.selectedDepot) {
      this.sallesList = [];
      return;
    }
    const sallesMap = new Map();
    for (const s of this.exitSourceStocks) {
      const whId = s.warehouse_id || s.warehouseId;
      const roomId = s.room_id || s.roomId;
      const roomName = s.room_name || s.roomName;
      
      if (whId == this.selectedDepot.id && roomId && !sallesMap.has(roomId)) {
        sallesMap.set(roomId, { id: roomId, name: roomName || `Salle ${roomId}` });
      }
    }
    this.sallesList = Array.from(sallesMap.values());
  }

  updateAvailableEmplacements(): void {
    const salle = this.selectedSalle;
    if (!salle) {
      this.locationsList = [];
      return;
    }
    this.locationsList = this.exitSourceStocks.filter(s => (s.room_id || s.roomId) == salle.id);
  }

  getEmplacementLabel(s: any): string {
    const type = s.cabinet_id ? 'Armoire' : 'Empl.';
    const label = s.location_label || 'Inconnu';
    return `${type}: ${label} (Stock: ${s.quantity})`;
  }

  getLocationName(s: any): string {
    if (s.cabinet_id) {
      return `Armoire: ${s.warehouseCabinet?.code || s.cabinet_id} (Dispo: ${s.quantity})`;
    }
    return `${s.warehouseLocation?.name || s.warehouseLocation?.code || 'Emplacement'} (Dispo: ${s.quantity})`;
  }

  /** Legacy flat list — kept for any template references using filteredRequests */
  get filteredRequests(): any[] {
    return this.sortedByDate;
  }

  /** Legacy getter — kept for backward compatibility */
  get otherRequests(): any[] {
    return this.historyRequests;
  }

  /** Legacy paginated getter — kept for backward compatibility */
  get paginatedOtherRequests(): any[] {
    return this.paginatedHistory;
  }

  // ── Labels & Colors ───────────────────────────────────────────────────────

  get pageTitle(): string {
    if (this.isResponsable) return 'Espace Responsable Logistique';
    if (this.viewMode === 'validation') return 'Tableau de Validation';
    return 'Espace Demandeur';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'Brouillon',
      pending: 'En attente',
      approved_pending_exit: 'Approuvé (Sortie à confirmer)',
      approved: 'Livré / Terminé',
      rejected: 'Refusé'
    };
    return map[status] ?? status;
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      draft: '#64748b',
      approved: '#10b981',
      rejected: '#ef4444',
      pending: '#f59e0b',
      approved_pending_exit: '#3b82f6'
    };
    return map[status] ?? '#94a3b8';
  }

  stockStatusLabel(request: any): string {
    const available = Number(request?.available_stock ?? -1);
    const threshold = Number(request?.product_threshold ?? 0);
    if (!Number.isFinite(available) || available < 0) return 'Stock inconnu';
    if (threshold > 0 && available < threshold) return 'Sous seuil';
    if (available < Number(request?.requested_quantity ?? 0)) return 'Insuffisant';
    return 'Suffisant';
  }

  stockStatusClass(request: any): string {
    const label = this.stockStatusLabel(request);
    if (label === 'Suffisant') return 'tag-success';
    if (label === 'Stock inconnu') return 'tag-neutral';
    return 'tag-warning';
  }

  // ── Pagination & filters ──────────────────────────────────────────────────

  changePageSize(size: number): void {
    this.pageSize = size;
    this.cdr.detectChanges();
  }

  // ── Request CRUD ──────────────────────────────────────────────────────────

  openCreateRequestModal(): void { this.openCreateRequestModalWithBatch(null); }

  openCreateRequestModalWithBatch(batchCode: string | null): void {
    if (!this.canCreateRequest) return;
    this.currentBatchCode = batchCode;
    this.requestModalOpen = true;
    this.requestModalEditMode = false;
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  openEditRequestModal(request: any): void {
    if (!this.canEditDeleteOwnRequests) return;
    const s = String(request?.status || '').toLowerCase();
    if (s !== 'pending' && s !== 'draft') return;
    this.requestModalOpen = true;
    this.requestModalEditMode = true;
    this.editingRequestId = Number(request.id);
    this.form.patchValue({
      product_id: request?.product_id ?? null,
      item_name: request?.item_name ?? '',
      requested_quantity: request?.requested_quantity ?? ''
    });
  }

  closeRequestModal(): void {
    this.requestModalOpen = false;
    this.requestModalEditMode = false;
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  addRequestLine(): void { this.requestLines.push({ product_id: null, requested_quantity: null }); }

  removeRequestLine(index: number): void {
    if (this.requestLines.length <= 1) return;
    this.requestLines.splice(index, 1);
  }

  submitRequest(): void {
    let request$: any;

    if (this.requestModalEditMode) {
      if (!this.form.valid || !this.editingRequestId) return;
      const selectedProduct = this.products.find(p => p.id === this.form.value.product_id);
      const itemName = (selectedProduct?.title || this.form.value.item_name || '').trim();
      if (!itemName) { this.message = 'Veuillez sélectionner un produit ou saisir un article.'; return; }
      request$ = this.consumableRequestService.updateRequest(this.editingRequestId, {
        product_id: this.form.value.product_id || null,
        item_name: itemName,
        requested_quantity: this.form.value.requested_quantity
      });
    } else {
      const validLines = this.requestLines.filter(l => Number(l.product_id) > 0 && Number(l.requested_quantity) >= 1);
      if (validLines.length === 0) { this.message = 'Ajoutez au moins un produit avec une quantité valide.'; return; }
      const payload: any = {
        items: validLines.map(l => ({ product_id: Number(l.product_id), requested_quantity: Number(l.requested_quantity) })),
        status: 'draft'
      };
      if (this.currentBatchCode) payload.batch_code = this.currentBatchCode;
      request$ = this.consumableRequestService.createRequest(payload);
    }

    this.loading = true;
    request$.subscribe({
      next: () => {
        setTimeout(() => {
          this.message = this.requestModalEditMode ? 'Demande modifiée avec succès.' : 'Demande créée avec succès.';
          this.closeRequestModal();
          this.currentBatchCode = null;
          this.loadRequests();
          this.loading = false;
          this.cdr.detectChanges();
          setTimeout(() => (this.message = ''), 3000);
        });
      },
      error: (err: unknown) => {
        this.message = this.requestModalEditMode ? 'Erreur lors de la modification.' : 'Erreur lors de la création.';
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  validateDraft(id: number): void {
    if (!this.canEditDeleteOwnRequests) return;
    this.loading = true;
    this.consumableRequestService.updateRequest(id, { status: 'pending' }).subscribe({
      next: () => {
        this.message = 'Demande mise en attente.';
        this.loadRequests();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors de la validation.';
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteRequest(id: number): void {
    if (!this.canEditDeleteOwnRequests || this.deletingRequestId) return;
    if (typeof window !== 'undefined' && !window.confirm('Supprimer cette demande ?')) return;
    this.deletingRequestId = id;
    this.consumableRequestService.deleteRequest(id).subscribe({
      next: () => {
        this.message = 'Demande supprimée.';
        this.deletingRequestId = null;
        this.loadRequests();
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors de la suppression.';
        this.deletingRequestId = null;
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  // ── Approve / Reject ──────────────────────────────────────────────────────

  openApproveModal(request: any): void {
    if (!this.canApprove) return;
    this.selectedRequestForApproval = request;
    const suggested = Number(request?.suggested_approved_quantity);
    this.modalApprovedQuantity = Number.isFinite(suggested) ? suggested : Number(request?.requested_quantity || 0);
  }

  closeApproveModal(): void {
    this.selectedRequestForApproval = null;
    this.modalApprovedQuantity = 0;
    this.approving = false;
  }

  useSuggestedQuantity(): void {
    if (!this.selectedRequestForApproval) return;
    const suggested = Number(this.selectedRequestForApproval?.suggested_approved_quantity);
    this.modalApprovedQuantity = Number.isFinite(suggested) ? suggested : Number(this.selectedRequestForApproval?.requested_quantity || 0);
  }

  confirmApprove(): void {
    if (!this.canApprove || !this.selectedRequestForApproval || this.approving) return;
    const request = this.selectedRequestForApproval;
    const maxAllowed = Number(request?.available_stock ?? request?.requested_quantity ?? 0);
    const approvedQuantity = Number(this.modalApprovedQuantity);
    if (!Number.isFinite(approvedQuantity) || approvedQuantity < 0) { this.message = 'Quantité approuvée invalide.'; return; }
    if (approvedQuantity > maxAllowed) { this.message = `La quantité approuvée ne doit pas dépasser ${maxAllowed}.`; return; }
    this.approving = true;
    this.consumableRequestService.approveRequest(request.id, approvedQuantity).subscribe({
      next: () => {
        this.message = 'Demande approuvée.';
        this.closeApproveModal();
        this.loadRequests();
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = "Erreur lors de l'approbation.";
        console.error(err);
        this.approving = false;
        this.cdr.detectChanges();
      }
    });
  }

  openRejectModal(request: any): void {
    if (!this.canApprove) return;
    this.selectedRequestForRejection = request;
    this.rejectReason = '';
  }

  closeRejectModal(): void {
    this.selectedRequestForRejection = null;
    this.rejectReason = '';
    this.rejecting = false;
  }

  confirmReject(): void {
    if (!this.canApprove || !this.selectedRequestForRejection || this.rejecting) return;
    const id = this.selectedRequestForRejection.id;
    this.rejecting = true;
    this.consumableRequestService.rejectRequest(id, this.rejectReason).subscribe({
      next: () => {
        this.message = 'Demande rejetée.';
        this.closeRejectModal();
        this.loadRequests();
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors du rejet.';
        console.error(err);
        this.rejecting = false;
        this.cdr.detectChanges();
      }
    });
  }

  rejectRequest(id: number): void {
    // Legacy method - redirecting to modal logic if we have the object
    const req = this.requests.find(r => r.id === id);
    if (req) this.openRejectModal(req);
  }

  // ── Details Modal ─────────────────────────────────────────────────────────

  openDetailsModal(request: any): void { this.selectedRequestDetails = request; }
  closeDetailsModal(): void { this.selectedRequestDetails = null; }

  canEditFromDetails(request: any): boolean {
    const status = String(request?.status || '').toLowerCase();
    return (status === 'pending' || status === 'draft') && this.canEditDeleteOwnRequests;
  }

  editItemFromDetails(item: any): void { this.closeDetailsModal(); this.openEditRequestModal(item); }
  deleteItemFromDetails(item: any): void { this.closeDetailsModal(); this.deleteRequest(item.id); }
  approveFromDetails(item: any): void { this.closeDetailsModal(); this.openApproveModal(item); }

  // ── PDF ───────────────────────────────────────────────────────────────────

  downloadPdf(request: any): void {
    if (!request?.pdf_path) { alert("Le PDF n'est pas disponible pour cette demande."); return; }
    window.open(`/api/docs/${request.pdf_path}`, '_blank');
  }

  // ── Exit Modal ────────────────────────────────────────────────────────────

  openExitModal(request: any): void {
    const item = (request.items && request.items.length === 1) ? request.items[0] : request;
    this.selectedRequestForExit = request;
    this.exitSourceLocationId = null;
    this.selectedDepot = null;
    this.selectedSalle = null;
    this.selectedEmplacement = null;
    this.exitMotif = 'Remise physique effectuée';
    this.exitRequesterName = request.requester_name || (request.user?.nomprenom || request.user?.name || '');
    this.exitLocalText = request.requester_poste || '';
    this.exitSourceStocks = [];
    this.depotsList = [];
    this.sallesList = [];
    this.locationsList = [];
    this.cabinetsList = [];

    let productId = item.product_id || request.product_id || 
                    (request.items && request.items[0]?.product_id) || 
                    (request.items && request.items[0]?.product?.id) || 
                    item.product?.id;
    
    // Fallback: try to find product by name if ID is missing
    if (!productId) {
      const name = (item.item_name || request.item_name || item.product?.title || '').toLowerCase().trim();
      if (name) {
        const found = this.products.find(p => (p.title || '').toLowerCase().trim() === name);
        if (found) {
          productId = found.id;
          console.log('Product ID found by name fallback:', productId);
        }
      }
    }
    
    console.log('--- DEBUG EXIT MODAL ---', {
      productId,
      item_name: item.item_name || request.item_name,
      item,
      request
    });

    if (productId) {
      this.consumableRequestService.getProductStocks(productId).subscribe({
        next: (res: any) => {
          console.log('Stocks received for product ' + productId + ':', res);
          this.exitSourceStocks = Array.isArray(res) ? res : [];
          this.updateAvailableDepots();
          this.cdr.detectChanges();
        },
        error: (err) => { 
          console.error('API Error loading stocks for product ' + productId + ':', err);
          this.exitSourceStocks = [];
          this.depotsList = [];
          this.message = 'Erreur chargement stocks.'; 
          this.cdr.detectChanges();
        }
      });
    } else {
      console.error('CRITICAL: No product ID could be determined for this request.');
    }
  }

  closeExitModal(): void {
    this.selectedRequestForExit = null;
    this.exitSourceStocks = [];
  }

  confirmExitAction(): void {
    if (!this.selectedRequestForExit) return;
    this.confirmingExit = true;

    const destinationText = this.exitRequesterName + 
      (this.selectedRequestForExit.requester_siege ? ' - ' + this.selectedRequestForExit.requester_siege : '') +
      (this.exitLocalText ? ' (' + this.exitLocalText + ')' : '');

    const payload: any = {
      motif: this.exitMotif,
      destination_text: destinationText,
      exit_mode: 'depot'
    };

    if (this.selectedEmplacement) {
      const s = this.selectedEmplacement; // Now it's a stock record
      if (s.warehouse_location_id) payload.source_warehouse_location_id = s.warehouse_location_id;
      else if (s.cabinet_id) payload.source_cabinet_id = s.cabinet_id;
    }

    this.consumableRequestService.confirmExit(this.selectedRequestForExit.id, payload).subscribe({
      next: () => {
        this.message = 'Remise effectuée et stock mis à jour.';
        this.confirmingExit = false;
        this.closeExitModal();
        this.loadRequests();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        let errorMsg = 'Inconnue';
        if (err.error?.errors) errorMsg = Object.values(err.error.errors).flat().join(' ');
        else if (err.error?.message) errorMsg = err.error.message;
        this.message = 'Erreur : ' + errorMsg;
        this.confirmingExit = false;
        this.cdr.detectChanges();
      }
    });
  }

  onDepotChange(): void {
    this.selectedSalle = null;
    this.selectedEmplacement = null;
    this.updateAvailableSalles();
    this.cdr.detectChanges();
  }

  onSalleChange(): void {
    this.selectedEmplacement = null;
    this.updateAvailableEmplacements();
    this.cdr.detectChanges();
  }

  onEmplacementChange(): void {
    if (!this.selectedEmplacement) { this.exitSourceLocationId = null; return; }
    this.exitSourceLocationId = this.selectedEmplacement.warehouse_location_id
      || this.selectedEmplacement.cabinet_id
      || this.selectedEmplacement.id
      || null;
  }

  loadDepots(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.adminWarehouseService.listWarehouses().subscribe({
      next: (res: any) => {
        this.depotsList = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: () => { this.depotsList = []; }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  toggleDetails(id: number): void {
    if (this.expandedRequestIds.has(id)) this.expandedRequestIds.delete(id);
    else this.expandedRequestIds.add(id);
  }

  private resolveAccessRights(user: any): void {
    const isDirector = this.isDirectorUser(user);
    this.isResponsable = this.authService.userHasAnyRole(user, [
      'Responsable de stock', 'Responsable', 'Agent de stock', 'Agent', 'Administrateur'
    ]);

    // If user is a Responsable, they might still be allowed to approve in some cases
    // but typically Director approves. However, if the user sees the 'Approve' button,
    // it MUST work. Let's make canApprove more inclusive if they are in validation mode.
    this.canApprove = (this.viewMode === 'validation') && (isDirector || this.isResponsable);

    if (this.isResponsable) {
      this.canCreateRequest = this.viewMode === 'request' && !isDirector; // Only non-directors create
      this.canEditDeleteOwnRequests = this.viewMode === 'request';
    } else {
      this.canCreateRequest = this.viewMode === 'request';
      this.canEditDeleteOwnRequests = this.viewMode === 'request';
    }
  }

  private isDirectorUser(user: any): boolean {
    const byRole = this.authService.userHasAnyRole(user, ['Directeur', 'directeur', 'durecteur', 'director']);
    const poste = String(user?.poste || '').trim().toLowerCase();
    const legacyRole = String(user?.role || '').trim().toLowerCase();
    const aliases = ['directeur', 'durecteur', 'director'];
    return byRole || aliases.includes(poste) || aliases.includes(legacyRole);
  }
}