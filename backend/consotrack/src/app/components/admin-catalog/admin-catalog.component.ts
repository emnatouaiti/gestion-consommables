import { Component } from '@angular/core';
import {
  Category,
  CategoryPayload,
  InventoryService,
  Product,
  ProductPayload,
} from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-stock',
  templateUrl: './admin-stock.component.html',
  styleUrl: './admin-stock.component.css',
  standalone: false,
})
export class AdminStockComponent {
  apiToken = '';

  categories: Category[] = [];
  products: Product[] = [];

  editingCategoryId: number | null = null;
  editingProductId: number | null = null;

  categoryForm: CategoryPayload = this.emptyCategoryForm();
  productForm: ProductPayload = this.emptyProductForm();

  loading = false;

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly authService: AuthService
  ) {
    this.apiToken = this.authService.getToken();

    if (this.apiToken) {
      this.inventoryService.setToken(this.apiToken);
      this.loadData();
    }
  }

  saveToken(): void {
    this.authService.setToken(this.apiToken);
    this.inventoryService.setToken(this.apiToken);
    this.loadData();
  }

  loadData(): void {
    this.loading = true;

    this.inventoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loadProducts();
      },
      error: () => {
        this.loading = false;
        alert('Erreur de chargement des categories. Verifiez le token admin.');
      },
    });
  }

  private loadProducts(): void {
    this.inventoryService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        alert('Erreur de chargement des produits.');
      },
    });
  }

  saveCategory(): void {
    const payload: CategoryPayload = {
      title: this.categoryForm.title.trim(),
      description: this.categoryForm.description.trim(),
      status: this.categoryForm.status,
    };

    if (!payload.title) {
      alert('Le titre de la categorie est obligatoire.');
      return;
    }

    if (this.editingCategoryId) {
      this.inventoryService.updateCategory(this.editingCategoryId, payload).subscribe({
        next: () => {
          this.resetCategoryForm();
          this.loadData();
        },
        error: () => alert('Impossible de modifier la categorie.'),
      });
      return;
    }

    this.inventoryService.createCategory(payload).subscribe({
      next: () => {
        this.resetCategoryForm();
        this.loadData();
      },
      error: () => alert('Impossible de creer la categorie.'),
    });
  }

  editCategory(category: Category): void {
    this.editingCategoryId = category.id;
    this.categoryForm = {
      title: category.title,
      description: category.description ?? '',
      status: category.status,
    };
  }

  deleteCategory(id: number): void {
    if (!confirm('Supprimer cette categorie ?')) {
      return;
    }

    this.inventoryService.deleteCategory(id).subscribe({
      next: () => this.loadData(),
      error: () => alert('Suppression impossible (categorie liee a des produits ou erreur API).'),
    });
  }

  resetCategoryForm(): void {
    this.editingCategoryId = null;
    this.categoryForm = this.emptyCategoryForm();
  }

  saveProduct(): void {
    if (!this.productForm.categorie_id) {
      alert('Selectionnez une categorie.');
      return;
    }

    const payload: ProductPayload = {
      status: this.productForm.status,
      title: this.productForm.title.trim(),
      description: this.productForm.description.trim(),
      seuil_min: Number(this.productForm.seuil_min),
      reference: this.productForm.reference.trim(),
      categorie_id: Number(this.productForm.categorie_id),
      stock_quantity: Number(this.productForm.stock_quantity),
      purchase_price:
        this.productForm.purchase_price === null || this.productForm.purchase_price === undefined
          ? null
          : Number(this.productForm.purchase_price),
      sale_price:
        this.productForm.sale_price === null || this.productForm.sale_price === undefined
          ? null
          : Number(this.productForm.sale_price),
      unit: this.productForm.unit.trim(),
      location: this.productForm.location.trim(),
    };

    if (!payload.title || !payload.reference) {
      alert('Titre et reference sont obligatoires.');
      return;
    }

    if (this.editingProductId) {
      this.inventoryService.updateProduct(this.editingProductId, payload).subscribe({
        next: () => {
          this.resetProductForm();
          this.loadData();
        },
        error: () => alert('Impossible de modifier le produit.'),
      });
      return;
    }

    this.inventoryService.createProduct(payload).subscribe({
      next: () => {
        this.resetProductForm();
        this.loadData();
      },
      error: () => alert('Impossible de creer le produit.'),
    });
  }

  editProduct(product: Product): void {
    this.editingProductId = product.id;
    this.productForm = {
      status: product.status,
      title: product.title,
      description: product.description ?? '',
      seuil_min: product.seuil_min,
      reference: product.reference,
      categorie_id: product.categorie_id,
      stock_quantity: product.stock_quantity,
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      unit: product.unit ?? '',
      location: product.location ?? '',
    };
  }

  deleteProduct(id: number): void {
    if (!confirm('Supprimer ce produit ?')) {
      return;
    }

    this.inventoryService.deleteProduct(id).subscribe({
      next: () => this.loadData(),
      error: () => alert('Impossible de supprimer le produit.'),
    });
  }

  downloadBarcode(product: Product): void {
    this.inventoryService.downloadBarcode(product.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `barcode-${product.id}.svg`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => alert('Impossible de telecharger le code-barres.'),
    });
  }

  resetProductForm(): void {
    this.editingProductId = null;
    this.productForm = this.emptyProductForm();
  }

  private emptyCategoryForm(): CategoryPayload {
    return {
      title: '',
      description: '',
      status: 'active',
    };
  }

  private emptyProductForm(): ProductPayload {
    return {
      status: 'active',
      title: '',
      description: '',
      seuil_min: 0,
      reference: '',
      categorie_id: 0,
      stock_quantity: 0,
      purchase_price: null,
      sale_price: null,
      unit: '',
      location: '',
    };
  }
}
