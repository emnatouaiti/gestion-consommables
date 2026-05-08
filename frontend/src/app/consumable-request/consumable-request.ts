import { ChangeDetectorRef, Component, Inject, NgZone, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConsumableRequestService } from '../services/consumable-request.service';
import { AuthService } from '../core/services/auth.service';
import { AdminWarehouseService } from '../features/admin/services/admin-warehouse.service';
import { forkJoin } from 'rxjs';

type NavTab = 'pending' | 'history' | 'exits';

// Decision individuelle par produit dans un lot
type ItemDecision = 'approved' | 'rejected' | 'pending';

@Component({
  selector: 'app-consumable-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DatePipe],
  templateUrl: './consumable-request.html',
  styleUrls: ['./consumable-request.css']
})
export class ConsumableRequestComponent implements OnInit {

  // Data
  requests: any[] = [];
  products: any[] = [];

  // UI State
  activeTab: NavTab = 'pending';
  loading = false;
  loadingProducts = false;
  message = '';

  // Access rights
  currentUser: any = null;
  viewMode: 'request' | 'validation' = 'request';
  canApprove = false;
  canCreateRequest = true;
  canEditDeleteOwnRequests = false;
  isResponsable = false;

  // Filters
  statusFilter = 'all';
  startDateFilter = '';
  endDateFilter = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  pageSize = 10;
  totalPages = 1;
  productSearchTerm = '';

  // Request Modal
  form: FormGroup;
  requestModalOpen = false;
  requestModalEditMode = false;
  editingRequestId: number | null = null;
  deletingRequestId: number | null = null;
  requestLines: Array<{
    id?: number;
    product_id: number | null;
    requested_quantity: number | null;
    searchTerm: string;
    filteredItems: any[];
  }> = [{ product_id: null, requested_quantity: null, searchTerm: '', filteredItems: [] }];
  currentBatchCode: string | null = null;

  // Approve Modal
  selectedRequestForApproval: any = null;
  modalApprovedQuantity = 0;
  modalApprovedQuantities: Record<number, number> = {};
  approving = false;

  // Approve per-item (lot) state
  // itemDecisions: { [itemId]: 'approved' | 'rejected' | 'pending' }
  itemDecisions: Record<number, ItemDecision> = {};
  // itemApprovedQuantities: { [itemId]: number }
  itemApprovedQuantities: Record<number, number> = {};
  // itemRejectReasons: { [itemId]: string }
  itemRejectReasons: Record<number, string> = {};

  // Details Modal
  selectedRequestDetails: any = null;

  // Reject Modal
  selectedRequestForRejection: any = null;
  rejectReason = '';
  rejecting = false;

  // Exit Modal
  selectedRequestForExit: any = null;
  exitSourceStocks: any[] = [];
  exitSourceLocationId: number | null = null;
  exitMotif = '';
  exitRequesterName = '';
  exitLocalText = '';
  confirmingExit = false;
  selectedDepot: any = null;
  selectedSalle: any = null;
  selectedEmplacement: any = null;
  depotsList: any[] = [];
  sallesList: any[] = [];
  locationsList: any[] = [];
  cabinetsList: any[] = [];

  // Expanded rows
  expandedRequestIds = new Set<number>();

  constructor(
    private consumableRequestService: ConsumableRequestService,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly adminWarehouseService: AdminWarehouseService,
    private readonly ngZone: NgZone,
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

  // Data loading

  loadProducts(): void {
    this.loadingProducts = true;
    this.consumableRequestService.getProducts().subscribe({
      next: (data) => {
        this.products = Array.isArray(data) ? data : [];
        this.loadingProducts = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRequests(): void {
    this.loading = true;
    const params: any = {};
    if (this.startDateFilter) params.start_date = this.startDateFilter;
    if (this.endDateFilter) params.end_date = this.endDateFilter;

    this.consumableRequestService.getRequests(params).subscribe({
      next: (data) => {
        this.requests = Array.isArray(data) ? data : [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  // Navigation

  setTab(tab: NavTab): void {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  get tabs(): Array<{ id: NavTab; label: string; count?: number }> {
    const tabs: Array<{ id: NavTab; label: string; count?: number }> = [];

    const canSeeValidation = (this.viewMode === 'validation') || this.isResponsable || this.canApprove;
    if (canSeeValidation) {
      tabs.push({ id: 'pending', label: 'Demandes a valider', count: this.pendingValidationRequests.length });
    }

    if (this.isResponsable) {
      tabs.push({ id: 'exits', label: 'Sorties physiques', count: this.pendingExitRequests.length });
    }

    const historyLabel = (this.viewMode === 'request' && !this.isResponsable) ? 'Mes demandes' : 'Historique';
    tabs.push({ id: 'history', label: historyLabel, count: this.historyRequests.length });

    return tabs;
  }

  // Sorted & filtered lists

  private get sortedByDate(): any[] {
    return [...this.requests].sort((a, b) => {
      const da = new Date(a?.created_at || 0).getTime();
      const db = new Date(b?.created_at || 0).getTime();
      return db - da;
    });
  }

  get pendingValidationRequests(): any[] {
    const isDirector = this.isDirectorUser(this.currentUser);
    const isManager = this.isResponsable;

    return this.sortedByDate.filter(r => {
      const s = r.status?.toLowerCase();
      if (isDirector) {
        // Directors can see: pending, validated_by_manager, and partially accepted
        return ['validated_by_manager', 'partiellement_accepte'].includes(s);
      }
      if (isManager) {
        return s === 'pending';
      }
      return false;
    });
  }

  get pendingExitRequests(): any[] {
    return this.sortedByDate.filter(r => r.status === 'approved_pending_exit');
  }

  get historyRequests(): any[] {
    let data = this.sortedByDate;

    if (this.isResponsable) {
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
    const start = (this.currentPage - 1) * this.pageSize;
    return this.historyRequests.slice(start, start + this.pageSize);
  }

  get paginatedPendingValidationRequests(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.pendingValidationRequests.slice(start, start + this.pageSize);
  }

  get totalPagesComputed(): number {
    const total = this.activeTab === 'pending'
      ? this.pendingValidationRequests.length
      : this.historyRequests.length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  prevPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage -= 1;
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage += 1;
  }

  get filteredProducts(): any[] {
    return this.filterProductsByTerm(this.productSearchTerm);
  }

  hasDrafts(group: any): boolean {
    if (!group) return false;
    if (group.status === 'draft') return true;
    if (group.items && Array.isArray(group.items)) {
      return group.items.some((it: any) => it.status === 'draft');
    }
    return false;
  }

  filterProductsByTerm(term: string): any[] {
    const t = (term || '').trim().toLowerCase();
    if (!t) return this.products;
    return this.products.filter(p =>
      String(p.title || '').toLowerCase().includes(t) ||
      String(p.reference || '').toLowerCase().includes(t)
    );
  }

  // Exit modal stock helpers

  updateAvailableDepots(): void {
    const depotsMap = new Map<number, any>();
    if (!this.exitSourceStocks || !Array.isArray(this.exitSourceStocks)) {
      this.depotsList = [];
      return;
    }
    for (const s of this.exitSourceStocks) {
      const whId = s.warehouse_id || s.warehouseId;
      const whName = s.warehouse_name || s.warehouseName;
      if (whId && s.quantity > 0) {
        const idNum = Number(whId);
        if (!depotsMap.has(idNum)) {
          depotsMap.set(idNum, { id: idNum, name: whName || `Depot ${idNum}` });
        }
      }
    }
    this.depotsList = Array.from(depotsMap.values());
  }

  updateAvailableSalles(): void {
    if (!this.selectedDepot) { this.sallesList = []; return; }
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
    if (!salle) { this.locationsList = []; return; }
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

  get filteredRequests(): any[] { return this.sortedByDate; }
  get otherRequests(): any[] { return this.historyRequests; }
  get paginatedOtherRequests(): any[] { return this.paginatedHistory; }

  // Labels & Colors

  get pageTitle(): string {
    if (this.isResponsable) return 'Espace Responsable Logistique';
    if (this.viewMode === 'validation') return 'Tableau de Validation';
    return 'Espace Demandeur';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'Brouillon',
      pending: 'En attente (Manager)',
      validated_by_manager: 'Valide par Manager (Attente Directeur)',
      approved_pending_exit: 'Approuve (Sortie a confirmer)',
      approved: 'Livre / Termine',
      rejected: 'Refuse',
      partiellement_accepte: 'Partiellement accepte'
    };
    return map[status] ?? status;
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      draft: '#64748b',
      approved: '#10b981',
      rejected: '#ef4444',
      pending: '#f59e0b',
      validated_by_manager: '#8b5cf6',
      approved_pending_exit: '#3b82f6',
      partiellement_accepte: '#f97316'
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

  // Pagination & filters

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }

  onDateFilterChange(): void { this.loadRequests(); }

  clearDateFilters(): void {
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.loadRequests();
  }

  // Request CRUD

  openCreateRequestModal(): void { this.openCreateRequestModalWithBatch(null); }

  openCreateRequestModalWithBatch(batchCode: string | null): void {
    if (!this.canCreateRequest) return;
    this.currentBatchCode = batchCode;
    this.requestModalOpen = true;
    this.requestModalEditMode = false;
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null, searchTerm: '', filteredItems: [...this.products] }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  openEditRequestModal(request: any): void {
    this.requestModalOpen = true;
    this.requestModalEditMode = true;
    this.editingRequestId = request.id;
    this.currentBatchCode = request.batch_code || null;

    const itemsToLoad = request.items && request.items.length > 0 ? request.items : [request];
    this.requestLines = itemsToLoad.map((it: any) => ({
      id: it.id,
      product_id: it.product_id,
      requested_quantity: it.requested_quantity,
      searchTerm: it.item_name || '',
      filteredItems: [...this.products]
    }));
    this.cdr.detectChanges();
  }

  closeRequestModal(): void {
    this.requestModalOpen = false;
    this.requestModalEditMode = false;
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null, searchTerm: '', filteredItems: [] }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  addRequestLine(): void {
    this.requestLines.push({ product_id: null, requested_quantity: null, searchTerm: '', filteredItems: [...this.products] });
  }

  onSearchChange(line: any): void {
    line.filteredItems = this.filterProductsByTerm(line.searchTerm);
  }

  removeRequestLine(index: number): void {
    if (this.requestLines.length <= 1) return;
    this.requestLines.splice(index, 1);
  }

  submitRequest(): void {
    let request$: any;

    if (this.requestModalEditMode && this.editingRequestId) {
      if (!this.form.valid) return;
      const val = this.form.value;
      const selectedProduct = this.products.find(p => p.id === val.product_id);
      const itemName = (selectedProduct?.title || val.item_name || '').trim();
      request$ = this.consumableRequestService.updateRequest(this.editingRequestId, {
        product_id: val.product_id || null,
        item_name: itemName,
        requested_quantity: val.requested_quantity,
        status: 'pending'
      });
    } else {
      const validLines = this.requestLines.filter(l => (l.product_id || l.searchTerm) && Number(l.requested_quantity) >= 1);
      if (validLines.length === 0) {
        this.message = 'Ajoutez au moins un produit avec une quantite valide.';
        return;
      }
      const payload: any = {
        batch_code: this.currentBatchCode,
        items: validLines.map(l => {
          const p = this.products.find(prod => prod.id === l.product_id);
          return {
            product_id: l.product_id || null,
            item_name: p ? p.title : l.searchTerm,
            requested_quantity: l.requested_quantity
          };
        }),
        status: 'pending'
      };
      request$ = this.consumableRequestService.createRequest(payload);
    }

    this.loading = true;
    request$.subscribe({
      next: () => {
        this.message = 'Demande traitee avec succes.';
        this.closeRequestModal();
        this.currentBatchCode = null;
        this.loading = false;
        this.loadRequests();
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => { this.message = ''; });
          }, 3000);
        });
      },
      error: (err: any) => {
        this.message = 'Une erreur est survenue.';
        console.error(err);
        this.loading = false;
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
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => { this.message = ''; });
          }, 3000);
        });
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors de la validation.';
        console.error(err);
        this.loading = false;
      }
    });
  }

  deleteRequest(id: number): void {
    if (!this.canEditDeleteOwnRequests || this.deletingRequestId) return;
    if (typeof window !== 'undefined' && !window.confirm('Supprimer cette demande ?')) return;
    this.deletingRequestId = id;
    this.consumableRequestService.deleteRequest(id).subscribe({
      next: () => {
        this.message = 'Demande supprimee.';
        this.deletingRequestId = null;
        this.loadRequests();
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => { this.message = ''; });
          }, 3000);
        });
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors de la suppression.';
        this.deletingRequestId = null;
        console.error(err);
      }
    });
  }

  // Approve / Reject

  openApproveModal(request: any): void {
    if (!this.canApprove) return;

    // Validate status before opening modal
    if (!this.isApprovalValid(request?.status)) {
      this.message = `Cannot approve request with status '${request?.status}'. Valid statuses: pending, validated_by_manager, partiellement_accepte.`;
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.ngZone.run(() => { this.message = ''; });
        }, 4000);
      });
      return;
    }

    this.selectedRequestForApproval = request;

    // Initialise single item quantity
    const suggested = Number(request?.suggested_approved_quantity);
    this.modalApprovedQuantity = Number.isFinite(suggested) ? suggested : Number(request?.requested_quantity || 0);

    // Initialise per-item decisions pour les lots
    this.itemDecisions = {};
    this.itemApprovedQuantities = {};
    this.itemRejectReasons = {};

    if (Array.isArray(request?.items)) {
      for (const item of request.items) {
        // Par defaut : aucune decision prise (pending)
        this.itemDecisions[item.id] = 'pending';
        const suggestedQty = Number(item?.suggested_approved_quantity);
        this.itemApprovedQuantities[item.id] = Number.isFinite(suggestedQty)
          ? suggestedQty
          : Number(item?.requested_quantity || 0);
        this.itemRejectReasons[item.id] = '';
      }
    }
  }

  closeApproveModal(): void {
    this.selectedRequestForApproval = null;
    this.modalApprovedQuantities = {};
    this.itemDecisions = {};
    this.itemApprovedQuantities = {};
    this.itemRejectReasons = {};
    this.approving = false;
  }

  useSuggestedQuantity(): void {
    if (!this.selectedRequestForApproval) return;
    const suggested = Number(this.selectedRequestForApproval?.suggested_approved_quantity);
    this.modalApprovedQuantity = Number.isFinite(suggested)
      ? suggested
      : Number(this.selectedRequestForApproval?.requested_quantity || 0);
  }

  /** Definir la decision pour un item dans un lot */
  setItemDecision(item: any, decision: ItemDecision): void {
    this.itemDecisions[item.id] = decision;
    // Si on approuve, pre-remplir avec suggestion si pas encore defini
    if (decision === 'approved' && !this.itemApprovedQuantities[item.id]) {
      const suggested = Number(item?.suggested_approved_quantity);
      this.itemApprovedQuantities[item.id] = Number.isFinite(suggested)
        ? suggested
        : Number(item?.requested_quantity || 0);
    }
  }

  /** Utiliser la quantite suggessee pour un item specifique */
  useSuggestedForItem(item: any): void {
    const suggested = Number(item?.suggested_approved_quantity);
    this.itemApprovedQuantities[item.id] = Number.isFinite(suggested)
      ? suggested
      : Number(item?.requested_quantity || 0);
  }

  /** Compter les decisions d'un type specifique */
  countDecisions(decision: ItemDecision): number {
    if (!this.selectedRequestForApproval?.items) return 0;
    return this.selectedRequestForApproval.items.filter(
      (item: any) => this.itemDecisions[item.id] === decision
    ).length;
  }

  /**
   * Approbation produit par produit pour un lot.
   * Gere le cas mixte : certains approuves, certains rejetes.
   * Chaque produit peut avoir un statut different.
   */
  confirmApprovePerItem(): void {
    if (!this.canApprove || !this.selectedRequestForApproval || this.approving) return;

    const items = this.selectedRequestForApproval.items as any[];
    const approvedItems = items.filter(item => this.itemDecisions[item.id] === 'approved');
    const rejectedItems = items.filter(item => this.itemDecisions[item.id] === 'rejected');

    if (approvedItems.length === 0) {
      this.message = 'Approuvez au moins un produit ou utilisez le bouton Rejeter pour rejeter tout le lot.';
      return;
    }

    this.approving = true;

    // Valider les quantites des produits approuves
    for (const item of approvedItems) {
      const qty = Number(this.itemApprovedQuantities[item.id]);
      const maxStock = Number(item.available_stock ?? item.requested_quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) {
        this.message = `Quantite invalide pour le produit : ${item.item_name}`;
        this.approving = false;
        return;
      }
      if (qty > maxStock) {
        this.message = `Quantite trop elevee pour : ${item.item_name} (max: ${maxStock})`;
        this.approving = false;
        return;
      }
    }

    // Construire le payload pour approbation partielle
    const payload: any = {
      approved_quantities: {},
      rejections: {}
    };

    // Ajouter les quantités approuvées
    for (const item of approvedItems) {
      payload.approved_quantities[item.id] = Number(this.itemApprovedQuantities[item.id]);
    }

    // Ajouter les rejets
    for (const item of rejectedItems) {
      payload.rejections[item.id] = this.itemRejectReasons[item.id] || 'Rejete par le directeur';
    }

    // Envoyer un seul appel API pour tout le lot
    this.consumableRequestService.approveRequest(this.selectedRequestForApproval.id, payload).subscribe({
      next: () => {
        const approvedCount = approvedItems.length;
        const rejectedCount = rejectedItems.length;
        const pendingCount = items.length - approvedCount - rejectedCount;

        if (rejectedCount > 0 && approvedCount > 0) {
          this.message = `Lot traite : ${approvedCount} produit(s) approuve(s), ${rejectedCount} produit(s) rejete(s)${pendingCount > 0 ? `, ${pendingCount} sans decision` : ''}.`;
        } else if (approvedCount > 0) {
          this.message = `${approvedCount} produit(s) approuve(s) avec succes.`;
        } else {
          this.message = `${rejectedCount} produit(s) rejete(s).`;
        }

        this.closeApproveModal();
        this.loadRequests();
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => { this.message = ''; });
          }, 4000);
        });
      },
      error: (err: any) => {
        // Extract detailed error message from backend
        const apiError = err?.error?.message;
        const currentStatus = err?.error?.current_status;
        const validStatuses = err?.error?.valid_statuses;

        if (currentStatus && validStatuses) {
          this.message = `Statut invalide: ${currentStatus}. Statuts acceptes: ${validStatuses.join(', ') || 'none'}.`;
        } else if (apiError) {
          this.message = apiError;
        } else {
          this.message = 'Erreur lors du traitement du lot.';
        }
        console.error(err);
        this.approving = false;
      }
    });
  }

  /** Approbation produit unique (non-lot) */
  confirmApprove(): void {
    if (!this.canApprove || !this.selectedRequestForApproval || this.approving) return;
    const request = this.selectedRequestForApproval;

    const maxAllowed = Number(request?.available_stock ?? request?.requested_quantity ?? 0);
    const approvedQuantity = Number(this.modalApprovedQuantity);
    if (!Number.isFinite(approvedQuantity) || approvedQuantity < 0) {
      this.message = 'Quantite approuvee invalide.';
      return;
    }
    if (approvedQuantity > maxAllowed) {
      this.message = `La quantite approuvee ne doit pas depasser ${maxAllowed}.`;
      return;
    }

    this.approving = true;

    // Si c'est un lot, utiliser approved_quantities pour chaque item
    let payload: { approved_quantity?: number; approved_quantities?: Record<number, number> } = {};

    if (Array.isArray(request?.items) && request.items.length > 1) {
      // Lot : envoyer approved_quantities pour chaque item
      payload.approved_quantities = {};
      for (const item of request.items) {
        payload.approved_quantities[item.id] = approvedQuantity;
      }
    } else {
      // Produit unique : envoyer approved_quantity
      payload.approved_quantity = approvedQuantity;
    }

    this.consumableRequestService.approveRequest(request.id, JSON.parse(JSON.stringify(payload))).subscribe({
      next: (res: any) => {
        this.message = res?.status === 'validated_by_manager'
          ? 'Demande validee et transmise a la direction.'
          : 'Demande approuvee avec succes.';
        this.closeApproveModal();
        this.loadRequests();
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => { this.message = ''; });
          }, 3000);
        });
      },
      error: (err: any) => {
        // Extract detailed error message from backend
        const apiError = err?.error?.message;
        const currentStatus = err?.error?.current_status;
        const validStatuses = err?.error?.valid_statuses;

        if (currentStatus && validStatuses) {
          this.message = `Statut invalide: ${currentStatus}. Statuts acceptes: ${validStatuses.join(', ') || 'none'}.`;
        } else if (apiError) {
          this.message = apiError;
        } else {
          this.message = 'Erreur lors de l\'approbation.';
        }
        console.error(err);
        this.approving = false;
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
        this.message = 'Demande rejetee.';
        this.closeRejectModal();
        this.loadRequests();
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => { this.message = ''; });
          }, 3000);
        });
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors du rejet.';
        console.error(err);
        this.rejecting = false;
      }
    });
  }

  rejectRequest(id: number): void {
    const req = this.requests.find(r => r.id === id);
    if (req) this.openRejectModal(req);
  }

  // Details Modal

  openDetailsModal(request: any): void { this.selectedRequestDetails = request; }
  closeDetailsModal(): void { this.selectedRequestDetails = null; }

  canEditFromDetails(request: any): boolean {
    const status = String(request?.status || '').toLowerCase();
    return (status === 'pending' || status === 'draft') && this.canEditDeleteOwnRequests;
  }

  editItemFromDetails(item: any): void { this.closeDetailsModal(); this.openEditRequestModal(item); }
  deleteItemFromDetails(item: any): void { this.closeDetailsModal(); this.deleteRequest(item.id); }
  approveFromDetails(item: any): void { this.closeDetailsModal(); this.openApproveModal(item); }

  // PDF

  downloadPdf(request: any): void {
    if (!request?.pdf_path) {
      alert('Le PDF n\'est pas disponible pour cette demande.');
      return;
    }
    window.open(`/api/docs/${request.pdf_path}`, '_blank');
  }

  // Exit Modal

  openExitModal(request: any): void {
    const item = (request.items && request.items.length === 1) ? request.items[0] : request;
    this.selectedRequestForExit = request;
    this.exitSourceLocationId = null;
    this.selectedDepot = null;
    this.selectedSalle = null;
    this.selectedEmplacement = null;
    this.exitMotif = 'Remise physique effectuee';
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

    if (!productId) {
      const name = (item.item_name || request.item_name || item.product?.title || '').toLowerCase().trim();
      if (name) {
        const found = this.products.find(p => (p.title || '').toLowerCase().trim() === name);
        if (found) productId = found.id;
      }
    }

    if (productId) {
      this.consumableRequestService.getProductStocks(productId).subscribe({
        next: (res: any) => {
          this.exitSourceStocks = Array.isArray(res) ? res : [];
          this.updateAvailableDepots();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Erreur chargement stocks:', err);
          this.exitSourceStocks = [];
          this.depotsList = [];
          this.message = 'Erreur chargement stocks.';
          this.cdr.detectChanges();
        }
      });
    } else {
      console.error('Aucun product ID determine pour cette demande.');
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
      const s = this.selectedEmplacement;
      if (s.warehouse_location_id) payload.source_warehouse_location_id = s.warehouse_location_id;
      else if (s.cabinet_id) payload.source_cabinet_id = s.cabinet_id;
    }

    this.consumableRequestService.confirmExit(this.selectedRequestForExit.id, payload).subscribe({
      next: () => {
        this.message = 'Remise effectuee et stock mis a jour.';
        this.confirmingExit = false;
        this.closeExitModal();
        this.loadRequests();
      },
      error: (err: any) => {
        let errorMsg = 'Inconnue';
        if (err.error?.errors) errorMsg = Object.values(err.error.errors).flat().join(' ');
        else if (err.error?.message) errorMsg = err.error.message;
        this.message = 'Erreur : ' + errorMsg;
        this.confirmingExit = false;
      }
    });
  }

  onDepotChange(): void {
    this.selectedSalle = null;
    this.selectedEmplacement = null;
    this.updateAvailableSalles();
  }

  onSalleChange(): void {
    this.selectedEmplacement = null;
    this.updateAvailableEmplacements();
  }

  onEmplacementChange(): void {
    if (!this.selectedEmplacement) { this.exitSourceLocationId = null; return; }
    this.exitSourceLocationId = this.selectedEmplacement.warehouse_location_id
      || this.selectedEmplacement.cabinet_id
      || this.selectedEmplacement.id
      || null;
  }

  // Helpers

  /** Check if a request status is valid for approval workflow */
  isApprovalValid(status: string): boolean {
    const validStatuses = ['pending', 'validated_by_manager', 'partiellement_accepte'];
    return validStatuses.includes(String(status || '').toLowerCase());
  }

  toggleDetails(id: number): void {
    if (this.expandedRequestIds.has(id)) this.expandedRequestIds.delete(id);
    else this.expandedRequestIds.add(id);
  }

  private resolveAccessRights(user: any): void {
    const isDirector = this.isDirectorUser(user);
    this.isResponsable = this.authService.userHasAnyRole(user, [
      'Responsable de stock', 'Responsable', 'Agent de stock', 'Agent', 'Administrateur'
    ]);

    this.canApprove = (this.viewMode === 'validation') || isDirector || this.isResponsable;

    if (this.isResponsable) {
      this.canCreateRequest = this.viewMode === 'request' && !isDirector;
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
