import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AdminWarehouseService } from '../services/admin-warehouse.service';

@Component({
    selector: 'app-products-by-room',
    standalone: false,
    templateUrl: './products-by-room.component.html',
    styleUrls: ['./products-by-room.component.css']
})
export class ProductsByRoomComponent implements OnInit {
    roomId: number | null = null;
    room: any = null;
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
    ) { }

    ngOnInit(): void {
        this.route.paramMap.subscribe(params => {
            this.roomId = Number(params.get('roomId')) || null;
            if (this.roomId) {
                this.loadData();
            }
        });
    }

    private loadData(): void {
        if (!isPlatformBrowser(this.platformId) || !this.roomId) {
            return;
        }
        this.isLoading = true;
        this.errorMessage = '';
        this.warehouseService.getRoomProducts(this.roomId).subscribe({
            next: (res: any) => {
                this.room = res.room || null;
                this.warehouse = res.warehouse || null;
                this.products = Array.isArray(res.products) ? res.products : [];
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.errorMessage = 'Erreur chargement des produits de la salle.';
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    manageProductStocks(product: any): void {
        this.router.navigate(['/admin/produit', product.id, 'stocks']);
    }

    goBack(): void {
        this.router.navigate(['/admin/gerer-depots']);
    }

    getLocationRef(product: any): string {
        const parts = [product.warehouse_name, product.room_name, product.location_code].filter(Boolean);
        return parts.join(', ') || '-';
    }
}
