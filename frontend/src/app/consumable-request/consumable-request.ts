import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConsumableRequestService } from '../services/consumable-request.service';
import { AuthService } from '../core/services/auth.service';
import { AdminWarehouseService } from '../features/admin/services/admin-warehouse.service';

@Component({
  selector: 'app-consumable-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './consumable-request.html',
  styleUrls: ['./consumable-request.css']
})
export class ConsumableRequestComponent implements OnInit {
  requests: any[] = [];
  products: any[] = [];
  expandedRequestIds = new Set<number>();
  productSearchTerm = '';
  form: FormGroup;
  loading = false;
  loadingProducts = false;
  canApprove = false;
  canCreateRequest = true;
  message = '';
  currentUser: any = null;
  viewMode: 'request' | 'validation' = 'request';
  selectedRequestForApproval: any = null;
  modalApprovedQuantity = 0;
  approving = false;
  canEditDeleteOwnRequests = false;
  isResponsable = false;
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
  requestModalOpen = false;
  requestModalEditMode = false;
  editingRequestId: number | null = null;
  deletingRequestId: number | null = null;
  requestLines: Array<{ product_id: number | null; requested_quantity: number | null }> = [
    { product_id: null, requested_quantity: null }
  ];
  // When creating, optionally append to an existing batch (draft)
  currentBatchCode: string | null = null;

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
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const routeMode = this.route.snapshot.data['mode'];
    this.viewMode = routeMode === 'validation' ? 'validation' : 'request';
    this.canCreateRequest = this.viewMode === 'request';

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.resolveAccessRights(user);

        if (this.canCreateRequest) {
          this.loadProducts();
        }

        this.loadRequests();
        this.cdr.detectChanges();
      },
      error: () => {
        this.message = 'Impossible de charger les informations utilisateur.';
        this.cdr.detectChanges();
      }
    });
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.consumableRequestService.getProducts().subscribe({
      next: (data) => {
        this.products = Array.isArray(data) ? data : [];
        this.loadingProducts = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Erreur lors du chargement des produits :', err);
        this.loadingProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRequests(): void {
    this.loading = true;
    this.consumableRequestService.getRequests().subscribe({
      next: (data) => {
        this.requests = Array.isArray(data) ? data : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Erreur lors du chargement des demandes :', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredRequests(): any[] {
    // Afficher d'abord les brouillons, puis les autres par ordre: pending, approved, rejected, ...
    const order = { draft: 0, pending: 1, approved: 2, rejected: 3 } as any;
    return [...this.requests].sort((a, b) => {
      const sa = String(a?.status || '').toLowerCase();
      const sb = String(b?.status || '').toLowerCase();
      const oa = order[sa] !== undefined ? order[sa] : 99;
      const ob = order[sb] !== undefined ? order[sb] : 99;
      if (oa !== ob) return oa - ob;
      // fallback: plus recent en premier si disponible
      const da = new Date(a?.created_at || 0).getTime();
      const db = new Date(b?.created_at || 0).getTime();
      return db - da;
    });
  }

  get filteredProducts(): any[] {
    const term = this.productSearchTerm.trim().toLowerCase();
    if (!term) return this.products;
    return this.products.filter((p) =>
      String(p.title || '').toLowerCase().includes(term) ||
      String(p.reference || '').toLowerCase().includes(term)
    );
  }

  toggleDetails(id: number): void {
    if (this.expandedRequestIds.has(id)) {
      this.expandedRequestIds.delete(id);
    } else {
      this.expandedRequestIds.add(id);
    }
  }

  selectedRequestDetails: any = null;

  openDetailsModal(request: any): void {
    this.selectedRequestDetails = request;
  }

  closeDetailsModal(): void {
    this.selectedRequestDetails = null;
  }

  canEditFromDetails(request: any): boolean {
    const status = String(request?.status || '').toLowerCase();
    const isOwnerAllowed = this.canEditDeleteOwnRequests;
    // Allow editing drafts and pending requests by the owner
    return (status === 'pending' || status === 'draft') && isOwnerAllowed;
  }

  editItemFromDetails(item: any): void {
    this.closeDetailsModal();
    this.openEditRequestModal(item);
  }

  deleteItemFromDetails(item: any): void {
    this.closeDetailsModal();
    this.deleteRequest(item.id);
  }

  approveFromDetails(item: any): void {
    this.closeDetailsModal();
    this.openApproveModal(item);
  }

  stockStatusLabel(request: any): string {
    const available = Number(request?.available_stock ?? -1);
    const threshold = Number(request?.product_threshold ?? 0);
    if (!Number.isFinite(available) || available < 0) {
      return 'Stock inconnu';
    }
    if (threshold > 0 && available < threshold) {
      return 'Sous seuil';
    }
    if (available < Number(request?.requested_quantity ?? 0)) {
      return 'Insuffisant';
    }
    return 'Suffisant';
  }

  stockStatusClass(request: any): string {
    const label = this.stockStatusLabel(request);
    if (label === 'Suffisant') return 'tag-success';
    if (label === 'Stock inconnu') return 'tag-neutral';
    return 'tag-warning';
  }

  submitRequest(): void {
    let request$: any;

    if (this.requestModalEditMode) {
      if (!this.form.valid || !this.editingRequestId) {
        return;
      }

      const selectedProduct = this.products.find((p) => p.id === this.form.value.product_id);
      const itemName = (selectedProduct?.title || this.form.value.item_name || '').trim();
      if (!itemName) {
        this.message = 'Veuillez selectionner un produit ou saisir un article.';
        return;
      }

      const payload = {
        product_id: this.form.value.product_id || null,
        item_name: itemName,
        requested_quantity: this.form.value.requested_quantity,
      };

      request$ = this.consumableRequestService.updateRequest(this.editingRequestId, payload);
    } else {
      const validLines = this.requestLines.filter(
        (line) => Number(line.product_id) > 0 && Number(line.requested_quantity) >= 1
      );

      if (validLines.length === 0) {
        this.message = 'Ajoutez au moins un produit avec une quantite valide.';
        return;
      }

      const payload = {
        items: validLines.map((line) => ({
          product_id: Number(line.product_id),
          requested_quantity: Number(line.requested_quantity),
        })),
        // create as draft so user can verify/modify before validating
        status: 'draft',
      };
      if (this.currentBatchCode) {
        (payload as any).batch_code = this.currentBatchCode;
      }

      request$ = this.consumableRequestService.createRequest(payload);
    }

    this.loading = true;

    request$.subscribe({
      next: () => {
        this.message = this.requestModalEditMode
          ? 'Demande modifiee avec succes.'
          : 'Demande creee avec succes.';
        this.closeRequestModal();
        this.currentBatchCode = null;
        this.loadRequests();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = this.requestModalEditMode
          ? 'Erreur lors de la modification de la demande.'
          : 'Erreur lors de la creation de la demande.';
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openCreateRequestModal(): void {
    this.openCreateRequestModalWithBatch(null);
  }

  openCreateRequestModalWithBatch(batchCode: string | null): void {
    if (!this.canCreateRequest) {
      return;
    }

    this.currentBatchCode = batchCode;
    this.requestModalOpen = true;
    this.requestModalEditMode = false;
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  openEditRequestModal(request: any): void {
    // Allow editing for owner's drafts and pending requests
    if (!this.canEditDeleteOwnRequests) {
      return;
    }
    const status = String(request?.status || '').toLowerCase();
    if (status !== 'pending' && status !== 'draft') {
      return;
    }

    this.requestModalOpen = true;
    this.requestModalEditMode = true;
    this.editingRequestId = Number(request.id);
    this.form.patchValue({
      product_id: request?.product_id ?? null,
      item_name: request?.item_name ?? '',
      requested_quantity: request?.requested_quantity ?? '',
    });
  }

  validateDraft(id: number): void {
    if (!this.canEditDeleteOwnRequests) return;
    this.loading = true;
    this.consumableRequestService.updateRequest(id, { status: 'pending' }).subscribe({
      next: () => {
        this.message = 'Demande validee et mise en attente.';
        this.loadRequests();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors de la validation de la demande.';
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeRequestModal(): void {
    this.requestModalOpen = false;
    this.requestModalEditMode = false;
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  addRequestLine(): void {
    this.requestLines.push({ product_id: null, requested_quantity: null });
  }

  removeRequestLine(index: number): void {
    if (this.requestLines.length <= 1) {
      return;
    }
    this.requestLines.splice(index, 1);
  }

  deleteRequest(id: number): void {
    if (!this.canEditDeleteOwnRequests || this.deletingRequestId) {
      return;
    }

    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Supprimer cette demande ?')
      : false;

    if (!confirmed) {
      return;
    }

    this.deletingRequestId = id;
    this.consumableRequestService.deleteRequest(id).subscribe({
      next: () => {
        this.message = 'Demande supprimee.';
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

  openApproveModal(request: any): void {
    if (!this.canApprove) {
      return;
    }

    this.selectedRequestForApproval = request;
    const suggested = Number(request?.suggested_approved_quantity);
    this.modalApprovedQuantity = Number.isFinite(suggested)
      ? suggested
      : Number(request?.requested_quantity || 0);
  }

  closeApproveModal(): void {
    this.selectedRequestForApproval = null;
    this.modalApprovedQuantity = 0;
    this.approving = false;
  }

  useSuggestedQuantity(): void {
    if (!this.selectedRequestForApproval) {
      return;
    }

    const suggested = Number(this.selectedRequestForApproval?.suggested_approved_quantity);
    this.modalApprovedQuantity = Number.isFinite(suggested)
      ? suggested
      : Number(this.selectedRequestForApproval?.requested_quantity || 0);
  }

  confirmApprove(): void {
    if (!this.canApprove || !this.selectedRequestForApproval || this.approving) {
      return;
    }

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

    this.consumableRequestService.approveRequest(request.id, approvedQuantity).subscribe({
      next: () => {
        this.message = 'Demande approuvee.';
        this.closeApproveModal();
        this.loadRequests();
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors de approbation.';
        console.error(err);
        this.approving = false;
        this.cdr.detectChanges();
      }
    });
  }

  rejectRequest(id: number): void {
    if (!this.canApprove) {
      return;
    }

    const reason = prompt('Saisissez le motif du refus (optionnel mais recommande) :');
    if (reason === null) {
      return; // cancelled
    }

    this.consumableRequestService.rejectRequest(id, reason).subscribe({
      next: () => {
        this.message = 'Demande rejetee.';
        this.loadRequests();
        this.cdr.detectChanges();
        setTimeout(() => (this.message = ''), 3000);
      },
      error: (err: unknown) => {
        this.message = 'Erreur lors du rejet.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'draft':
        return '#3b82f6';
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'gray';
    }
  }

  private resolveAccessRights(user: any): void {
    const isDirector = this.isDirectorUser(user);
    this.isResponsable = this.authService.userHasAnyRole(user, ['Responsable de stock', 'Responsable', 'Agent de stock', 'Agent', 'Administrateur']);
    this.canApprove = this.viewMode === 'validation' && isDirector;
    this.canCreateRequest = this.viewMode === 'request';
    this.canEditDeleteOwnRequests = this.viewMode === 'request';
  }

  private isDirectorUser(user: any): boolean {
    const byRoleRelation = this.authService.userHasAnyRole(user, [
      'Directeur',
      'directeur',
      'durecteur',
      'director'
    ]);

    const poste = String(user?.poste || '').trim().toLowerCase();
    const legacyRole = String(user?.role || '').trim().toLowerCase();
    const aliases = ['directeur', 'durecteur', 'director'];

    return byRoleRelation || aliases.includes(poste) || aliases.includes(legacyRole);
  }

  openExitModal(request: any): void {
    const item = (request.items && request.items.length === 1) ? request.items[0] : request;
    this.selectedRequestForExit = item;
    this.exitSourceLocationId = null; // This will hold the stock record ID or we can use it for location_id
    this.selectedDepot = null;
    this.selectedSalle = null;
    this.selectedEmplacement = null;
    this.exitMotif = 'Sortie confirmée suite validation Direction';
    this.exitRequesterName = request.requester_name || (request.user?.nomprenom || request.user?.name || '');
    this.exitLocalText = '';
    this.exitSourceStocks = [];
    this.depotsList = [];
    this.sallesList = [];
    this.locationsList = [];
    this.cabinetsList = [];
    if (item.product_id) {
      this.consumableRequestService.getProductStocks(item.product_id).subscribe({
        next: (res: any) => {
          this.exitSourceStocks = (res || []).filter((s: any) => s.quantity > 0);
          // Debug: log the stocks payload to help diagnose missing depot data
          // (remove or guard in production).
          // eslint-disable-next-line no-console
          console.debug('getProductStocks -> exitSourceStocks', this.exitSourceStocks);
          // Do not auto-select the location even if there's only one option.
          // The responsable must explicitly choose depot -> salle -> emplacement/armoire.
          this.cdr.detectChanges();
        },
        error: () => { this.message = 'Erreur lors du chargement des stocks par emplacement.'; }
      });
    }

    // Load real lists from DB
    this.loadDepots();
  }

  closeExitModal(): void {
    this.selectedRequestForExit = null;
    this.exitSourceStocks = [];
  }

  confirmExitAction(): void {
    if (!this.selectedRequestForExit || !this.selectedDepot || !this.selectedSalle || !this.selectedEmplacement) {
      this.message = "Erreur : Sélectionnez le dépôt, la salle et l'emplacement/armoire."; return;
    }
    this.confirmingExit = true;
    
    // Determine if it's a location or cabinet
    const selectedStock = this.exitSourceStocks.find(s => s.warehouse_location_id === this.exitSourceLocationId || s.cabinet_id === this.exitSourceLocationId);
    
    const payload: any = {
      motif: this.exitMotif,
      destination_text: this.exitRequesterName + (this.exitLocalText ? ' - ' + this.exitLocalText : '')
    };

    if (selectedStock?.warehouse_location_id) {
      payload.source_warehouse_location_id = selectedStock.warehouse_location_id;
    } else if (selectedStock?.cabinet_id) {
      payload.source_cabinet_id = selectedStock.cabinet_id;
    }

    this.consumableRequestService.confirmExit(this.selectedRequestForExit.id, payload).subscribe({
      next: () => {
        this.message = 'Sortie confirmée avec succès !';
        this.confirmingExit = false;
        this.closeExitModal();
        this.loadRequests();
      },
      error: (err) => {
        this.message = 'Erreur lors de la confirmation : ' + (err.error?.message || 'Inconnue');
        this.confirmingExit = false;
        this.cdr.detectChanges();
      }
    });
  }

  getLocationName(s: any): string {
    const room = s.warehouseLocation?.room || s.warehouseCabinet?.room || {};
    const wh = room.warehouse || {};
    const whName = wh.name || 'Dépôt';
    const roomName = room.name || 'Salle';
    
    if (s.cabinet_id) {
      return `Armoire: ${s.warehouseCabinet?.code || s.cabinet_id} (Dispo: ${s.quantity})`;
    }
    return `${s.warehouseLocation?.name || s.warehouseLocation?.code || 'Emplacement'} (Dispo: ${s.quantity})`;
  }

  get availableDepots() {
    const depotsMap = new Map<number, any>();
    for (const s of this.exitSourceStocks) {
      // Support multiple possible response shapes from the API
      let wh: any = null;

      const room = s.warehouseLocation?.room || s.warehouseCabinet?.room || null;
      if (room && room.warehouse) wh = room.warehouse;

      // fallback: direct warehouse object on stock
      if (!wh && s.warehouse) wh = s.warehouse;

      // fallback: id + optional name
      if (!wh && (s.warehouse_id || s.warehouseId)) {
        wh = { id: s.warehouse_id || s.warehouseId, name: s.warehouse_name || s.warehouseName || `Dépôt ${s.warehouse_id || s.warehouseId}` };
      }

      if (!wh && s.warehouseLocation?.warehouse) wh = s.warehouseLocation.warehouse;

      if (wh && wh.id && !depotsMap.has(Number(wh.id))) {
        depotsMap.set(Number(wh.id), wh);
      }
    }
    return Array.from(depotsMap.values());
  }

  get availableSalles() {
    if (!this.selectedDepot) return [];
    const sallesMap = new Map();
    for (const s of this.exitSourceStocks) {
      const room = s.warehouseLocation?.room || s.warehouseCabinet?.room || {};
      const wh = room.warehouse;
      if (wh && wh.id === this.selectedDepot.id && room.id && !sallesMap.has(room.id)) {
        sallesMap.set(room.id, room);
      }
    }
    return Array.from(sallesMap.values());
  }

  get availableEmplacements() {
    if (!this.selectedSalle) return [];
    return this.exitSourceStocks.filter(s => {
      const room = s.warehouseLocation?.room || s.warehouseCabinet?.room || {};
      return room.id === this.selectedSalle.id;
    });
  }

  onDepotChange() {
    this.selectedSalle = null;
    this.selectedEmplacement = null;
    this.exitSourceLocationId = null;
    this.sallesList = [];
    this.locationsList = [];
    this.cabinetsList = [];
    if (this.selectedDepot && this.selectedDepot.id) {
      this.adminWarehouseService.listRooms(this.selectedDepot.id).subscribe({
        next: (res: any) => {
          this.sallesList = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          this.cdr.detectChanges();
        },
        error: () => { this.sallesList = []; }
      });
    }
  }

  onSalleChange() {
    this.selectedEmplacement = null;
    this.exitSourceLocationId = null;
    this.locationsList = [];
    this.cabinetsList = [];
    if (this.selectedSalle && this.selectedSalle.id) {
      this.adminWarehouseService.listLocations(this.selectedSalle.id).subscribe({
        next: (res: any) => {
          this.locationsList = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          this.cdr.detectChanges();
        },
        error: () => { this.locationsList = []; }
      });
      this.adminWarehouseService.listCabinets(this.selectedSalle.id).subscribe({
        next: (res: any) => {
          this.cabinetsList = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          this.cdr.detectChanges();
        },
        error: () => { this.cabinetsList = []; }
      });
    }
  }

  onEmplacementChange() {
    if (!this.selectedEmplacement) { this.exitSourceLocationId = null; return; }
    // selectedEmplacement may be a location or a cabinet
    this.exitSourceLocationId = this.selectedEmplacement.warehouse_location_id || this.selectedEmplacement.cabinet_id || this.selectedEmplacement.id || null;
  }

  loadDepots() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.adminWarehouseService.listWarehouses().subscribe({
      next: (res: any) => {
        // Debug response shape
        // eslint-disable-next-line no-console
        console.debug('listWarehouses response', res);
        const data = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        this.depotsList = data;
        this.cdr.detectChanges();
      },
      error: (err: any) => { this.depotsList = []; /* eslint-disable-next-line no-console */ console.error('Error loading depots', err); }
    });
  }
}
