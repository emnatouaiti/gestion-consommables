import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AdminStockService } from '../../../core/services/admin-stock.service';
import { AdminWarehouseService } from '../../../core/services/admin-warehouse.service';

@Component({
  selector: 'app-products-by-cabinet',
  standalone: false,
  templateUrl: './products-by-cabinet.component.html',
  styleUrls: ['./products-by-cabinet.component.css']
})
export class ProductsByCabinetComponent implements OnInit {
  cabinetId: number | null = null;
  cabinet: any = null;
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
      this.cabinetId = Number(params.get('cabinetId')) || null;
      if (this.cabinetId) {
        this.loadCabinet();
        this.loadProducts();
      }
    });
  }

  private loadCabinet(): void {
    if (!isPlatformBrowser(this.platformId) || !this.cabinetId) {
      return;
    }
    this.warehouseService.getCabinet(this.cabinetId).subscribe({
      next: (res: any) => {
        this.cabinet = res.data || res;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.errorMessage = 'Erreur chargement armoire.';
      }
    });
  }

  private loadProducts(): void {
    if (!isPlatformBrowser(this.platformId) || !this.cabinetId) {
      return;
    }
    this.isLoading = true;
    this.stockService.getProductsByCabinet(this.cabinetId).subscribe({
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
    this.router.navigate(['/gerer-depots']);
  }

  manageProductStocks(product: any): void {
    this.router.navigate(['/produit', product.id, 'stocks']);
  }
}
