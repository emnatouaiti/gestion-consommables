import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AdminWarehouseService } from '../../../core/services/admin-warehouse.service';

import { AdminStockService } from '../../../core/services/admin-stock.service';
import { AdminRefService } from '../../../core/services/admin-ref.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UnitService } from '../../../core/services/unit.service';


@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsComponent implements OnInit {
  private router = inject(Router);
  private refService = inject(AdminRefService);
  private supplierService = inject(SupplierService);
  private unitService = inject(UnitService);
  private stockService = inject(AdminStockService);

  documents: any[] = [];
  file: File | null = null;
  title = '';
  type = 'bon_livraison';
  direction = 'in';
  typeFilter: string | null = 'bon_livraison';
  product_id: number | null = null;
  supplier_id: number | null = null;
  warehouse_id: number | null = null;
  isLoading = false;
  message = '';
  error = '';
  expandedDocId: number | null = null;
  showEditLines: number | null = null;

  categories: any[] = [];
  warehouses: any[] = [];
  supplierConfirmation: any = null;
  productConfirmation: any = null;
  locationConfirmation: any = null;
  locationStepIndex = 0;
  allProducts: any[] = [];
  
  brands: any[] = [];
  modelsList: any[] = [];
  units: any[] = [];
  suppliers: any[] = [];
  flatCategories: { id: number; title: string; level: number; displayTitle: string }[] = [];

  // Expiration modal properties
  showExpirationModal = false;
  expirationDate: string = '';
  currentApplyingDocument: any = null;
  expirationProductHasExpiration = false;
  today = new Date().toISOString().split('T')[0];

  constructor(
    private http: HttpClient,
    private warehouseService: AdminWarehouseService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly cdr: ChangeDetectorRef
  ) {}

  currentUserDepotId: number | null = null;
  currentUserRoleName: string = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.load();
    this.loadWarehouses();
    this.loadProductsList();
    this.loadCurrentUser();
    this.loadBrands();
    this.loadUnits();
    this.loadSuppliers();
    this.loadCategories();
  }

  loadBrands(): void {
    this.refService.listMarques({}).subscribe({
      next: (res: any) => { this.brands = Array.isArray(res) ? res : []; }
    });
  }

  loadUnits(): void {
    this.unitService.list().subscribe({
      next: (res: any) => { this.units = Array.isArray(res) ? res : []; }
    });
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (res: any) => { this.suppliers = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []); }
    });
  }

  onMarqueSelect(s: any): void {
    s.modelsList = [];
    s.model = '';
    if (!s.marque_id) return;
    const mar = this.brands.find((x: any) => x.id === s.marque_id);
    s.marque = mar ? mar.name : '';
    this.refService.listModeles({ marque_id: s.marque_id }).subscribe({
      next: (res: any) => { s.modelsList = Array.isArray(res) ? res : []; this.cdr.detectChanges(); }
    });
  }

  generateDescriptions(s: any): void {
    if (!s.title || !s.title.trim()) return;
    const payload = {
      title: s.title,
      marque: s.marque || undefined,
      model: s.model || undefined
    };
    this.stockService.generateDescriptions(payload).subscribe({
      next: (res: any) => {
        if (res?.short_description) s.short_description = res.short_description;
        if (res?.description) s.description = res.description;
        this.cdr.detectChanges();
      }
    });
  }

  loadCurrentUser(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.http.get('/api/user').subscribe({
      next: (user: any) => {
        this.currentUserDepotId = user?.depot_id || null;
        const roleName = user?.role?.name || user?.role_name || user?.role || '';
        this.currentUserRoleName = String(roleName).toLowerCase();
        this.cdr.detectChanges();
      },
      error: () => {
        // User not authenticated or error loading
      }
    });
  }

  loadProductsList(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.http.get('/api/products/request-list').subscribe({
      next: (res: any) => { this.allProducts = Array.isArray(res) ? res : []; },
      error: () => { this.allProducts = []; }
    });
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLoading = true;
    this.http.get('/api/documents').subscribe({
      next: (res: any) => {
        const rawDocs = Array.isArray(res) ? res : [];
        // Filtrer pour ne garder que ce qui est lie a l'OCR/Livraison
        this.documents = rawDocs.filter((d: any) =>
          d.type === 'bon_livraison' || d.type === 'document' || !d.type
        );
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const status = err?.status || err?.statusCode || 'inconnu';
        const msg = err?.error?.message || err?.statusText || 'Erreur de connexion';
        this.error = `Impossible de charger les documents (${status}) : ${msg}`;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadCategories(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Try admin endpoint first
    this.http.get('/api/categories?status=active').subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : [];
        if (this.categories.length === 0) {
          // Try tree mode as fallback
          this.http.get('/api/categories?tree=1').subscribe({
            next: (tree: any) => { 
              this.categories = Array.isArray(tree) ? tree : []; 
              this.flatCategories = this.flattenTree(this.categories);
            },
            error: () => { this.loadCategoriesPublic(); }
          });
        } else {
            this.flatCategories = this.flattenTree(this.categories);
        }
      },
      error: (err: any) => {
        // If admin endpoint fails (403 or other), try public endpoint
        if (err?.status === 403) {
          this.loadCategoriesPublic();
          return;
        }
        this.loadCategoriesPublic();
      }
    });
  }

  private loadCategoriesPublic(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Fallback to public categories endpoint for users without admin role
    this.http.get('/api/categories/public?status=active').subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : [];
        if (this.categories.length === 0) {
          this.http.get('/api/categories/public?tree=1').subscribe({
            next: (tree: any) => { 
                this.categories = Array.isArray(tree) ? tree : []; 
                this.flatCategories = this.flattenTree(this.categories);
            },
            error: () => { this.categories = []; this.flatCategories = []; }
          });
        } else {
            this.flatCategories = this.flattenTree(this.categories);
        }
      },
      error: () => {
        this.categories = [];
        this.flatCategories = [];
      }
    });
  }

  private flattenTree(nodes: any[], level = 0): { id: number; title: string; level: number; displayTitle: string }[] {
    const result: { id: number; title: string; level: number; displayTitle: string }[] = [];
    for (const node of nodes) {
      const prefix = level === 0 ? '' : '\u00A0\u00A0'.repeat(level) + '└ ';
      result.push({
        id: node.id,
        title: node.title || node.name,
        level: node.level || (level + 1),
        displayTitle: prefix + (node.title || node.name)
      });
      if (node.recursive_children && node.recursive_children.length) {
        result.push(...this.flattenTree(node.recursive_children, level + 1));
      }
    }
    return result;
  }

  loadWarehouses(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.warehouseService.listWarehouses(null, 200).subscribe({
      next: (res: any) => {
        this.warehouses = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: () => {
        this.warehouses = [];
      }
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = (input.files && input.files.length) ? input.files[0] : null;
  }

  upload(): void {
    if (!this.file) {
      this.error = 'Choisissez un fichier.';
      return;
    }

    this.error = '';
    this.message = '';
    const form = new FormData();
    form.append('file', this.file);
    if (this.title) form.append('title', this.title);
    if (this.type) form.append('type', this.type);
    if (this.direction) form.append('direction', this.direction);
    if (this.product_id) form.append('product_id', String(this.product_id));
    if (this.supplier_id) form.append('supplier_id', String(this.supplier_id));
    form.append('auto_create_supplier', 'false');

    this.isLoading = true;
    this.http.post('/api/documents', form).subscribe({
      next: (doc: any) => {
        this.message = 'Document importe. OCR en cours...';
        this.title = doc?.title || '';
        this.type = doc?.type || '';
        this.direction = doc?.direction || 'unknown';
        this.file = null;
        this.supplierConfirmation = null;
        this.load();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        // Log complet pour debug 422
        // eslint-disable-next-line no-console
        console.error('Erreur backend:', err);
        if (err?.error) {
          // eslint-disable-next-line no-console
          console.error('Detail err.error:', err.error);
        }
        const suggested = err?.suggested_supplier || err?.error?.suggested_supplier;
        const suggestedExisting = err?.suggested_existing_supplier || err?.error?.suggested_existing_supplier;
        if (suggested) {
          this.supplierConfirmation = {
            suggested,
            existing: suggestedExisting || null,
            name: suggested.name || '',
            email: suggested.email || '',
            title: this.title,
            type: this.type,
            direction: this.direction,
            product_id: this.product_id,
            warehouse_id: this.warehouse_id,
            file: this.file
          };
          this.error = '';
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        // Affichage detaille de l'erreur de validation
        if (err?.error && typeof err.error === 'object') {
          if (err.error.errors) {
            // Laravel retourne souvent un objet errors { champ: [msg] }
            this.error = Object.entries(err.error.errors)
              .map(([field, msgs]: [string, any]) => `${field}: ${(Array.isArray(msgs) ? msgs.join(', ') : msgs)}`)
              .join(' | ');
          } else if (err.error.message) {
            this.error = err.error.message;
          } else {
            this.error = JSON.stringify(err.error);
          }
        } else {
          this.error = err?.message || err?.error?.message || 'Upload impossible.';
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleExpanded(docId: number): void {
    this.expandedDocId = this.expandedDocId === docId ? null : docId;
  }

  toggleEditLines(docId: number): void {
    this.showEditLines = this.showEditLines === docId ? null : docId;
  }

  apply(doc: any): void {
    const defaultBatchNumber = 'LOT-' + new Date().toISOString().slice(0,10).replace(/-/g, '') + '-' + doc.id;

    const items = (doc?.ocr_lines || []).map((l: any) => {
      let product = null;
      if (l.product_id) {
        product = this.allProducts.find(p => p.id === l.product_id);
      }
      if (!product && l.reference) {
        product = this.allProducts.find(p => p.reference?.toLowerCase() === l.reference.toLowerCase());
      }
      if (!product && l.title) {
        product = this.allProducts.find(p => p.title?.toLowerCase() === l.title.toLowerCase());
      }
      if (!product && doc.product) {
        product = doc.product;
      }

      return {
      title: l.title,
      reference: l.reference || null,
      quantity: l.quantity,
      direction: doc.direction || 'unknown',
      product_id: product?.id || l.product_id || null,
      has_expiration: !!product?.has_expiration,
      warehouse_id: l.warehouse_id || null,
      room_id: l.room_id || null,
      warehouse_location_id: l.warehouse_location_id || l.location_id || null,
      cabinet_id: l.cabinet_id || null,
      expiration_date: null,
      batch_number: !!product?.has_expiration ? defaultBatchNumber : null
    };
    });

    if (items.length === 0) {
      this.error = 'Aucune ligne OCR trouvee. Verifiez le fichier.';
      return;
    }

    const missingProducts = items.filter((i:any) => !i.product_id);
    if (missingProducts.length > 0) {
      this.productConfirmation = {
        doc,
        items,
        suggestedProducts: missingProducts.map((p:any) => ({
          title: p.title,
          reference: p.reference,
          unit: '',
          seuil_min: 0,
          has_expiration: false,
          category_id: null
        }))
      };
      this.locationConfirmation = null;
      this.supplierConfirmation = null;
      this.error = ''; 
      this.loadCategories();
      return;
    }

    this.openLocationConfirmation(doc, items, false);
  }

  private executeApply(doc: any, items: any[], autoCreateProduct: boolean): void {
    // Fermer les modaux immediatement pour une meilleure UX
    this.showEditLines = null;
    this.locationConfirmation = null;
    this.productConfirmation = null;
    this.cdr.detectChanges();

    this.isLoading = true;
    this.http.post(`/api/documents/${doc.id}/apply`, { items, auto_create_product: autoCreateProduct }).subscribe({
      next: (res: any) => {
        const isPending = res?.message?.toLowerCase().includes('validation');
        this.message = res?.message || 'Document applique au stock.';
        if (isPending) {
          this.message += ' Vous pouvez suivre l\'etat de vos mouvements dans l\'onglet "Mouvements".';
        }
        this.error = '';
        setTimeout(() => this.load(), 500);
        this.isLoading = false;
        this.cdr.detectChanges();

        // Si c'est en attente, on redirige apres un court delai pour que l'utilisateur voit le message
        if (isPending) {
           setTimeout(() => {
             this.router.navigate(['/mouvements-stock']);
           }, 2000);
        }
      },
      error: (err) => {
        const suggested = err?.error?.suggested_products || err?.suggested_products || err?.error?.suggested_product || err?.suggested_product;
        if (suggested) {
          const formatted = Array.isArray(suggested) ? suggested : [suggested];
          this.productConfirmation = {
            doc,
            items,
            suggestedProducts: formatted.map((p: any) => ({ ...p, category_id: p.category_id || p.categorie_id || null }))
          };
          this.locationConfirmation = null;
          this.supplierConfirmation = null;
          this.error = 'Produit(s) inconnu(s) detecte(s). Choisissez une categorie pour chacun.';
          this.loadCategories();
        } else {
          this.error = err?.error?.message || err?.message || 'Erreur lors de l application.';
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openLocationConfirmation(doc: any, items: any[], autoCreateProduct: boolean): void {
    const lockDepot = this.shouldLockDepotSelection();
    this.locationConfirmation = {
      doc,
      autoCreateProduct,
      items: items.map((item: any) => ({
        ...item,
        warehouse_id: lockDepot ? this.currentUserDepotId : (item.warehouse_id || this.currentUserDepotId),
        depot_locked: lockDepot,
        storage_target: item.warehouse_location_id ? 'location' : (item.cabinet_id ? 'cabinet' : 'location'),
        rooms: [],
        locations: [],
        cabinets: []
      }))
    };
    this.locationStepIndex = 0;

    this.locationConfirmation.items.forEach((item: any) => {
      if (item.warehouse_id) {
        this.onWarehouseSelected(item, false);
      }
      if (item.room_id) {
        this.onRoomSelected(item, false);
      }
    });

    this.cdr.detectChanges();
  }

  cancelLocationConfirmation(): void {
    this.locationConfirmation = null;
    this.locationStepIndex = 0;
  }

  onWarehouseSelected(item: any, reset = true): void {
    if (item?.depot_locked && this.currentUserDepotId) {
      item.warehouse_id = this.currentUserDepotId;
    }

    if (reset) {
      item.room_id = null;
      item.warehouse_location_id = null;
      item.cabinet_id = null;
      item.storage_target = 'location';
      item.locations = [];
      item.cabinets = [];
    }

    if (!item.warehouse_id) {
      item.rooms = [];
      return;
    }

    this.warehouseService.listRooms(Number(item.warehouse_id), null, 200).subscribe({
      next: (res: any) => {
        item.rooms = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (item.rooms.length > 0 && !item.room_id) {
          item.room_id = item.rooms[0].id;
          this.onRoomSelected(item, true);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        item.rooms = [];
      }
    });
  }

  onRoomSelected(item: any, reset = true): void {
    if (reset) {
      item.warehouse_location_id = null;
      item.cabinet_id = null;
      item.storage_target = 'location';
    }

    if (!item.room_id) {
      item.locations = [];
      item.cabinets = [];
      return;
    }

    this.warehouseService.listLocations(Number(item.room_id), null, 500).subscribe({
      next: (res: any) => {
        item.locations = (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])).map((loc: any) => ({
          ...loc,
          isFull: loc.capacity_units > 0 && loc.current_units >= loc.capacity_units
        }));

        if (!item.warehouse_location_id && !item.cabinet_id && item.locations.length > 0) {
          const availableLoc = item.locations.find((l: any) => !l.isFull && (!l.capacity_units || l.current_units + (item.quantity || 0) <= l.capacity_units));
          if (availableLoc) {
            item.warehouse_location_id = availableLoc.id;
            item.storage_target = 'location';
          }
        }

        this.cdr.detectChanges();
      },
      error: () => {
        item.locations = [];
      }
    });

    this.warehouseService.listCabinets(Number(item.room_id), null, 500).subscribe({
      next: (res: any) => {
        item.cabinets = (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])).map((cab: any) => ({
          ...cab,
          isFull: cab.capacity_units > 0 && cab.current_units >= cab.capacity_units
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        item.cabinets = [];
      }
    });
  }

  onLocationSelected(item: any): void {
    if (item.warehouse_location_id) {
      item.cabinet_id = null;
      item.storage_target = 'location';
    }
  }

  onCabinetSelected(item: any): void {
    if (item.cabinet_id) {
      item.warehouse_location_id = null;
      item.storage_target = 'cabinet';
    }
  }

  selectStorageTarget(item: any, target: 'location' | 'cabinet'): void {
    item.storage_target = target;
    if (target === 'location') {
      item.cabinet_id = null;
    } else {
      item.warehouse_location_id = null;
    }
  }

  currentLocationItem(): any | null {
    if (!this.locationConfirmation?.items?.length) return null;
    return this.locationConfirmation.items[this.locationStepIndex] || null;
  }

  canGoNextLocation(): boolean {
    const item = this.currentLocationItem();
    if (!item) return false;
    if (!item.warehouse_id || !item.room_id) return false;
    if (item.storage_target === 'cabinet') return !!item.cabinet_id;
    return !!item.warehouse_location_id;
  }

  nextLocationStep(): void {
    if (!this.locationConfirmation || !this.canGoNextLocation()) return;
    if (this.locationStepIndex < this.locationConfirmation.items.length - 1) {
      this.locationStepIndex += 1;
      this.cdr.detectChanges();
      return;
    }
    this.confirmLocationSelection();
  }

  previousLocationStep(): void {
    if (this.locationStepIndex > 0) {
      this.locationStepIndex -= 1;
      this.cdr.detectChanges();
    }
  }

  confirmLocationSelection(): void {
    if (!this.locationConfirmation) return;

    for (const item of this.locationConfirmation.items) {
      if (Number(item.quantity) > 0 && (!item.warehouse_id || !item.room_id || (!item.warehouse_location_id && !item.cabinet_id))) {
        this.error = `Veuillez choisir depot, salle, puis emplacement ou armoire pour "${item.title}".`;
        this.cdr.detectChanges();
        return;
      }
    }

    const items = this.locationConfirmation.items.map((item: any) => ({
      title: item.title,
      reference: item.reference,
      quantity: item.quantity,
      direction: item.direction,
      product_id: item.product_id,
      warehouse_id: item.warehouse_id ? Number(item.warehouse_id) : null,
      room_id: item.room_id ? Number(item.room_id) : null,
      warehouse_location_id: item.warehouse_location_id ? Number(item.warehouse_location_id) : null,
      cabinet_id: item.cabinet_id ? Number(item.cabinet_id) : null,
      expiration_date: item.expiration_date || null,
      batch_number: item.batch_number || null
    }));

    this.executeApply(this.locationConfirmation.doc, items, this.locationConfirmation.autoCreateProduct);
  }

  confirmProductCreation(): void {
    if (!this.productConfirmation || !Array.isArray(this.productConfirmation.suggestedProducts)) return;

    const required = this.productConfirmation.suggestedProducts;
    for (const prod of required) {
      if (!prod.category_id || Number.isNaN(Number(prod.category_id)) || Number(prod.category_id) <= 0) {
        this.error = 'Veuillez selectionner une categorie pour chaque produit inconnu.';
        return;
      }
    }

    const items = this.productConfirmation.items.map((item: any) => {
      const found = required.find((prod: any) => prod.title === item.title && (prod.reference || '') === (item.reference || ''));
      if (!found) return item;

      return {
        ...item,
        title: found.title || item.title,
        reference: found.reference || item.reference,
        category_id: Number(found.category_id),
        categorie_id: Number(found.category_id),
        unit: found.unit || null,
        seuil_min: found.seuil_min ? Number(found.seuil_min) : 0,
        has_expiration: !!found.has_expiration,
        warehouse_id: item.warehouse_id ? Number(item.warehouse_id) : null,
        room_id: item.room_id ? Number(item.room_id) : null,
        warehouse_location_id: item.warehouse_location_id ? Number(item.warehouse_location_id) : null,
        cabinet_id: item.cabinet_id ? Number(item.cabinet_id) : null,
        expiration_date: item.expiration_date || null,
        batch_number: item.batch_number || null
      };
    });

    const docToApply = this.productConfirmation.doc;
    this.productConfirmation = null;
    this.openLocationConfirmation(docToApply, items, true);
  }

  shouldLockDepotSelection(): boolean {
    if (!this.currentUserDepotId) return false;
    const role = this.currentUserRoleName || '';
    return role.includes('responsable') || role.includes('agent');
  }

  cancelProductCreation(): void {
    this.productConfirmation = null;
  }

  confirmSupplierCreation(): void {
    if (!this.supplierConfirmation) return;

    const { suggested, name, email, file, title, type, direction, product_id, warehouse_id } = this.supplierConfirmation;
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('auto_create_supplier', 'true');
    form.append('name', name || suggested.name || '');
    form.append('supplier_name', name || suggested.name || '');
    if (email) form.append('supplier_email', email);
    if (this.supplierConfirmation?.existing?.id && this.supplierConfirmation.useExisting) {
      form.append('supplier_id', String(this.supplierConfirmation.existing.id));
      form.append('confirm_supplier_match', 'true');
      form.set('auto_create_supplier', 'false');
    }
    if (title) form.append('title', title);
    if (type) form.append('type', type);
    if (direction) form.append('direction', direction);
    if (product_id) form.append('product_id', String(product_id));
    if (warehouse_id) form.append('warehouse_id', String(warehouse_id));

    this.isLoading = true;
    this.http.post('/api/documents', form).subscribe({
      next: () => {
        this.message = 'Document importe avec le fournisseur confirme.';
        this.supplierConfirmation = null;
        this.load();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de confirmation fournisseur.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelSupplierCreation(): void {
    this.supplierConfirmation = null;
  }

  chooseExistingSupplier(): void {
    if (!this.supplierConfirmation?.existing?.id) return;
    this.supplierConfirmation.useExisting = true;
    this.confirmSupplierCreation();
  }

  chooseNewSupplier(): void {
    if (!this.supplierConfirmation) return;
    this.supplierConfirmation.useExisting = false;
  }

  runDiagnostic(doc: any): void {
    if (!doc?.path) {
      this.error = 'Impossible de diagnostiquer: fichier non trouve.';
      return;
    }

    this.isLoading = true;
    this.http.post('/api/documents/diagnostic', { path: doc.path }).subscribe({
      next: (res: any) => {
        this.message = `Diagnostic termine: ${res?.ocr_lines_count || 0} lignes trouvees.`;
        if (res?.lines) {
          doc.ocr_lines = res.lines;
          doc.ocr_text = res.ocr_text; // Optionnel: mettre a jour le texte brut
          this.saveDocumentOcrLines(doc); // Sauvegarder automatiquement les nouveaux resultats
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du diagnostic.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private saveDocumentOcrLines(doc: any): void {
    if (!doc?.id) return;

    this.http.put(`/api/documents/${doc.id}`, { ocr_lines: doc.ocr_lines || [] }).subscribe({
      next: () => {
        this.message = 'Lignes OCR enregistrees.';
        this.error = '';
      },
      error: (err) => {
        this.error = 'Impossible de sauvegarder les lignes OCR : ' + (err?.error?.message || err?.message || 'Erreur inconnue');
      }
    });
  }

  removeOcrLine(doc: any, index: number): void {
    if (doc.ocr_lines) {
      doc.ocr_lines.splice(index, 1);
      this.saveDocumentOcrLines(doc);
    }
  }

  addOcrLine(doc: any): void {
    if (!doc.ocr_lines) {
      doc.ocr_lines = [];
    }
    doc.ocr_lines.push({
      reference: '',
      title: '',
      quantity: 1
    });
    this.saveDocumentOcrLines(doc);
  }

  download(doc: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const path = doc?.path;
    if (!path) return;
    const cleanPath = path.replace(/^[/\\]+/, '').replace(/^storage\//, '');
    const url = `/api/docs/${cleanPath}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc?.title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  // -- A ajouter dans ta classe ----------------------------------

// Pagination
pageSizes    = [5, 10, 20];
pageSize     = 10;
currentPage  = 1;
min          = Math.min;

// Filtres
statusFilter: string | null    = null;
directionFilter: string | null = null;

// -- Filtrage --------------------------------------------------
get filteredDocuments() {
  return this.documents.filter(d => {
    const matchStatus    = !this.statusFilter    || d.status    === this.statusFilter;
    const matchDirection = !this.directionFilter || d.direction === this.directionFilter;
    const matchType      = !this.typeFilter      || d.type      === this.typeFilter;
    return matchStatus && matchDirection && matchType;
  });
}

filterByType(type: string | null): void {
  this.typeFilter = this.typeFilter === type ? null : type;
  this.currentPage = 1;
  this.expandedDocId = null;
}

filterByStatus(status: string | null): void {
  this.statusFilter = this.statusFilter === status ? null : status;
  this.currentPage  = 1;
  this.expandedDocId = null;
}

filterByDirection(dir: string | null): void {
  this.directionFilter = this.directionFilter === dir ? null : dir;
  this.currentPage     = 1;
  this.expandedDocId   = null;
}

clearFilters(): void {
  this.statusFilter    = null;
  this.directionFilter = null;
  this.typeFilter      = 'bon_livraison';
  this.currentPage     = 1;
  this.expandedDocId   = null;
}

// -- Stats -----------------------------------------------------
countByStatus(status: string): number {
  return this.documents.filter(d => d.status === status).length;
}

countByDirection(dir: string): number {
  return this.documents.filter(d => d.direction === dir).length;
}

getAvailableTypes(): string[] {
  const types = new Set<string>();
  this.documents.forEach(d => { if (d.type) types.add(d.type); });
  return Array.from(types).sort();
}

getTypeCount(type: string): number {
  return this.documents.filter(d => d.type === type).length;
}

getDocTypeLabel(type: string): string {
  const labels: any = {
    'demande': 'Demande',
    'bon_sortie': 'Bon de Sortie',
    'refus': 'Refus',
    'bon_livraison': 'Bon de Livraison',
    'demande_approuvee': 'Demande Approuvee',
    'document': 'Document'
  };
  return labels[type] || type;
}

// -- Pagination ------------------------------------------------
get totalPages(): number {
  return Math.ceil(this.filteredDocuments.length / this.pageSize);
}

get paginatedDocuments() {
  const start = (this.currentPage - 1) * this.pageSize;
  return this.filteredDocuments.slice(start, start + this.pageSize);
}

get pageNumbers(): (number | string)[] {
  const total   = this.totalPages;
  const current = this.currentPage;
  const pages: (number | string)[] = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (current > 3)             pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2)     pages.push('...');
  pages.push(total);
  return pages;
}

goToPage(page: number): void {
  if (page < 1 || page > this.totalPages) return;
  this.currentPage   = page;
  this.expandedDocId = null;
}

setPageSize(size: number): void {
  this.pageSize      = size;
  this.currentPage   = 1;
  this.expandedDocId = null;
}
}
