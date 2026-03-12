import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConsumableRequestService } from '../services/consumable-request.service';
import { AuthService } from '../core/services/auth.service';

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
  requestModalOpen = false;
  requestModalEditMode = false;
  editingRequestId: number | null = null;
  deletingRequestId: number | null = null;
  requestLines: Array<{ product_id: number | null; requested_quantity: number | null }> = [
    { product_id: null, requested_quantity: null }
  ];

  constructor(
    private consumableRequestService: ConsumableRequestService,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
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
    return this.requests;
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
    const isPending = String(request?.status || '').toLowerCase() === 'pending';
    const isOwnerAllowed = this.canEditDeleteOwnRequests;
    return isPending && isOwnerAllowed;
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
      };

      request$ = this.consumableRequestService.createRequest(payload);
    }

    this.loading = true;

    request$.subscribe({
      next: () => {
        this.message = this.requestModalEditMode
          ? 'Demande modifiee avec succes.'
          : 'Demande creee avec succes.';
        this.closeRequestModal();
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
    if (!this.canCreateRequest) {
      return;
    }

    this.requestModalOpen = true;
    this.requestModalEditMode = false;
    this.editingRequestId = null;
    this.requestLines = [{ product_id: null, requested_quantity: null }];
    this.form.reset({ product_id: null, item_name: '', requested_quantity: '' });
  }

  openEditRequestModal(request: any): void {
    if (!this.canEditDeleteOwnRequests || request?.status !== 'pending') {
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

    this.consumableRequestService.rejectRequest(id).subscribe({
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
    this.canApprove = this.viewMode === 'validation' && isDirector;
    this.canCreateRequest = this.viewMode === 'request';
    this.canEditDeleteOwnRequests = this.viewMode === 'request' && !isDirector;
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

}
