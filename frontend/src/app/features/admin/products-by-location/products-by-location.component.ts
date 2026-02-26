import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AdminStockService } from '../services/admin-stock.service';
import { AdminWarehouseService } from '../services/admin-warehouse.service';

@Component({
  selector: 'app-products-by-location',
  standalone: false,
  templateUrl: './products-by-location.component.html',
  styleUrls: ['./products-by-location.component.css']
})
export class ProductsByLocationComponent implements OnInit {
  locationId: number | null = null;
  location: any = null;
  products: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly stockService: AdminStockService,
    private readonly warehouseService: AdminWarehouseService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.locationId = Number(params.get('locationId')) || null;
      if (this.locationId) {
        this.loadLocation();
        this.loadProducts();
      }
    });
  }

  private loadLocation(): void {
    if (!isPlatformBrowser(this.platformId) || !this.locationId) {
      return;
    }
    this.warehouseService.getLocation(this.locationId).subscribe({
      next: (res: any) => {
        this.location = res.data || res;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = 'Erreur chargement emplacement.';
      }
    });
  }

  private loadProducts(): void {
    if (!isPlatformBrowser(this.platformId) || !this.locationId) {
      return;
    }
    this.isLoading = true;
    this.stockService.getProductsByLocation(this.locationId).subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
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
    this.router.navigate(['/admin/produits']);
  }

  manageProductStocks(product: any): void {
    this.router.navigate(['/admin/produit', product.id, 'stocks']);
  }
}
