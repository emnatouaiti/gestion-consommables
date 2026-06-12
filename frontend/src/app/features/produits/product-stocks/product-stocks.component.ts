import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProductStockService } from '../../../core/services/product-stock.service';
import { AdminStockService } from '../../../core/services/admin-stock.service';
import { AdminWarehouseService } from '../../../core/services/admin-warehouse.service';
import { AdminExpirationService } from '../../../core/services/admin-expiration.service';

@Component({
  selector: 'app-product-stocks',
  standalone: false,
  templateUrl: './product-stocks.component.html',
  styleUrls: ['./product-stocks.component.css']
})
export class ProductStocksComponent implements OnInit {

  // ── Données produit ────────────────────────────────────
  productId: number | null = null;
  product: any = null;
  stocks: any[] = [];
  locations: any[] = [];
  allWarehouses: any[] = [];
  allRooms: any[] = [];
  allCabinets: any[] = [];

  // ── État UI ────────────────────────────────────────────
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  activeSection: 'details' | 'stock' | 'documents' | 'images' | 'expiration' | 'history' = 'stock';

  // ── Modal stock ────────────────────────────────────────
  showAddStockModal = false;
  editingStockId: number | null = null;
  stockForm!: FormGroup;
  storageTargetForForm: 'location' | 'cabinet' = 'location';
  selectedWarehouseIdForForm: string = '';
  selectedRoomIdForForm: string = '';

  // Modale Retour Fournisseur
  showReturnModal = false;
  returnJustification = '';
  returnTargetBatch: any = null;

  // Modale Élimination lot
  showEliminateModal = false;
  eliminateJustification = '';
  eliminateTargetBatch: any = null;

  // Modale Forcer Consommation
  showForceConsumeModal = false;
  forceConsumeJustification = '';
  forceConsumeTargetBatch: any = null;

  show3DViewerModal = false;
  viewerData = { id: null as number | null, title: '', capacity: 0, current: 0, type: 'location' as 'location' | 'cabinet' };

  // ── Stocks / entrepôts ─────────────────────────────────
  productSuppliers: any[] = [];
  totalStock: any = { product_name: '', total_quantity: 0, is_in_stock: false, details: [] };
  warehousesAvailability: any[] = [];
  selectedWarehouseId: number | null = null;

  // ── Historique ─────────────────────────────────────────
  productHistory: any[] = [];
  historyLoading = false;
  historyPagination = { page: 1, perPage: 10, total: 0, lastPage: 1 };
  historyFilters = {
    date_start: '',
    date_end: ''
  };

  // ── Photos / Documents ─────────────────────────────────
  selectedPhotoIndex = 0;
  photoUploadInProgress = false;
  productDocuments: any[] = [];
  docTypeFilter = 'all';
  docStatusFilter = 'all';
  docUploadInProgress = false;
  availableDocTypes: string[] = [];
  availableDocStatuses: string[] = [];
  docPagination = { page: 1, perPage: 5 };

  // ── Expiration & Lots ──────────────────────────────────
  productHasExpiration = false;
  batchLifecycles: any[] = [];
  expiringAlerts: any[] = [];
  expirationEvents: any[] = [];
  eventPagination = { page: 1, perPage: 5 };

  // Filtres lots
  lotFilter: 'all' | 'expired' | 'expiring' | 'safe' = 'all';
  lotSearchQuery = '';
  lotsCollapsed = true;
  expandedLotId: number | null = null;
  lotPagination = { page: 1, perPage: 5 };

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private stockService: ProductStockService,
    private adminStockService: AdminStockService,
    private warehouseService: AdminWarehouseService,
    private http: HttpClient,
    private expirationService: AdminExpirationService,
    private fb: FormBuilder
  ) {
    this.initStockForm();
  }

  private initStockForm(): void {
    this.stockForm = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1)]],
      warehouse_location_id: [''],
      cabinet_id: [''],
      notes: [''],
      supplier_id: ['']
    });
  }

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

  // ──────────────────────────────────────────────────────
  // NAVIGATION
  // ──────────────────────────────────────────────────────
  setSection(section: 'details' | 'stock' | 'documents' | 'images' | 'expiration' | 'history'): void {
    this.activeSection = section as any;
    if (section === 'history') this.loadHistory();
    if (section === 'expiration') this.loadExpirationData();
    this.cdr.detectChanges();
  }

  // ──────────────────────────────────────────────────────
  // CHARGEMENT DONNÉES
  // ──────────────────────────────────────────────────────
  loadProductDetails(): void {
    if (!this.productId) return;
    this.adminStockService.getProduct(this.productId).subscribe({
      next: (res: any) => {
        this.product = res.data || res;
        this.productHasExpiration = this.product?.has_expiration || false;
        this.productSuppliers = this.product.suppliers || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger le produit.';
        this.cdr.detectChanges();
      }
    });
  }

  loadStocks(): void {
    if (!this.productId) return;
    setTimeout(() => {
      this.isLoading = true;
      this.cdr.detectChanges();
    });
    this.stockService.getTotalStock(this.productId).subscribe({
      next: (res: any) => {
        this.totalStock = res;
        this.stocks = res.details || [];
        this.warehousesAvailability = res.warehouses_availability || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les stocks.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadHistory(page = 1): void {
    if (!this.productId) return;
    this.historyPagination.page = page;
    setTimeout(() => {
      this.historyLoading = true;
      this.cdr.detectChanges();
    });
    this.adminStockService.getProductHistory(this.productId, {
      page: this.historyPagination.page,
      per_page: this.historyPagination.perPage,
      date_start: this.historyFilters.date_start,
      date_end: this.historyFilters.date_end
    }).subscribe({
      next: (res: any) => {
        this.productHistory = res.data || [];
        this.historyPagination.total = res.total || 0;
        this.historyPagination.lastPage = res.last_page || 1;
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.historyLoading = false; this.cdr.detectChanges(); }
    });
  }

  onHistoryPerPageChange(): void {
    // S'assurer que c'est un nombre
    this.historyPagination.perPage = Number(this.historyPagination.perPage);
    this.loadHistory(1);
  }

  onEventPerPageChange(): void {
    this.eventPagination.perPage = Number(this.eventPagination.perPage);
    this.eventPagination.page = 1;
  }

  loadWarehouses(): void {
    this.warehouseService.listWarehouses(null, 100).subscribe({
      next: (res: any) => { this.allWarehouses = res.data || res; this.cdr.detectChanges(); },
      error: (err: any) => console.error('Erreur dépôts:', err)
    });
  }

  loadRooms(): void {
    this.warehouseService.listRooms(null, null, 500).subscribe({
      next: (res: any) => { this.allRooms = res.data || res; this.cdr.detectChanges(); },
      error: (err: any) => console.error('Erreur salles:', err)
    });
  }

  loadLocations(): void {
    this.warehouseService.listLocations(null, null, 1000).subscribe({
      next: (res: any) => { this.locations = res.data || (Array.isArray(res) ? res : []); this.cdr.detectChanges(); },
      error: (err: any) => console.error('Erreur emplacements:', err)
    });
  }

  loadCabinets(): void {
    this.warehouseService.listCabinets(null, null, 1000).subscribe({
      next: (res: any) => { this.allCabinets = res.data || (Array.isArray(res) ? res : []); this.cdr.detectChanges(); },
      error: (err: any) => console.error('Erreur armoires:', err)
    });
  }

  loadDocuments(): void {
    if (!isPlatformBrowser(this.platformId) || !this.productId) return;
    this.http.get('/api/documents').subscribe({
      next: (docs: any) => {
        const arr = Array.isArray(docs) ? docs : [];
        this.productDocuments = arr.filter((d: any) => {
          const title = (this.product?.title || '').toString().trim();
          const reference = (this.product?.reference || '').toString().trim();
          if (!title && !reference) return d.product_id == this.productId;
          const matches = (source: string, target: string) => {
            if (!target || !source) return false;
            const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`\\b${escaped}\\b`, 'i').test(source);
          };
          if (this.productId && d.product_id == this.productId) return true;
          const docTitle = d.title || '';
          if (matches(docTitle, title) || matches(docTitle, reference)) return true;
          const ocrText = d.ocr_text || '';
          if (matches(ocrText, title) || matches(ocrText, reference)) return true;
          const lines = Array.isArray(d.ocr_lines) ? d.ocr_lines : [];
          return lines.some((l: any) => matches(l.title, title) || matches(l.reference, reference));
        });
        this.mergeMovementAndRequestDocuments();
      },
      error: () => {}
    });
  }

  private mergeMovementAndRequestDocuments(): void {
    if (!this.productId) return;

    this.adminStockService.getProductHistory(this.productId, { page: 1, per_page: 300 }).subscribe({
      next: (res: any) => {
        const historyRows = Array.isArray(res?.data) ? res.data : [];
        const extraDocs: any[] = [];

        historyRows.forEach((h: any) => {
          const movement = h?.movement;
          if (!movement) return;

          if (movement.response_pdf_path) {
            extraDocs.push({
              id: `movement-response-${movement.id}`,
              title: `Décision Responsable - ${movement.reference || ('MVT-' + movement.id)}`,
              type: 'bon_mouvement',
              status: movement.status || 'executed',
              direction: movement.movement_type,
              path: movement.response_pdf_path,
              created_at: movement.updated_at || movement.created_at,
            });
          }

          if (movement.related_request?.pdf_path) {
            extraDocs.push({
              id: `request-pdf-${movement.related_request.id}`,
              title: `Demande Livrée - #${movement.related_request.id}`,
              type: 'bon_sortie',
              status: movement.status || movement.related_request.status || 'approved',
              direction: movement.movement_type,
              path: movement.related_request.pdf_path,
              created_at: movement.related_request.updated_at || movement.related_request.created_at || movement.created_at,
            });
          }
        });

        this.productDocuments = [...this.productDocuments, ...extraDocs];
        this.productDocuments = this.productDocuments.map((d: any) => {
          if (d.type === 'demande_livree') return { ...d, type: 'bon_sortie' };
          if (d.type === 'decision_responsable') return { ...d, type: 'bon_mouvement' };
          return d;
        });
        this.productDocuments = this.productDocuments.filter((d: any) =>
          ['bon_livraison', 'bon_sortie', 'bon_mouvement'].includes((d.type || '').toLowerCase())
        );
        this.productDocuments = this.productDocuments.map((d: any) => ({
          ...d,
          status: this.normalizeDocStatus(d.status)
        }));
        this.productDocuments = this.productDocuments.filter((d, i, arr) => {
          const key = `${d.path || ''}|${d.type || ''}|${d.title || ''}`;
          return arr.findIndex(x => `${x.path || ''}|${x.type || ''}|${x.title || ''}` === key) === i;
        });
        this.productDocuments.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const orderedTypes = ['bon_livraison', 'bon_sortie', 'bon_mouvement'];
        this.availableDocTypes = orderedTypes.filter(t => this.productDocuments.some((d: any) => d.type === t));
        this.availableDocStatuses = this.extractAvailableStatuses(this.productDocuments);
        this.cdr.detectChanges();
      },
      error: () => {
        this.productDocuments = this.productDocuments.filter((d: any) =>
          ['bon_livraison', 'bon_sortie', 'bon_mouvement'].includes((d.type || '').toLowerCase())
        );
        this.productDocuments = this.productDocuments.map((d: any) => ({
          ...d,
          status: this.normalizeDocStatus(d.status)
        }));
        this.productDocuments.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const orderedTypes = ['bon_livraison', 'bon_sortie', 'bon_mouvement'];
        this.availableDocTypes = orderedTypes.filter(t => this.productDocuments.some((d: any) => d.type === t));
        this.availableDocStatuses = this.extractAvailableStatuses(this.productDocuments);
        this.cdr.detectChanges();
      }
    });
  }

  // ──────────────────────────────────────────────────────
  // EXPIRATION & LOTS
  // ──────────────────────────────────────────────────────

  /** Appelé publiquement depuis le template (bouton Actualiser) */
  loadExpirationData(): void {
    if (!this.productId) return;

    this.expirationService.getBatchLifecycle(this.productId).subscribe({
      next: (batches: any[]) => {
        // Calcul daysLeft côté client si non fourni par le backend
        this.batchLifecycles = batches.map(b => this.enrichBatch(b));
        this.cdr.detectChanges();
      },
      error: (err: any) => console.warn('Erreur batches:', err)
    });

    this.expirationService.getExpiringSoon(this.productId).subscribe({
      next: (expiring: any[]) => {
        this.expiringAlerts = expiring.map(b => this.enrichBatch(b));
        this.cdr.detectChanges();
      },
      error: (err: any) => console.warn('Erreur expirations:', err)
    });

    this.expirationService.getExpirationEvents(this.productId).subscribe({
      next: (events: any[]) => {
        this.expirationEvents = events;
        this.cdr.detectChanges();
      },
      error: (err: any) => console.warn('Erreur événements:', err)
    });
  }

  /** Enrichit un batch avec daysLeft calculé si absent */
  private enrichBatch(batch: any): any {
    if (batch.daysLeft !== undefined) return batch;
    if (!batch.expiration_date) return { ...batch, daysLeft: null };
    const now = new Date();
    const exp = new Date(batch.expiration_date);
    const diff = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { ...batch, daysLeft: diff };
  }

  getFilteredEvents(): any[] {
    const start = (this.eventPagination.page - 1) * this.eventPagination.perPage;
    return this.expirationEvents.slice(start, start + this.eventPagination.perPage);
  }

  getEventTotalPages(): number {
    return Math.ceil(this.expirationEvents.length / this.eventPagination.perPage);
  }

  // ── Métriques ──────────────────────────────────────────
  getExpiredCount(): number {
    return this.batchLifecycles.filter(b => b.daysLeft !== null && b.daysLeft <= 0).length;
  }

  getExpiringCount(): number {
    return this.batchLifecycles.filter(b => b.daysLeft !== null && b.daysLeft > 0 && b.daysLeft <= 7).length;
  }

  getSafeCount(): number {
    return this.batchLifecycles.filter(b => b.daysLeft === null || b.daysLeft > 7).length;
  }

  // ── Filtres lots ───────────────────────────────────────
  setLotFilter(filter: 'all' | 'expired' | 'expiring' | 'safe'): void {
    this.lotFilter = filter;
    this.lotsCollapsed = true;
    this.expandedLotId = null;
    this.cdr.detectChanges();
  }

  getFilteredBatches(): any[] {
    let batches = [...this.batchLifecycles];

    // Filtre par statut
    if (this.lotFilter === 'expired')  batches = batches.filter(b => b.daysLeft !== null && b.daysLeft <= 0);
    if (this.lotFilter === 'expiring') batches = batches.filter(b => b.daysLeft !== null && b.daysLeft > 0 && b.daysLeft <= 7);
    if (this.lotFilter === 'safe')     batches = batches.filter(b => b.daysLeft === null || b.daysLeft > 7);

    // Recherche textuelle
    const q = this.lotSearchQuery.trim().toLowerCase();
    if (q) {
      batches = batches.filter(b =>
        (b.product_name || '').toLowerCase().includes(q) ||
        (b.batch_number || '').toLowerCase().includes(q) ||
        (b.supplier_name || '').toLowerCase().includes(q) ||
        (b.warehouse_name || '').toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q)
      );
    }

    // Trier: expirés d'abord, puis bientôt, puis sains ; dans chaque groupe par daysLeft asc
    batches = batches.sort((a, b) => {
      const rankA = a.daysLeft <= 0 ? 0 : (a.daysLeft <= 7 ? 1 : 2);
      const rankB = b.daysLeft <= 0 ? 0 : (b.daysLeft <= 7 ? 1 : 2);
      if (rankA !== rankB) return rankA - rankB;
      return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
    });

    const start = (this.lotPagination.page - 1) * this.lotPagination.perPage;
    return batches.slice(start, start + this.lotPagination.perPage);
  }

  getTotalFilteredBatches(): number {
    let batches = [...this.batchLifecycles];
    if (this.lotFilter === 'expired')  batches = batches.filter(b => b.daysLeft !== null && b.daysLeft <= 0);
    if (this.lotFilter === 'expiring') batches = batches.filter(b => b.daysLeft !== null && b.daysLeft > 0 && b.daysLeft <= 7);
    if (this.lotFilter === 'safe')     batches = batches.filter(b => b.daysLeft === null || b.daysLeft > 7);

    const q = this.lotSearchQuery.trim().toLowerCase();
    if (q) {
      batches = batches.filter(b =>
        (b.product_name || '').toLowerCase().includes(q) ||
        (b.batch_number || '').toLowerCase().includes(q) ||
        (b.supplier_name || '').toLowerCase().includes(q) ||
        (b.warehouse_name || '').toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q)
      );
    }
    return batches.length;
  }

  getLotTotalPages(): number {
    return Math.ceil(this.getTotalFilteredBatches() / this.lotPagination.perPage) || 1;
  }

  toggleLot(batch: any): void {
    this.expandedLotId = this.expandedLotId === batch.id ? null : batch.id;
    this.cdr.detectChanges();
  }

  // ── Helpers visuel ─────────────────────────────────────
  getBatchStatusClass(batch: any): string {
    if (batch.daysLeft === null || batch.daysLeft === undefined) return 'safe';
    if (batch.daysLeft <= 0) return 'expired';
    if (batch.daysLeft <= 7) return 'expiring';
    return 'safe';
  }

  getBatchStatusLabel(batch: any): string {
    const cls = this.getBatchStatusClass(batch);
    if (cls === 'expired')  return 'Expiré';
    if (cls === 'expiring') return 'Expire bientôt';
    return 'En cours';
  }

  /**
   * Retourne la largeur de la barre de progression.
   * Pour les lots expirés → 100%.
   * Pour les lots en cours → pourcentage consommé sur la durée totale (entre création et expiration).
   */
  getBatchProgressWidth(batch: any): string {
    if (!batch.expiration_date) return '15%';
    if (batch.daysLeft <= 0) return '100%';

    if (batch.created_at) {
      const created = new Date(batch.created_at).getTime();
      const exp = new Date(batch.expiration_date).getTime();
      const now = Date.now();
      const totalDuration = exp - created;
      if (totalDuration <= 0) return '100%';
      const elapsed = now - created;
      const pct = Math.max(5, Math.min(95, Math.round((elapsed / totalDuration) * 100)));
      return pct + '%';
    }

    // Fallback : basé sur les jours restants (max 365)
    const maxDays = 365;
    const consumed = Math.max(5, Math.min(95, Math.round(((maxDays - batch.daysLeft) / maxDays) * 100)));
    return consumed + '%';
  }

  // ── Actions sur lots ───────────────────────────────────
  openEliminateModal(batch: any): void {
    this.eliminateTargetBatch = batch;
    this.eliminateJustification = '';
    this.showEliminateModal = true;
  }

  closeEliminateModal(): void {
    this.showEliminateModal = false;
    this.eliminateTargetBatch = null;
    this.eliminateJustification = '';
  }

  confirmEliminateBatch(): void {
    if (!this.eliminateTargetBatch || !this.eliminateJustification || this.eliminateJustification.trim().length < 5) return;
    this.expirationService.eliminateBatch(this.eliminateTargetBatch.id, this.eliminateJustification.trim()).subscribe({
      next: () => {
        this.showSuccess('Lot marqué pour élimination.');
        this.closeEliminateModal();
        this.loadExpirationData();
        this.loadStocks(); // Mettre à jour le stock total et les emplacements
      },
      error: (err: any) => this.errorMessage = this.extractApiError(err, 'Erreur lors de l\'élimination')
    });
  }

  openReturnModal(batch: any): void {
    this.returnTargetBatch = batch;
    this.returnJustification = '';
    this.showReturnModal = true;
  }

  closeReturnModal(): void {
    this.showReturnModal = false;
    this.returnTargetBatch = null;
    this.returnJustification = '';
  }

  confirmReturnToSupplier(): void {
    if (!this.returnTargetBatch || !this.returnJustification || this.returnJustification.trim().length < 5) return;
    this.expirationService.returnToSupplierBatch(this.returnTargetBatch.id, this.returnJustification.trim()).subscribe({
      next: () => {
        this.showSuccess('Lot retourné au fournisseur avec succès.');
        this.closeReturnModal();
        this.loadExpirationData();
        this.loadStocks(); // Mettre à jour le stock total et les emplacements
      },
      error: (err: any) => this.errorMessage = this.extractApiError(err, 'Erreur lors du retour')
    });
  }

  openForceConsumeModal(batch: any): void {
    this.forceConsumeTargetBatch = batch;
    this.forceConsumeJustification = '';
    this.showForceConsumeModal = true;
  }

  closeForceConsumeModal(): void {
    this.showForceConsumeModal = false;
    this.forceConsumeTargetBatch = null;
    this.forceConsumeJustification = '';
  }

  confirmForceConsume(): void {
    if (!this.forceConsumeTargetBatch || !this.forceConsumeJustification || this.forceConsumeJustification.trim().length < 5) return;
    // Le backend attend quantity + justification
    this.http.post(`/api/expirations/${this.forceConsumeTargetBatch.id}/force-consume`, {
      quantity: this.forceConsumeTargetBatch.quantity,
      justification: this.forceConsumeJustification.trim()
    }).subscribe({
      next: () => {
        this.showSuccess('Consommation forcée enregistrée.');
        this.closeForceConsumeModal();
        this.loadExpirationData();
      },
      error: (err: any) => {
        this.errorMessage = this.extractApiError(err?.error || err, 'Erreur lors de la consommation forcée');
        this.cdr.detectChanges();
      }
    });
  }

  prioritizeBatch(batch: any): void {
    // TODO: appeler expirationService.prioritize(batch.id)
    this.showSuccess(`Lot ${batch.batch_number || batch.id} mis en priorité de sortie.`);
  }

  viewBatchHistory(batch: any): void {
    // TODO: ouvrir modal ou naviguer vers historique du lot
    console.log('View history for batch:', batch.id);
  }

  editBatch(batch: any): void {
    // TODO: ouvrir modal d'édition du lot
    console.log('Edit batch:', batch.id);
  }

  // ──────────────────────────────────────────────────────
  // STOCK CRUD
  // ──────────────────────────────────────────────────────
  openAddStockModal(warehouseId?: number): void {
    this.resetForm();
    this.editingStockId = null;
    if (warehouseId) this.selectedWarehouseIdForForm = warehouseId.toString();
    this.showAddStockModal = true;
  }

  closeAddStockModal(): void {
    this.showAddStockModal = false;
    this.resetForm();
  }

   resetForm(): void {
    this.stockForm.reset({
      quantity: 1,
      warehouse_location_id: '',
      cabinet_id: '',
      notes: '',
      supplier_id: ''
    });
    this.selectedWarehouseIdForForm = '';
    this.selectedRoomIdForForm = '';
    this.storageTargetForForm = 'location';
  }

  saveStock(): void {
    if (this.stockForm.invalid) {
      this.stockForm.markAllAsTouched();
      this.errorMessage = 'Veuillez remplir correctement les champs obligatoires.';
      return;
    }

    const val = this.stockForm.value;
    const hasStorage = this.storageTargetForForm === 'cabinet' ? !!val.cabinet_id : !!val.warehouse_location_id;

    if (!hasStorage) {
      this.errorMessage = 'Veuillez sélectionner un emplacement ou une armoire.';
      return;
    }

    if (!this.productId) { this.errorMessage = 'Produit non chargé.'; return; }

    const payload = {
      warehouse_location_id: (this.storageTargetForForm === 'location' && val.warehouse_location_id) ? parseInt(val.warehouse_location_id) : null,
      cabinet_id: (this.storageTargetForForm === 'cabinet' && val.cabinet_id) ? parseInt(val.cabinet_id) : null,
      quantity: parseInt(val.quantity),
      notes: val.notes,
      supplier_id: val.supplier_id ? parseInt(val.supplier_id) : null
    };

    this.errorMessage = '';
    const req$ = this.editingStockId
      ? this.stockService.updateStock(this.editingStockId, payload)
      : this.stockService.addStock(this.productId, payload);

    req$.subscribe({
      next: () => {
        this.showSuccess(this.editingStockId ? 'Stock mis à jour !' : 'Stock ajouté !');
        this.closeAddStockModal();
        this.loadStocks();
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
    this.stockForm.patchValue({
      warehouse_location_id: this.storageTargetForForm === 'location'
        ? (this.locations.find(l => l.code === stock.location_code)?.id.toString() || '') : '',
      cabinet_id: this.storageTargetForForm === 'cabinet'
        ? (this.allCabinets.find((c: any) => c.code === stock.location_code)?.id.toString() || '') : '',
      quantity: stock.quantity.toString(),
      notes: stock.notes || '',
      supplier_id: stock.supplier_id?.toString() || ''
    });
    this.showAddStockModal = true;
  }

  deleteStock(stockId: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce stock ?')) return;
    this.stockService.deleteStock(stockId).subscribe({
      next: () => { this.showSuccess('Stock supprimé !'); this.loadStocks(); },
      error: (err: any) => { this.errorMessage = err?.error?.message || 'Impossible de supprimer ce stock.'; this.cdr.detectChanges(); }
    });
  }

  // ──────────────────────────────────────────────────────
  // DÉPÔTS
  // ──────────────────────────────────────────────────────
  toggleDepot(wh: any): void {
    this.selectedWarehouseId = this.selectedWarehouseId === wh.warehouse_id ? null : wh.warehouse_id;
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
      .filter(r => r.warehouse_id.toString() === this.selectedWarehouseIdForForm)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getLocationsForRoom(): any[] {
    if (!this.selectedRoomIdForForm) return [];
    return this.locations
      .filter(loc => loc.room_id.toString() === this.selectedRoomIdForForm)
      .map(loc => ({ ...loc, isFull: loc.capacity_units > 0 && loc.current_units >= loc.capacity_units }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  getCabinetsForRoom(): any[] {
    if (!this.selectedRoomIdForForm) return [];
    return this.allCabinets
      .filter(c => c.room_id.toString() === this.selectedRoomIdForForm)
      .map(c => ({ ...c, isFull: c.capacity_units > 0 && c.current_units >= c.capacity_units }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  onWarehouseFormChange(): void {
    this.selectedRoomIdForForm = '';
    this.stockForm.patchValue({
        warehouse_location_id: '',
        cabinet_id: ''
    });
  }

  onRoomFormChange(): void {
    this.stockForm.patchValue({
        warehouse_location_id: '',
        cabinet_id: ''
    });
  }

  setStorageTarget(target: 'location' | 'cabinet'): void {
    this.storageTargetForForm = target;
    if (target === 'location') this.stockForm.patchValue({ cabinet_id: '' });
    else this.stockForm.patchValue({ warehouse_location_id: '' });
  }

  // ──────────────────────────────────────────────────────
  // ÉTAT STOCK
  // ──────────────────────────────────────────────────────
  getStockStatus(): string {
    return this.totalStock.is_in_stock
      ? `En stock (${this.totalStock.total_quantity} unités)`
      : 'Rupture de stock';
  }

  getStockStatusClass(): string {
    return this.totalStock.is_in_stock ? 'in-stock' : 'out-of-stock';
  }

  // ──────────────────────────────────────────────────────
  // PHOTOS
  // ──────────────────────────────────────────────────────
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
    const path = photos[idx]?.path || photos[idx]?.image_path || photos[idx]?.url || '';
    if (!path) return 'assets/images/placeholder-product.png';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `/api/docs/${path.replace(/^storage\//, '').replace(/^[/\\]+/, '')}`;
  }

  getPhotoUrl(path: string | null | undefined): string {
    if (!path) return 'assets/images/placeholder-product.png';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `/api/docs/${path.replace(/^storage\//, '').replace(/^[/\\]+/, '')}`;
  }

  selectPhoto(index: number): void {
    this.selectedPhotoIndex = index;
    this.cdr.detectChanges();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length || !this.productId) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) { this.errorMessage = 'Veuillez choisir une image.'; return; }
    if (file.size > 2 * 1024 * 1024) { this.errorMessage = 'Image trop lourde (max 2 Mo).'; return; }
    this.photoUploadInProgress = true;
    this.errorMessage = '';
    const payload = this.buildUpdatePayload();
    (payload as any).photos = [file];
    this.adminStockService.updateProduct(this.productId, payload).subscribe({
      next: () => {
        this.showSuccess('Photo mise à jour.');
        this.photoUploadInProgress = false;
        this.loadProductDetails();
        this.setSection('images');
      },
      error: (err: any) => {
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
        this.showSuccess("Image par défaut mise à jour.");
        this.photoUploadInProgress = false;
        this.loadProductDetails();
      },
      error: (err: any) => {
        this.errorMessage = this.extractApiError(err, "Impossible de définir l'image par défaut.");
        this.photoUploadInProgress = false;
      }
    });
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/placeholder-product.png';
  }

  // ──────────────────────────────────────────────────────
  // DOCUMENTS
  // ──────────────────────────────────────────────────────
  onDocSelected(event: any): void {
    const file = event.target.files[0];
    if (file) this.handleDocUpload(file);
  }

  handleDocUpload(file: File): void {
    this.docUploadInProgress = true;
    this.errorMessage = '';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('product_id', (this.productId || '').toString());
    formData.append('type', 'bon_livraison');
    formData.append('direction', 'in');
    this.http.post('/api/documents', formData).subscribe({
      next: () => {
        this.showSuccess('Document ajouté avec succès !');
        this.docUploadInProgress = false;
        this.loadDocuments();
      },
      error: () => {
        this.errorMessage = "Erreur lors de l'envoi du document.";
        this.docUploadInProgress = false;
        this.cdr.detectChanges();
      }
    });
  }

  getFilteredDocuments(): any[] {
    let docs = this.docTypeFilter === 'all'
      ? [...this.productDocuments]
      : this.productDocuments.filter(d => d.type === this.docTypeFilter);
    if (this.docStatusFilter !== 'all') {
      docs = docs.filter(d => this.normalizeDocStatus(d.status) === this.docStatusFilter);
    }
    docs = docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Pagination
    const start = (this.docPagination.page - 1) * this.docPagination.perPage;
    return docs.slice(start, start + this.docPagination.perPage);
  }

  getTotalFilteredDocuments(): number {
    let docs = this.docTypeFilter === 'all' ? [...this.productDocuments] : this.productDocuments.filter(d => d.type === this.docTypeFilter);
    if (this.docStatusFilter !== 'all') {
      docs = docs.filter(d => this.normalizeDocStatus(d.status) === this.docStatusFilter);
    }
    return docs.length;
  }

  private extractAvailableStatuses(docs: any[]): string[] {
    const preferredOrder = ['pending', 'pending_validation', 'approved', 'executed', 'applied', 'rejected', 'cancelled'];
    const found = new Set<string>();
    docs.forEach((d: any) => {
      const st = this.normalizeDocStatus(d?.status);
      if (st && st !== 'all') found.add(st);
    });
    return preferredOrder.filter(s => found.has(s));
  }

  normalizeDocStatus(status: any): string {
    const s = String(status || '').trim().toLowerCase();
    if (!s) return 'pending';
    if (s === 'validated') return 'approved';
    if (s === 'canceled') return 'cancelled';
    return s;
  }

  getDocStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'En attente',
      pending_validation: 'Attente validation',
      approved: 'Approuvé',
      executed: 'Exécuté',
      applied: 'Appliqué',
      rejected: 'Rejeté',
      cancelled: 'Annulé',
      all: 'Tous'
    };
    return map[status] || status;
  }

  getDocTotalPages(): number {
    return Math.ceil(this.getTotalFilteredDocuments() / this.docPagination.perPage) || 1;
  }

  getDocTypeLabel(type: string): string {
    const map: Record<string, string> = {
      demande: 'Demande',
      bon_sortie: 'Bon de Sortie',
      bon_livraison: 'Bon de Livraison',
      bon_mouvement: 'Bon de Mouvement',
      refus: 'Refus',
      all: 'Tous'
    };
    return map[type] || (type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '));
  }

  downloadDoc(doc: any): void {
    const path = doc?.path;
    if (!path) return;
    // Direct point to backend to avoid proxy issues with large files or specific paths
    const url = `/api/docs/${path.replace(/^[/\\]+/, '').replace(/^storage\//, '')}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc?.title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ──────────────────────────────────────────────────────
  // VIEWER 3D
  // ──────────────────────────────────────────────────────
  open3DViewer(stock: any): void {
    this.viewerData = {
      id: stock.storage_type === 'cabinet' ? stock.cabinet_id : stock.warehouse_location_id,
      title: stock.storage_type === 'cabinet' ? stock.cabinet_display : stock.location_display,
      capacity: stock.capacity_units || 100,
      current: stock.current_units || 0,
      type: stock.storage_type
    };
    this.show3DViewerModal = true;
  }

  close3DViewer(): void { this.show3DViewerModal = false; }

  // ──────────────────────────────────────────────────────
  // HELPERS PRIVÉS
  // ──────────────────────────────────────────────────────
  unitLabel(): string {
    const unit = (this.product as any)?.unit;
    if (!unit) return '—';
    return typeof unit === 'object' ? (unit.name || '—') : (unit || '—');
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
    this.cdr.detectChanges();
  }

  private buildUpdatePayload(): any {
    const p: any = this.product || {};
    return {
      status: p.status || 'active',
      title: p.title || '',
      short_description: p.short_description || '',
      description: p.description || '',
      commentaire: p.commentaire || '',
      num_serie: p.num_serie || '',
      num_inventaire: p.num_inventaire || '',
      model: p.model || '',
      marque: p.marque || '',
      seuil_min: p.seuil_min ?? 0,
      reference: p.reference || '',
      categorie_id: p.categorie_id || p.category?.id,
      stock_quantity: p.stock_quantity ?? 0,
      unit_id: p.unit_id || p.unit?.id || null,
      unit: p.unit?.name || p.unit || '',
      location: p.location || '',
      warehouse_location_id: p.warehouse_location_id || null,
      supplier_ids: Array.isArray(p.suppliers) ? p.suppliers.map((s: any) => s.id) : []
    };
  }

  private extractApiError(err: any, fallback: string): string {
    if (!err) return fallback;
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
    const errors = err.errors;
    if (errors && typeof errors === 'object') {
      const first = Object.keys(errors)[0];
      const val = first ? errors[first] : null;
      if (Array.isArray(val) && val.length) return String(val[0]);
      if (typeof val === 'string') return val;
    }
    return fallback;
  }

  onStockAdded(newStock: any): void {
    this.loadStocks();
    this.loadExpirationData();
    this.showSuccess('Stock ajouté avec succès !');
  }

  getLocationLabel(loc: any): string {
    return `${loc.room?.warehouse?.name || 'Dépôt'}, ${loc.room?.name || 'Salle'}, ${loc.code}`;
  }

  isLocationFull(loc: any): boolean {
    if (!loc.capacity_units) return false;
    return (loc.current_units || 0) >= loc.capacity_units;
  }
}
