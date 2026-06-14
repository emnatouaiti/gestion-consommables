import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AdminStockService } from '../../../core/services/admin-stock.service';
import { AdminRefService } from '../../../core/services/admin-ref.service';
import { AdminWarehouseService } from '../../../core/services/admin-warehouse.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UnitService } from '../../../core/services/unit.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-products',
  standalone: false,
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  products: any[] = [];
  categories: any[] = [];
  suppliers: any[] = [];
  units: any[] = [];
  brands: any[] = [];
  modelsList: any[] = [];
  selectedMarqueId: number | null = null;
  flatCategories: { id: number; title: string; level: number; displayTitle: string }[] = [];
  overview: any = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedSupplier: any | null = null;
  selectedProductDetails: any | null = null;
  showSupplierDetailsModal = false;
  newReviewContent = '';
  newReviewRating: number | null = 5;
  highlightedProductId: number | null = null;
  selectedPhotoFiles: File[] = [];
  photoPreviewUrls: string[] = [];
  showModal = false;
  activeTab: 'info' | 'stocks' | 'history' = 'info';
  productHistory: any[] = [];
  historyLoading = false;
  historyPagination = {
    page: 1,
    perPage: 5,
    total: 0,
    lastPage: 1
  };
  updatingPhotoId: number | null = null;
  // Réactivation modal
  showReactivateModal = false;
  reactivateProduct: any | null = null;

  warehouses: any[] = [];
  rooms: any[] = [];
  locations: any[] = [];

  pagination = {
    page: 1,
    per_page: 20,
    total: 0,
    last_page: 1
  };

  filters = {
    q: '',
    status: 'all',
    categorie_id: null as number | null,
    supplier_id: null as number | null,
    low_stock_only: false,
    out_of_stock_only: false
  };

  editingId: number | null = null;
  productForm!: FormGroup;

  constructor(
    private readonly stockService: AdminStockService,
    private readonly refService: AdminRefService,
    private readonly warehouseService: AdminWarehouseService,
    private readonly supplierService: SupplierService,
    private readonly unitService: UnitService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly fb: FormBuilder,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    this.initForm();
  }

  private initForm(): void {
    this.productForm = this.fb.group({
      status: ['active', Validators.required],
      title: ['', [Validators.required, Validators.minLength(2)]],
      short_description: ['', Validators.maxLength(500)],
      description: [''],
      commentaire: [''],
      num_serie: ['', [Validators.required]], // Identifiant unique
      num_inventaire: [{ value: '', disabled: true }], // Toujours auto
      model: [''],
      marque: [''],
      seuil_min: [0, [Validators.required, Validators.min(0)]],
      seuil_max: [null, [Validators.min(0)]],
      reference: [''],
      categorie_id: [null, Validators.required],
      has_expiration: [false],
      unit_id: [null],
      supplier_id: [null]
    }, { validators: this.thresholdValidator });

    this.productForm.valueChanges.subscribe(() => {
      this.updateAutoDescription();
    });
  }

  private lastAutoDesc = '';

  private updateAutoDescription(): void {
    const val = this.productForm.getRawValue();
    const cat = this.flatCategories.find(c => c.id === Number(val.categorie_id));
    const catName = cat ? cat.title : '';
    const marque = this.brands.find(b => b.id === this.selectedMarqueId)?.name || '';
    const parts = [val.title, catName, marque, val.model].filter(p => !!p && p.trim() !== '');
    const newDesc = parts.join(', ');

    const currentDesc = this.productForm.get('description')?.value || '';

    // Only update if current is empty or matches the previous auto-generated one
    if (currentDesc === '' || currentDesc === this.lastAutoDesc) {
      if (currentDesc !== newDesc) {
        this.productForm.get('description')?.setValue(newDesc, { emitEvent: false });
        this.lastAutoDesc = newDesc;
      }
    }
  }

  private thresholdValidator(control: AbstractControl): ValidationErrors | null {
    const min = control.get('seuil_min')?.value;
    const max = control.get('seuil_max')?.value;
    if (max !== null && max !== undefined && max !== '' && Number(max) <= Number(min)) {
      return { thresholdError: true };
    }
    return null;
  }

  /** Responsable de stock can write (create/update/delete). Agent can only read. */
  get canWrite(): boolean {
    const user: any = this.authService.getCurrentUserSnapshot();
    return this.authService.userHasAnyRole(user, ['Responsable de stock', 'Responsable', 'Gestionnaire', 'Administrateur']);
  }

  /** Access aligned with backend products middleware (Responsable de stock | Agent de stock). */
  get canAccessProducts(): boolean {
    const user: any = this.authService.getCurrentUserSnapshot();
    return this.authService.userHasAnyRole(user, ['Responsable de stock', 'Responsable', 'Gestionnaire', 'Agent de stock', 'Agent']);
  }

  ngOnInit(): void {
    if (!this.canAccessProducts) {
      this.router.navigate(['/profile']);
      return;
    }

    if (this.canWrite) {
      this.loadUnits();
    }
    this.loadSuppliers();
    this.loadBrands();
    this.loadAll();
  }

  private loadBrands(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.refService.listMarques({}).subscribe({
         next: (res: any) => { this.brands = Array.isArray(res) ? res : []; this.cdr.detectChanges(); },
         error: () => this.brands = []
    });
  }

  onMarqueSelect(): void {
    const id = this.selectedMarqueId;
    this.modelsList = [];
    this.productForm.get('model')?.setValue('');
    if (!id) return;
    const mar = this.brands.find((x: any) => x.id === id);
    this.productForm.get('marque')?.setValue(mar ? mar.name : '');
    this.refService.listModeles({ marque_id: id }).subscribe({
      next: (res: any) => {
        this.modelsList = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: () => this.modelsList = []
    });
  }

  onTitleBlur(): void {
    const title = this.productForm.get('title')?.value;
    const desc = this.productForm.get('description')?.value;
    const shortDesc = this.productForm.get('short_description')?.value;
    if (title && !desc && !shortDesc) {
      this.generateDescriptions();
    }
  }

  generateDescriptions(): void {
    const title = this.productForm.get('title')?.value;
    if (!title || !title.trim()) {
      this.errorMessage = 'Titre requis pour générer la description.';
      return;
    }
    this.errorMessage = '';
    const payload = {
      title: title,
      marque: this.productForm.get('marque')?.value || undefined,
      model: this.productForm.get('model')?.value || undefined
    };
    this.stockService.generateDescriptions(payload).subscribe({
      next: (res: any) => {
        if (res?.short_description) this.productForm.get('short_description')?.setValue(res.short_description);
        if (res?.description) this.productForm.get('description')?.setValue(res.description);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = this.extractApiError(err, 'Impossible de générer la description.');
      }
    });
  }

  private loadWarehouses(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.warehouseService.listWarehouses().subscribe({
      next: (res: any) => {
        this.warehouses = res.data || [];
        this.cdr.detectChanges();
      },
      error: () => this.warehouses = []
    });
  }

  private loadSuppliers(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.supplierService.getSuppliers().subscribe({
      next: (res: any) => {
        this.suppliers = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        this.cdr.detectChanges();
      },
      error: () => this.suppliers = []
    });
  }

  private loadUnits(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.unitService.list().subscribe({
      next: (res: any) => {
        this.units = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: () => this.units = []
    });
  }

  /* --- Data Loading --- */

  loadAll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLoading = true;
    this.errorMessage = '';

    if (!this.canWrite) {
      this.loadProducts();
      return;
    }

    this.stockService.listCategories({ tree: true }).subscribe({
      next: (cats) => {
        this.categories = Array.isArray(cats) ? cats : [];
        this.flatCategories = this.flattenTree(this.categories);
        this.loadProducts();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = err?.message || 'Erreur de chargement des catégories.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadProducts(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.stockService.listProducts({
      q: this.filters.q.trim(),
      status: this.filters.status,
      categorie_id: this.filters.categorie_id,
      supplier_id: this.filters.supplier_id,
      low_stock_only: this.filters.low_stock_only,
      out_of_stock_only: this.filters.out_of_stock_only,
      page: this.pagination.page,
      per_page: this.pagination.per_page
    }).subscribe({
      next: (data) => {
        this.products = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        this.pagination.total = Number(data?.total || this.products.length || 0);
        this.pagination.last_page = Number(data?.last_page || 1);
        this.pagination.page = Number(data?.current_page || this.pagination.page);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = err?.message || 'Erreur de chargement des produits.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadOverview(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.stockService.productsOverview().subscribe({
      next: (data) => {
        this.overview = data || null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.overview = null;
        this.cdr.detectChanges();
      }
    });
  }

  /* --- Modal --- */

  openAddModal(): void {
    this.resetForm();
    if (this.brands.length === 0) {
      this.loadBrands();
    }
    this.showModal = true;
  }


  openEditModal(item: any): void {
    this.editingId = item.id;
    this.productForm.patchValue({
      status: item.status || 'active',
      title: item.title || '',
      short_description: item.short_description || '',
      description: item.description || '',
      commentaire: item.commentaire || '',
      num_serie: item.num_serie || '',
      num_inventaire: item.num_inventaire || '',
      model: item.model || '',
      marque: item.marque || '',
      seuil_min: item.seuil_min || 0,
      seuil_max: item.seuil_max || null,
      reference: item.reference || '',
      categorie_id: item.categorie_id ?? null,
      has_expiration: item.has_expiration ?? false,
      unit_id: item.unit_id ?? item.unit?.id ?? null,
      supplier_id: (item.suppliers && item.suppliers.length) ? item.suppliers[0].id : null
    });

    this.selectedPhotoFiles = [];
    this.photoPreviewUrls = [];
    const existingPhotos = Array.isArray(item.photos) && item.photos.length ? item.photos : (item.photo ? [{ path: item.photo }] : []);
    this.photoPreviewUrls = existingPhotos
      .map((p: any) => this.photoUrl(p?.path || p?.photo || p))
      .filter(Boolean);

    this.showModal = true;
    setTimeout(() => {
        if (this.brands.length === 0) {
            this.refService.listMarques({}).subscribe({
                next: (res: any) => {
                    this.brands = Array.isArray(res) ? res : [];
                    this.cdr.detectChanges();
                    this.selectMarqueIfAny();
                },
                error: () => this.brands = []
            });
        } else {
            this.selectMarqueIfAny();
        }
    }, 0);
  }

  private selectMarqueIfAny(): void {
    const marque = this.productForm.get('marque')?.value;
    const b = this.brands.find((x:any) => x.name === marque);
    if (b) {
        this.selectedMarqueId = b.id;
        this.onMarqueSelect();
    }
  }

  manageProductStocks(product: any): void {
    this.router.navigate(['/produit', product.id, 'stocks']);
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  save(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.errorMessage = 'Veuillez corriger les erreurs dans le formulaire.';
      return;
    }

    const val = this.productForm.value;
    const unitId = val.unit_id ? Number(val.unit_id) : null;
    const selectedUnit = this.units.find((u: any) => u.id === unitId);

    if (val.short_description) {
      val.short_description = this.extractFirstTwoSentences(val.short_description);
    }

    const payload = {
      ...val,
      seuil_min: Number(val.seuil_min || 0),
      seuil_max: val.seuil_max ? Number(val.seuil_max) : null,
      categorie_id: Number(val.categorie_id),
      has_expiration: val.has_expiration ? 1 : 0,
      unit_id: unitId,
      supplier_ids: val.supplier_id ? [Number(val.supplier_id)] : [],
      photos: this.selectedPhotoFiles
    };

    if (!this.editingId && (!payload.reference || payload.reference === '')) {
      (payload as any).reference = undefined;
    }

    if (this.editingId && (!payload.reference || payload.reference === '')) {
      this.errorMessage = 'Référence est obligatoire lors de la modification.';
      return;
    }
    this.errorMessage = '';

    const req$ = this.editingId
      ? this.stockService.updateProduct(this.editingId as number, payload)
      : this.stockService.createProduct(payload);

    req$.subscribe({
      next: (res: any) => {
        const created = res?.product || res?.data || null;
        if (this.editingId) {
          this.successMessage = 'Produit mis à jour !';
        } else if (created && created.reference) {
          this.successMessage = 'Produit créé ! Réf : ' + created.reference;
          this.highlightedProductId = created.id || null;
        } else {
          this.successMessage = 'Produit créé !';
        }
        this.closeModal();
        this.loadProducts();
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (err: any) => {
        if (err?.existing_product) {
          this.reactivateProduct = err.existing_product;
          this.showReactivateModal = true;
          this.errorMessage = '';
          this.cdr.detectChanges();
        } else {
          this.errorMessage = this.extractApiError(err, 'Impossible de sauvegarder le produit.');
        }
      }
    });
  }

  private extractFirstTwoSentences(text: string): string {
    if (!text) return '';
    const s = text.trim();
    const regex = /([^\.\!\?]+[\.\!\?])(\s*([^\.\!\?]+[\.\!\?]))?/;
    const match = s.match(regex);
    if (match && match[1]) {
      let result = match[1].trim();
      if (match[3]) result += ' ' + match[3].trim();
      if (result.length > 240) return result.slice(0, 237).trim() + '...';
      return result;
    }
    return s.length > 160 ? s.slice(0, 157).trim() + '...' : s;
  }

  remove(id: number): void {
    if (!confirm('Supprimer ce produit ?')) return;
    this.stockService.deleteProduct(id).subscribe({
      next: () => {
        this.successMessage = 'Produit supprimé !';
        this.loadProducts();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err: any) => {
        this.errorMessage = this.extractApiError(err, 'Suppression impossible.');
      }
    });
  }

  confirmReactivate(): void {
    if (!this.reactivateProduct?.id) return;
    this.stockService.activateProduct(this.reactivateProduct.id).subscribe({
      next: () => {
        this.successMessage = `Produit "${this.reactivateProduct.title}" réactivé !`;
        this.showReactivateModal = false;
        this.reactivateProduct = null;
        this.closeModal();
        this.loadProducts();
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err: any) => {
        this.errorMessage = this.extractApiError(err, 'Impossible de réactiver le produit.');
      }
    });
  }

  dismissReactivate(): void {
    this.showReactivateModal = false;
    this.reactivateProduct = null;
  }

  resetForm(): void {
    this.editingId = null;
    this.productForm.reset({
      status: 'active',
      seuil_min: 0,
      has_expiration: false
    });
    this.selectedPhotoFiles = [];
    this.photoPreviewUrls = [];
    this.selectedMarqueId = null;
    this.modelsList = [];
    this.errorMessage = '';
  }

  /* --- Photo --- */

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > 2 * 1024 * 1024) {
        this.errorMessage = 'Photo trop lourde (max 2 Mo).';
        return;
      }
      this.selectedPhotoFiles.push(file);
      this.photoPreviewUrls.push(URL.createObjectURL(file));
    }
    input.value = '';
  }

  onRowPhotoSelected(event: Event, product: any): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const file = files[0];
    this.updatingPhotoId = product.id;
    this.stockService.updateProduct(product.id, { photos: [file] }).subscribe({
      next: () => {
        this.successMessage = 'Photo mise à jour.';
        this.updatingPhotoId = null;
        this.loadProducts();
        setTimeout(() => (this.successMessage = ''), 2000);
      },
      error: (err: any) => {
        this.errorMessage = this.extractApiError(err, 'Impossible de mettre à jour la photo.');
        this.updatingPhotoId = null;
      }
    });
    input.value = '';
  }

  photoUrl(path: string | null | undefined): string {
    if (!path) return 'assets/images/placeholder-product.png';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/+/, '').replace(/^storage\//, '');
    return `http://localhost:8000/api/docs/${cleanPath}`;
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/placeholder-product.png';
  }

  productThumb(product: any): string {
    const direct = product?.photo;
    if (direct) return this.photoUrl(direct);
    const firstPhoto = Array.isArray(product?.photos) && product.photos.length ? product.photos[0].path || product.photos[0] : null;
    return this.photoUrl(firstPhoto);
  }

  openProductDetails(p: any): void {
    this.selectedProductDetails = p;
    this.activeTab = 'info';
    this.loadProductHistory(p.id);
  }

  loadProductHistory(productId: number, page: number = 1): void {
    this.historyPagination.page = page;
    this.historyLoading = true;
    this.stockService.getProductHistory(productId, {
      page: this.historyPagination.page,
      per_page: this.historyPagination.perPage
    }).subscribe({
      next: (res: any) => {
        this.productHistory = res.data || [];
        this.historyPagination.total = res.total || 0;
        this.historyPagination.lastPage = res.last_page || 1;
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.productHistory = [];
        this.historyLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onHistoryPerPageChange(): void {
    if (this.selectedProductDetails?.id) {
      this.loadProductHistory(this.selectedProductDetails.id, 1);
    }
  }

  closeProductDetails(): void {
    this.selectedProductDetails = null;
    this.productHistory = [];
  }

  /* --- Filters & Pagination --- */

  applyFilters(): void {
    this.pagination.page = 1;
    this.loadProducts();
  }

  clearFilters(): void {
    this.filters = {
      q: '',
      status: 'all',
      categorie_id: null,
      supplier_id: null,
      low_stock_only: false,
      out_of_stock_only: false
    };
    this.pagination.page = 1;
    this.loadProducts();
  }

  filterByCategory(categoryId: number | null): void {
    this.filters.categorie_id = categoryId;
    this.pagination.page = 1;
    this.loadProducts();
  }

  filterBySupplier(supplierId: number | null): void {
    this.filters.supplier_id = supplierId;
    this.pagination.page = 1;
    this.loadProducts();
  }

  prevPage(): void {
    if (this.pagination.page <= 1) return;
    this.pagination.page -= 1;
    this.loadProducts();
  }

  nextPage(): void {
    if (this.pagination.page >= this.pagination.last_page) return;
    this.pagination.page += 1;
    this.loadProducts();
  }

  getCategoryTitle(id: number | null): string {
    if (!id) return '-';
    const cat = this.flatCategories.find((c: any) => c.id === id);
    return cat ? cat.title : `#${id}`;
  }

  getStockStatus(p: any): string {
    if (p.stock_quantity <= 0) return 'rupture';
    if (p.seuil_min && p.stock_quantity <= p.seuil_min) return 'faible';
    return 'ok';
  }

  supplierNames(product: any): string {
    if (!product?.suppliers?.length) return 'â€”';
    return product.suppliers.map((s: any) => s.name || s).join(', ');
  }

  downloadDoc(doc: any): void {
    const path = doc?.path;
    if (!path) return;
    const clean = path.replace(/^[/\\]+/, '').replace(/^storage\//, '');
    const url = `http://localhost:8000/api/docs/${clean}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc?.title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* --- Helpers --- */

  private extractApiError(err: any, fallback: string): string {
    if (!err) return fallback;
    const payload = err?.error ?? err;
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
    if (typeof err?.message === 'string' && err.message.trim()) return err.message;
    const errors = payload?.errors || payload?.error || err?.errors;
    if (errors && typeof errors === 'object') {
      const firstField = Object.keys(errors)[0];
      const firstValue = firstField ? errors[firstField] : null;
      if (Array.isArray(firstValue) && firstValue.length) return String(firstValue[0]);
      if (typeof firstValue === 'string') return firstValue;
    }
    return fallback;
  }

  private flattenTree(nodes: any[], level = 0): { id: number; title: string; level: number; displayTitle: string }[] {
    const result: { id: number; title: string; level: number; displayTitle: string }[] = [];
    for (const node of nodes) {
      const prefix = level === 0 ? '' : '\u00A0\u00A0'.repeat(level) + 'â”” ';
      result.push({
        id: node.id,
        title: node.title,
        level: node.level || (level + 1),
        displayTitle: prefix + node.title
      });
      if (node.recursive_children && node.recursive_children.length) {
        result.push(...this.flattenTree(node.recursive_children, level + 1));
      }
    }
    return result;
  }


  viewProductsByLocation(locationId: number | null): void {
    if (!locationId) return;
    this.router.navigate(['/location', locationId, 'products']);
  }

  openSupplierDetails(supplierId: number): void {
    if (!isPlatformBrowser(this.platformId) || !supplierId) return;
    this.isLoading = true;
    this.supplierService.getSupplier(supplierId).subscribe({
      next: (data) => {
        this.selectedSupplier = data;
        this.showSupplierDetailsModal = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Erreur lors du chargement du fournisseur';
        this.cdr.detectChanges();
      }
    });
  }

  closeSupplierDetails(): void {
    this.showSupplierDetailsModal = false;
    this.selectedSupplier = null;
  }

  submitSupplierReview(): void {
    if (!this.selectedSupplier || !this.newReviewContent.trim()) return;
    this.isLoading = true;
    this.supplierService.addReview(this.selectedSupplier.id, {
      content: this.newReviewContent,
      rating: this.newReviewRating || 5
    }).subscribe({
      next: (review) => {
        if (this.selectedSupplier) {
          if (!this.selectedSupplier.reviews) this.selectedSupplier.reviews = [];
          this.selectedSupplier.reviews.unshift(review);
        }
        this.newReviewContent = '';
        this.isLoading = false;
        this.successMessage = 'Avis publié !';
        this.cdr.detectChanges();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.errorMessage = "Erreur lors de la publication de l'avis";
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
