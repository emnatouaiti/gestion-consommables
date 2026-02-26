import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AdminWarehouseService } from '../services/admin-warehouse.service';

@Component({
  selector: 'app-products-by-warehouse',
  standalone: false,
  templateUrl: './products-by-warehouse.component.html',
  styleUrls: ['./products-by-warehouse.component.css']
})
export class ProductsByWarehouseComponent implements OnInit {
  warehouseId: number | null = null;
  warehouse: any = null;
  products: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly warehouseService: AdminWarehouseService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.warehouseId = Number(params.get('warehouseId')) || null;
      if (this.warehouseId) {
        this.loadWarehouse();
        this.loadProducts();
      }
    });
  }

  private loadWarehouse(): void {
    if (!isPlatformBrowser(this.platformId) || !this.warehouseId) {
      return;
    }
    this.warehouseService.getWarehouse(this.warehouseId).subscribe({
      next: (res: any) => {
        this.warehouse = res.data || res;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = 'Erreur chargement dépôt.';
      }
    });
  }

  private loadProducts(): void {
    if (!isPlatformBrowser(this.platformId) || !this.warehouseId) {
      return;
    }
    this.isLoading = true;
    this.warehouseService.getWarehouseProducts(this.warehouseId).subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res) ? res : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = 'Erreur chargement produits.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/gerer-depots']);
  }

  manageProductStocks(product: any): void {
    this.router.navigate(['/admin/produit', product.id, 'stocks']);
  }

  getLocationRef(product: any): string {
    if (!product.location_id) return '-';
    return `${product.room_name || 'Salle'} > ${product.location_code || 'Emp.'}`;
  }
}
