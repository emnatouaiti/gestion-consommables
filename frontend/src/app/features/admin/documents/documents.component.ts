import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsComponent implements OnInit {
  documents: any[] = [];
  file: File | null = null;
  title = '';
  type = '';
  direction = 'unknown';
  product_id: number | null = null;
  supplier_id: number | null = null;
  warehouse_id: number | null = null;
  isLoading = false;
  message = '';
  error = '';
  expandedDocId: number | null = null;
  showEditLines: number | null = null;

  categories: any[] = [];
  selectedCategoryId: number | null = null;
  supplierConfirmation: any = null;
  productConfirmation: any = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.load();
    this.loadCategories();
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLoading = true;
    this.http.get('/api/admin/documents').subscribe({
      next: (res: any) => {
        this.documents = Array.isArray(res) ? res : [];
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
    this.http.get('/api/admin/categories?status=active').subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : [];
        if (this.categories.length === 0) {
          // fallback to tree mode when empty in case API mode differs
          this.http.get('/api/admin/categories?tree=1').subscribe({
            next: (tree: any) => { this.categories = Array.isArray(tree) ? tree : []; },
            error: () => { this.categories = []; }
          });
        }
      },
      error: (err) => { console.error('Erreur categories', err); this.categories = []; }
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
    if (this.warehouse_id) form.append('warehouse_id', String(this.warehouse_id));

    if (!isPlatformBrowser(this.platformId)) return;
    this.isLoading = true;
    form.append('auto_create_supplier', 'false');

    this.http.post('/api/admin/documents', form).subscribe({
      next: (doc: any) => {
        this.message = 'Document importé. OCR en cours...';
        this.title = doc?.title || '';
        this.type = doc?.type || '';
        this.direction = doc?.direction || 'unknown';
        this.file = null;
        this.supplierConfirmation = null;
        // Recharge immédiatement la liste
        this.load();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const suggested = err?.suggested_supplier || err?.error?.suggested_supplier;
        if (suggested) {
          this.supplierConfirmation = {
            suggested,
            name: suggested.name || '',
            email: suggested.email || '',
            title: this.title,
            type: this.type,
            direction: this.direction,
            product_id: this.product_id,
            warehouse_id: this.warehouse_id,
            file: this.file
          };
          this.message = 'Fournisseur non trouvé. Confirmez la création.';
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
    const items = (doc?.ocr_lines || []).map((l: any) => ({
      title: l.title,
      reference: l.reference || null,
      quantity: l.quantity,
      direction: doc.direction || 'unknown',
      product_id: l.product_id || null
    }));

    if (items.length === 0) {
      this.error = 'Aucune ligne OCR trouvée. Vérifiez le fichier.';
      return;
    }

    this.isLoading = true;
    this.http.post(`/api/admin/documents/${doc.id}/apply`, { items, auto_create_product: false }).subscribe({
      next: (res: any) => {
        this.message = res?.message || 'Document appliqué au stock.';
        this.error = '';
        this.showEditLines = null;
        setTimeout(() => this.load(), 500);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const suggested = err?.error?.suggested_products || err?.suggested_products || err?.error?.suggested_product || err?.suggested_product;
        if (suggested) {
          const formatted = Array.isArray(suggested) ? suggested : [suggested];
          this.productConfirmation = {
            doc,
            items,
            suggestedProducts: formatted.map((p: any) => ({ ...p, category_id: p.category_id || p.categorie_id || null })),
          };
          this.supplierConfirmation = null;
          this.error = 'Produit(s) inconnu(s) détecté(s). Choisissez une catégorie pour chaque produit.';
          this.loadCategories();
        } else {
          this.error = err?.error?.message || err?.message || 'Erreur lors de l\'application.';
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  confirmProductCreation(): void {
    if (!this.productConfirmation || !Array.isArray(this.productConfirmation.suggestedProducts)) return;

    const required = this.productConfirmation.suggestedProducts;
    for (const prod of required) {
      if (!prod.category_id || Number.isNaN(Number(prod.category_id)) || Number(prod.category_id) <= 0) {
        this.error = 'Veuillez sélectionner une catégorie pour chaque produit inconnu.';
        return;
      }
    }

    const items = this.productConfirmation.items.map((item: any) => {
      const found = required.find((prod: any) => prod.title === item.title && prod.reference === item.reference);
      if (found) {
        return { ...item, category_id: Number(found.category_id), categorie_id: Number(found.category_id) };
      }
      return item;
    });

    this.isLoading = true;
    this.http.post(`/api/admin/documents/${this.productConfirmation.doc.id}/apply`, { items, auto_create_product: true }).subscribe({
      next: (res: any) => {
        this.message = res?.message || 'Document appliqué après creation produit.';
        this.error = '';
        this.productConfirmation = null;
        this.selectedCategoryId = null;
        this.showEditLines = null;
        setTimeout(() => this.load(), 500);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de creation produit.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
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
    if (email) { form.append('supplier_email', email); }
    if (title) { form.append('title', title); }
    if (type) { form.append('type', type); }
    if (direction) { form.append('direction', direction); }
    if (product_id) { form.append('product_id', String(product_id)); }
    if (warehouse_id) { form.append('warehouse_id', String(warehouse_id)); }

    this.isLoading = true;
    this.http.post('/api/admin/documents', form).subscribe({
      next: (doc: any) => {
        this.message = 'Document importé avec le fournisseur confirmé.';
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

  runDiagnostic(doc: any): void {
    if (!doc?.path) {
      this.error = 'Impossible de diagnostiquer: fichier non trouvé.';
      return;
    }

    this.isLoading = true;
    this.http.post('/api/admin/documents/diagnostic', { path: doc.path }).subscribe({
      next: (res: any) => {
        console.log('Diagnostic:', res);
        this.message = `OCR: ${res?.ocr_lines_count || 0} lignes trouvées. Tesseract: ${res?.tesseract_found ? 'OK' : 'NON TROUVÉ'}`;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Erreur lors du diagnostic.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private saveDocumentOcrLines(doc: any): void {
    if (!doc?.id) return;

    this.http.put(`/api/admin/documents/${doc.id}`, { ocr_lines: doc.ocr_lines || [] }).subscribe({
      next: () => {
        this.message = 'Lignes OCR enregistrées.';
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
    const cleanPath = path.replace(/^[/\\]+/, '');
    const url = 'http://localhost:8000/storage/' + cleanPath;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc?.title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
