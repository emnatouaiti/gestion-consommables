import { ChangeDetectorRef, Component, Inject, NgZone, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core'; // Refresh
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConsumableRequestService } from '../../core/services/consumable-request.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminWarehouseService } from '../../core/services/admin-warehouse.service';
import { forkJoin } from 'rxjs';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

type NavTab = 'pending' | 'history' | 'exits';
type RequestViewMode = 'table' | 'columns';

// Decision individuelle par produit dans un lot
type ItemDecision = 'approved' | 'rejected' | 'pending';

@Component({
  selector: 'app-consumable-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DatePipe, ConfirmModalComponent],
  templateUrl: './consumable-request.html',
  styleUrls: ['./consumable-request.css']
})
export class ConsumableRequestComponent implements OnInit, OnDestroy {

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
  isDirector = false;

  // Filters
  statusFilter = 'all';
  startDateFilter = '';
  endDateFilter = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  pageSize = 10;
  totalPages = 1;
  requestViewMode: RequestViewMode = 'table';
  productSearchTerm = '';

  // Request Modal
  form: FormGroup;
  requestModalOpen = false;
  requestModalEditMode = false;
  requestModalErrorMessage = '';
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
  approveModalErrorMessage = '';
  depotWarnings: any[] = [];
  depotWarningMessage: string = '';

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

  // Exit Modal - Per product location selection for batches
  selectedRequestForExit: any = null;
  exitRequestsForExit: any[] = []; // Array of requests in the batch
  exitProductLocations: { [productId: number]: { depot: any; salle: any; emplacement: any; stocks: any[]; depotsList: any[]; sallesList: any[]; locationsList: any[] } } = {};
  exitMotif = '';
  exitRequesterName = '';
  exitLocalText = '';
  confirmingExit = false;
  // Legacy single-product fields (for backward compatibility)
  exitSourceStocks: any[] = [];
  exitSourceLocationId: number | null = null;
  selectedDepot: any = null;
  selectedSalle: any = null;
  selectedEmplacement: any = null;
  depotsList: any[] = [];
  sallesList: any[] = [];
  locationsList: any[] = [];
  cabinetsList: any[] = [];

  // Confirm Modal state
  confirmModalVisible = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmText = 'Confirmer';
  confirmModalCancelText = 'Annuler';
  confirmModalType: 'danger' | 'warning' | 'info' = 'warning';
  confirmModalAlertOnly = false;
  confirmModalAction: (() => void) | null = null;

  // Expanded rows
  expandedRequestIds = new Set<number>();
  private autoRefreshHandle: any = null;

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
      next: (user: any) => {
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
        this.startAutoRefresh();
        this.cdr.detectChanges();
      },
      error: () => {
        this.message = 'Impossible de charger les informations utilisateur.';
        this.cdr.detectChanges();
      }
    });
    // Correction NG0100 : forcer la detection de changements apres modification des droits
    this.cdr.detectChanges();

  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }


  // Data loading

  loadProducts(): void {
    this.loadingProducts = true;
    this.consumableRequestService.getProducts().subscribe({
      next: (data: any) => {
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

    if (this.viewMode === 'request') params.own = 1;
    this.consumableRequestService.getRequests(params).subscribe({
      next: (data: any) => {
        const reqs = Array.isArray(data) ? data : [];
        this.requests = reqs.sort((a, b) => {
          const da = new Date(a?.created_at || 0).getTime();
          const db = new Date(b?.created_at || 0).getTime();
          return db - da;
        });
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshHandle = setInterval(() => {
      if (this.isResponsable && (this.activeTab === 'exits' || this.activeTab === 'history') && !this.loading) {
        this.loadRequests();
      }
    }, 10000);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshHandle) {
      clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }

  // Navigation

  setTab(tab: NavTab): void {
    this.activeTab = tab;
    this.currentPage = 1;
    if (tab === 'exits') {
      this.loadRequests();
    }
  }

  get tabs(): Array<{ id: NavTab; label: string; count?: number }> {
    const tabs: Array<{ id: NavTab; label: string; count?: number }> = [];

    // Only show "Demandes a valider" for directors, not for responsables
    const isDirector = this.isDirectorUser(this.currentUser);
    if (this.viewMode === 'validation' && isDirector) {
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
    return this.requests; // already sorted in loadRequests
  }

  get pendingValidationRequests(): any[] {
    const isDirector = this.isDirectorUser(this.currentUser);
    const isManager = this.isResponsable;

    return this.sortedByDate.filter(r => {
      const s = r.status?.toLowerCase();
      if (isDirector) {
        // Directors can see: pending (direct submissions) and validated_by_manager
        return ['pending', 'validated_by_manager'].includes(s);
      }
      if (isManager) {
        return s === 'pending';
      }
      return false;
    });
  }

  get pendingExitRequests(): any[] {
    const rows: any[] = [];
    const seen = new Set<string | number>();

    for (const group of this.sortedByDate) {
      const items = Array.isArray(group?.items) && group.items.length > 0 ? group.items : [group];
      const pendingItems = items.filter((it: any) => String(it?.status || '').toLowerCase() === 'approved_pending_exit');

      if (pendingItems.length === 0) continue;

      const groupId = group.batch_code || group.id;
      if (seen.has(groupId)) continue;
      seen.add(groupId);

      rows.push({
        ...group,
        items: pendingItems,
        item_name: pendingItems.length > 1 ? pendingItems.length + ' produits' : pendingItems[0].item_name,
        requested_quantity: pendingItems.reduce((sum: number, it: any) => sum + Number(it.requested_quantity || 0), 0),
        approved_quantity: pendingItems.reduce((sum: number, it: any) => sum + Number(it.approved_quantity || 0), 0)
      });
    }

    return rows;
  }

  get historyRequests(): any[] {
    let data = this.sortedByDate;
    const isDirector = this.isDirectorUser(this.currentUser);

    if (this.isResponsable) {
      // Historique responsable: uniquement les demandes deja livrees/terminees
      data = data.filter(r => r.status === 'approved');
      return data;
    }

    // Directeur: peut maintenant voir les demandes "Livre / Termine"
    // (filter removed to allow directors to see delivered status)

    if (this.viewMode === 'validation') {
      data = data.filter(r => r.status !== 'pending' && r.status !== 'draft');
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

  get paginatedPendingExitRequests(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.pendingExitRequests.slice(start, start + this.pageSize);
  }

  get totalPagesComputed(): number {
    const total = this.activeTab === 'pending'
      ? this.pendingValidationRequests.length
      : this.activeTab === 'exits'
        ? this.pendingExitRequests.length
        : this.historyRequests.length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  get computedTotalPages(): number {
    return this.totalPagesComputed;
  }

  prevPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage -= 1;
  }

  nextPage(): void {
    if (this.currentPage >= this.computedTotalPages) return;
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
    this.requestModalErrorMessage = '';
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null, searchTerm: '', filteredItems: [...this.products] }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  openEditRequestModal(request: any): void {
    this.requestModalOpen = true;
    this.requestModalEditMode = true;
    this.requestModalErrorMessage = '';
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
    this.requestModalErrorMessage = '';
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

    const validLines = this.requestLines.filter(l => (l.product_id || l.searchTerm) && Number(l.requested_quantity) >= 1);
    if (validLines.length === 0) {
      this.requestModalErrorMessage = 'Veuillez au moins un produit avec une quantite valide.';
      return;
    }

    if (this.requestModalEditMode && this.editingRequestId && !this.currentBatchCode) {
      // Edit a single old request (no batch_code)
      const l = validLines[0];
      const p = this.products.find(prod => prod.id === l.product_id);
      request$ = this.consumableRequestService.updateRequest(this.editingRequestId, {
        product_id: l.product_id || null,
        item_name: p ? p.title : l.searchTerm,
        requested_quantity: l.requested_quantity
      });
    } else {
      // Create new request or edit a batch request (which will replace the batch via createRequest)
      const payload: any = {
        batch_code: this.currentBatchCode,
        items: validLines.map(l => {
          const p = this.products.find(prod => prod.id === l.product_id);
          return {
            product_id: l.product_id || null,
            item_name: p ? p.title : l.searchTerm,
            requested_quantity: l.requested_quantity
          };
        })
      };
      request$ = this.consumableRequestService.createRequest(payload);
    }

    this.loading = true;
    this.closeRequestModal(); // Fermer la modal immediatement

    request$.subscribe({
      next: () => {
        this.message = this.requestModalEditMode ? 'Demande modifiee avec succes.' : 'demande ajouter avec succes non traite';
        this.cdr.detectChanges();
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
    this.cdr.detectChanges();
    this.consumableRequestService.updateRequest(id, { status: 'pending' }).subscribe({
      next: () => {
        this.message = 'Demande mise en attente.';
        this.cdr.detectChanges();
        this.loadRequests();
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => { this.message = ''; this.cdr.detectChanges(); });
          }, 3000);
        });
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors de la validation.';
        this.cdr.detectChanges();
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openConfirmModal(
    title: string,
    message: string,
    action: () => void,
    type: 'danger' | 'warning' | 'info' = 'warning',
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    alertOnly = false
  ): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalAction = action;
    this.confirmModalType = type;
    this.confirmModalConfirmText = confirmText;
    this.confirmModalCancelText = cancelText;
    this.confirmModalAlertOnly = alertOnly;
    this.confirmModalVisible = true;
  }

  onConfirmModalConfirmed(): void {
    if (this.confirmModalAction) {
      this.confirmModalAction();
    }
    this.confirmModalVisible = false;
  }

  deleteRequest(id: number): void {
    if (!this.canEditDeleteOwnRequests || this.deletingRequestId) return;
    
    this.openConfirmModal(
      'Supprimer la demande',
      'Supprimer cette demande ?',
      () => {
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
      },
      'danger',
      'Supprimer'
    );
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
        if (Number(item?.available_stock) === 0) {
          this.itemDecisions[item.id] = 'rejected';
          this.itemApprovedQuantities[item.id] = 0;
          this.itemRejectReasons[item.id] = 'Rupture de stock';
        } else {
          this.itemDecisions[item.id] = 'pending';
          const suggestedQty = Number(item?.suggested_approved_quantity);
          this.itemApprovedQuantities[item.id] = Number.isFinite(suggestedQty)
            ? suggestedQty
            : Number(item?.requested_quantity || 0);
          this.itemRejectReasons[item.id] = '';
        }
      }
    }
  }

  closeApproveModal(): void {
    this.selectedRequestForApproval = null;
    this.modalApprovedQuantities = {};
    this.itemDecisions = {};
    this.itemApprovedQuantities = {};
    this.itemRejectReasons = {};
    this.depotWarnings = [];
    this.depotWarningMessage = '';
    this.approving = false;
  }

  /** Definir la decision pour un item dans un lot */
  setItemDecision(item: any, decision: 'pending'|'approved'|'rejected'): void {
    this.itemDecisions[item.id] = decision;
    // Si on approuve, pre-remplir avec suggestion si pas encore defini
    if (decision === 'approved' && !this.itemApprovedQuantities[item.id]) {
      const suggested = Number(item?.suggested_approved_quantity);
      this.itemApprovedQuantities[item.id] = Number.isFinite(suggested)
        ? suggested
        : Number(item?.requested_quantity || 0);
    }
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

    // Ajouter les quantites approuvees
    for (const item of approvedItems) {
      payload.approved_quantities[item.id] = Number(this.itemApprovedQuantities[item.id]);
    }

    // Ajouter les rejets
    for (const item of rejectedItems) {
      payload.rejections[item.id] = this.itemRejectReasons[item.id] || 'Rejete par le directeur';
    }

    // Envoyer un seul appel API pour tout le lot
    this.consumableRequestService.approveRequest(this.selectedRequestForApproval.id, payload).subscribe({
      next: (res: any) => {
        const approvedCount = approvedItems.length;
        const rejectedCount = rejectedItems.length;
        const pendingCount = items.length - approvedCount - rejectedCount;

        // Handle depot warnings
        if (res?.depot_warnings && res.depot_warnings.length > 0) {
          this.depotWarnings = res.depot_warnings;
          this.depotWarningMessage = res.warning_message || 'Certains produits sont disponibles dans plusieurs depots.';
        }
        if (res?.insufficient_warnings?.length > 0) {
          const details = res.insufficient_warnings
            .map((w: any) => `${w.product}: manque ${w.missing}`)
            .join(', ');
          this.message = `Stock insuffisant pour certains produits (${details}). Distribution faite selon disponibilite.`;
        }

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
            this.ngZone.run(() => {
              this.message = '';
              this.depotWarnings = [];
              this.depotWarningMessage = '';
            });
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
      this.approveModalErrorMessage = 'Quantite approuvee invalide.';
      return;
    }
    if (approvedQuantity > maxAllowed) {
      this.approveModalErrorMessage = `La quantite approuvee ne doit pas depasser ${maxAllowed}.`;
      return;
    }

    this.approving = true;
    this.approveModalErrorMessage = '';

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
        // Handle depot warnings
        if (res?.depot_warnings && res.depot_warnings.length > 0) {
          this.depotWarnings = res.depot_warnings;
          this.depotWarningMessage = res.warning_message || 'Certains produits sont disponibles dans plusieurs depots.';
        }
        if (res?.insufficient_warnings?.length > 0) {
          const details = res.insufficient_warnings
            .map((w: any) => `${w.product}: manque ${w.missing}`)
            .join(', ');
          this.message = `Stock insuffisant pour certains produits (${details}). Distribution faite selon disponibilite.`;
        }

        this.message = res?.status === 'validated_by_manager'
          ? 'Demande validee et transmise a la direction.'
          : 'Demande approuvee avec succes.';
        this.closeApproveModal();
        this.loadRequests();
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => {
              this.message = '';
              this.depotWarnings = [];
              this.depotWarningMessage = '';
            });
          }, 3000);
        });
      },
      error: (err: any) => {
        // Extract detailed error message from backend
        const apiError = err?.error?.message;
        const currentStatus = err?.error?.current_status;
        const validStatuses = err?.error?.valid_statuses;

        if (currentStatus && validStatuses) {
          this.approveModalErrorMessage = `Statut invalide: ${currentStatus}. Statuts acceptes: ${validStatuses.join(', ') || 'none'}.`;
        } else if (apiError) {
          this.approveModalErrorMessage = apiError;
        } else {
          this.approveModalErrorMessage = 'Erreur lors de l\'approbation.';
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

  downloadPdfApproved(request: any): void {
    if (!request?.pdf_path_approved) {
      alert('Le PDF des produits acceptes n\'est pas disponible.');
      return;
    }
    window.open(`/api/docs/${request.pdf_path_approved}`, '_blank');
  }

  downloadPdfRejected(request: any): void {
    if (!request?.pdf_path_rejected) {
      alert('Le PDF des produits refuses n\'est pas disponible.');
      return;
    }
    window.open(`/api/docs/${request.pdf_path_rejected}`, '_blank');
  }

  // Exit Modal - Per product location selection for batches

  /** Load stocks for a specific product and initialize its location data */
  private loadProductStocksForExit(productId: number, item: any): void {
    // Initialize product location data structure
    this.exitProductLocations[productId] = {
      depot: null,
      salle: null,
      emplacement: null,
      stocks: [],
      depotsList: [],
      sallesList: [],
      locationsList: []
    };

    this.consumableRequestService.getProductStocks(productId).subscribe({
      next: (res: any) => {
        let stocks = Array.isArray(res) ? res : [];
        const productLoc = this.exitProductLocations[productId];
        // Safety filter: for responsable/agent keep only own depot stocks client-side too.
        if (this.isResponsable && this.currentUser?.depot_id) {
          const userDepotId = Number(this.currentUser.depot_id);
          stocks = stocks.filter(s => Number(this.getStockWarehouseId(s) || 0) === userDepotId);
        }
        productLoc.stocks = stocks;

        // Build depots list from stocks - include all depots with stock (quantity > 0)
        const depotsMap = new Map<number, any>();
        for (const s of stocks) {
          const whId = s.warehouse_id || s.warehouseId;
          const whName = s.warehouse_name || s.warehouseName;
          if (whId && s.quantity > 0) {
            const idNum = Number(whId);
            if (!depotsMap.has(idNum)) {
              depotsMap.set(idNum, { id: idNum, name: whName || `Depot ${idNum}` });
            }
          }
        }
        productLoc.depotsList = Array.from(depotsMap.values());

        // Responsable/agent: depot verrouille sur leur depot uniquement
        if (this.isResponsable && this.currentUser?.depot_id) {
          const userDepotId = Number(this.currentUser.depot_id);
          productLoc.depotsList = productLoc.depotsList.filter(d => Number(d.id) === userDepotId);

          const userDepot = productLoc.depotsList[0] || {
            id: userDepotId,
            name: this.currentUser.depot?.name || `Depot ${userDepotId}`
          };
          productLoc.depotsList = [userDepot];
          productLoc.depot = userDepot;
          this.onProductDepotChange(productId);
        }

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur chargement stocks pour produit ' + productId + ':', err);
        this.message = 'Erreur chargement stocks pour ' + (item.item_name || 'produit');
        this.cdr.detectChanges();
      }
    });
  }

  openExitModal(request: any): void {
    this.selectedRequestForExit = request;
    this.exitMotif = 'Remise physique effectuee';
    this.exitRequesterName = request.requester_name || (request.user?.nomprenom || request.user?.name || '');
    this.exitLocalText = request.requester_poste || '';
    this.exitProductLocations = {};

    // Determine if this is a batch (multiple items) or single item
    const items = request.items && request.items.length > 0 ? request.items : [request];

    // Load stocks for each product in the request
    for (const item of items) {
      let productId = item.product_id || request.product_id || item.product?.id;

      if (!productId) {
        const name = (item.item_name || request.item_name || item.product?.title || '').toLowerCase().trim();
        if (name) {
          const found = this.products.find(p => (p.title || '').toLowerCase().trim() === name);
          if (found) productId = found.id;
        }
      }

      if (productId) {
        this.loadProductStocksForExit(productId, item);
      }
    }
  }

  closeExitModal(): void {
    this.selectedRequestForExit = null;
    this.exitProductLocations = {};
    // Legacy cleanup
    this.exitSourceStocks = [];
    this.selectedDepot = null;
    this.selectedSalle = null;
    this.selectedEmplacement = null;
  }

  /** Get product location data for a specific product */
  getProductLocation(productId: number) {
    return this.exitProductLocations[productId] || null;
  }

  /** Resolve product id reliably for exit modal (single or batch item). */
  getExitProductId(item: any): number | null {
    const direct = Number(item?.product_id || item?.product?.id || 0);
    if (direct > 0) return direct;

    const name = String(item?.item_name || item?.product?.title || '').toLowerCase().trim();
    if (!name) return null;

    const found = this.products.find(p => String(p?.title || '').toLowerCase().trim() === name);
    return found?.id ? Number(found.id) : null;
  }

  /** Update salles list when depot changes for a specific product */
  onProductDepotChange(productId: number): void {
    const productLoc = this.exitProductLocations[productId];
    if (!productLoc) return;

    if (this.isResponsable && this.currentUser?.depot_id) {
      const userDepotId = Number(this.currentUser.depot_id);
      if (!productLoc.depot || Number(productLoc.depot.id) !== userDepotId) {
        const userDepot = productLoc.depotsList.find(d => Number(d.id) === userDepotId)
          || { id: userDepotId, name: this.currentUser.depot?.name || `Depot ${userDepotId}` };
        productLoc.depot = userDepot;
      }
    }

    productLoc.salle = null;
    productLoc.emplacement = null;
    productLoc.sallesList = [];
    productLoc.locationsList = [];

    if (productLoc.depot) {
      const sallesMap = new Map();
      for (const s of productLoc.stocks) {
        const whId = s.warehouse_id || s.warehouseId;
        const roomId = s.room_id || s.roomId;
        const roomName = s.room_name || s.roomName;
        if (whId == productLoc.depot.id && roomId && !sallesMap.has(roomId)) {
          sallesMap.set(roomId, { id: roomId, name: roomName || `Salle ${roomId}` });
        }
      }
      productLoc.sallesList = Array.from(sallesMap.values());
    }
  }

  /** Update locations list when salle changes for a specific product */
  onProductSalleChange(productId: number): void {
    const productLoc = this.exitProductLocations[productId];
    if (!productLoc) return;

    productLoc.emplacement = null;
    productLoc.locationsList = [];

    if (productLoc.salle) {
      const selectedRoomId = Number(productLoc.salle.id);
      const selectedDepotId = Number(productLoc.depot?.id || 0);

      const filtered = productLoc.stocks.filter(s => {
        const roomId = Number(this.getStockRoomId(s) || 0);
        const depotId = Number(this.getStockWarehouseId(s) || 0);
        const qty = Number(s?.quantity || 0);
        return roomId === selectedRoomId && (!selectedDepotId || depotId === selectedDepotId) && qty > 0;
      });

      // Deduplicate by exact source id (location or cabinet) to avoid mixed/duplicate options.
      const seen = new Map<string, any>();
      for (const s of filtered) {
        const key = s?.warehouse_location_id
          ? `loc:${s.warehouse_location_id}`
          : s?.cabinet_id
            ? `cab:${s.cabinet_id}`
            : `row:${s?.id}`;
        if (seen.has(key)) {
          const existing = seen.get(key);
          existing.quantity = Number(existing.quantity) + Number(s.quantity || 0);
        } else {
          seen.set(key, { ...s });
        }
      }
      productLoc.locationsList = Array.from(seen.values());
    }
  }

  private getStockWarehouseId(s: any): number | null {
    const v = s?.warehouse_id ?? s?.warehouseId ?? null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private getStockRoomId(s: any): number | null {
    const v = s?.room_id ?? s?.roomId ?? null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /** Get label for emplacement */
  getEmplacementLabel(s: any): string {
    const type = s.cabinet_id ? 'Armoire' : 'Empl.';
    const label = s.location_label || 'Inconnu';
    return `${type}: ${label} (Stock: ${s.quantity})`;
  }

  /** Check if all products have selected locations */
  areAllLocationsSelected(): boolean {
    const items = this.selectedRequestForExit?.items?.length > 0
      ? this.selectedRequestForExit.items
      : [this.selectedRequestForExit];

    for (const item of items) {
      const productId = this.getExitProductId(item) || this.getExitProductId(this.selectedRequestForExit);
      if (!productId) continue;

      const productLoc = this.exitProductLocations[productId];
      if (!productLoc || !productLoc.emplacement) {
        return false;
      }
    }
    return true;
  }

  confirmExitAction(): void {
    if (!this.selectedRequestForExit) return;
    this.confirmingExit = true;

    const items = this.selectedRequestForExit.items && this.selectedRequestForExit.items.length > 0
      ? this.selectedRequestForExit.items
      : [this.selectedRequestForExit];

    const itemsPayload = items.map((item: any) => {
      const productId = this.getExitProductId(item) || this.getExitProductId(this.selectedRequestForExit);
      const productLoc = productId ? this.exitProductLocations[productId] : null;
      const s = productLoc?.emplacement;
      return {
        id: item.id,
        source_warehouse_location_id: s?.warehouse_location_id || null,
        source_cabinet_id: s?.cabinet_id || null
      };
    });

    const destinationText = this.exitRequesterName +
      (this.selectedRequestForExit.requester_siege ? ' - ' + this.selectedRequestForExit.requester_siege : '') +
      (this.exitLocalText ? ' (' + this.exitLocalText + ')' : '');

    const payload: any = {
      motif: this.exitMotif,
      destination_text: destinationText,
      exit_mode: 'depot',
      items: itemsPayload
    };

    // Keep top-level source for backward compatibility
    if (itemsPayload.length > 0) {
      payload.source_warehouse_location_id = itemsPayload[0].source_warehouse_location_id;
      payload.source_cabinet_id = itemsPayload[0].source_cabinet_id;
    }

    this.consumableRequestService.confirmExit(this.selectedRequestForExit.id, payload).subscribe({
      next: (res: any) => {
        const depotName = res?.depot_name ? ` (Depot: ${res.depot_name})` : '';
        this.message = 'Remise effectuee et stock mis a jour.' + depotName;
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
    this.isDirector = this.isDirectorUser(user);
    this.isResponsable = this.authService.userHasAnyRole(user, [
      'Responsable de stock', 'Responsable', 'Agent de stock', 'Agent', 'Administrateur'
    ]);

    this.canApprove = (this.viewMode === 'validation') || this.isDirector || this.isResponsable;

    if (this.isResponsable) {
      this.canCreateRequest = this.viewMode === 'request' && !this.isDirector;
      this.canEditDeleteOwnRequests = this.viewMode === 'request';
    } else {
      this.canCreateRequest = this.viewMode === 'request';
      this.canEditDeleteOwnRequests = this.viewMode === 'request';
    }
  }

  private isDirectorUser(user: any): boolean {
    // Only the role determines Director status - not the poste (job title)
    return this.authService.userHasAnyRole(user, ['Directeur', 'directeur', 'durecteur', 'director']);
  }
}


