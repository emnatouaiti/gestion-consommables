import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AdminRoutingModule } from './admin-routing.module';

// Standalone components (imported so declared components can use them in templates)
import { ChatComponent } from './chat/chat.component';
import { DocumentsComponent } from './ocr/upload-document/documents.component';
import { SuppliersComponent } from './suppliers/suppliers.component';
import { Storage3dViewerComponent } from '../features/shared-components/storage-3d-viewer/storage-3d-viewer.component';
import { MiniThreadsComponent } from './chat/mini-threads.component';
import { ThreadWidgetComponent } from './chat/thread-widget.component';
import { StockMovementsComponent } from './mouvements/list-mouvement/stock-movements.component';
import { UnitsComponent } from './units/units.component';
import { ReferencesComponent } from './references/references.component';
import { UserDashboardComponent } from './dashboard/user-dashboard.component';

// Shared standalone components

// Non-standalone (declared) components
import { AdminLayoutComponent } from './admin-layout.component';
import { UsersListComponent } from './utilisateurs/list-users/users-list.component';
import { ProfileComponent } from './profile/profile';
import { ArchivedUsersComponent } from './utilisateurs/archived-users/archived-users.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AdminRolePageComponent } from './admin-role-page/admin-role-page.component';
import { CategoriesComponent } from './categories/categories.component';
import { ProductsComponent } from './produits/list-produit/products.component';
import { WarehousesComponent } from './warehouses/warehouses.component';
import { ProductStocksComponent } from './produits/product-stocks/product-stocks.component';
import { ProductsByLocationComponent } from './produits/products-by-location/products-by-location.component';
import { ProductsByWarehouseComponent } from './produits/products-by-warehouse/products-by-warehouse.component';
import { ProductsByRoomComponent } from './produits/products-by-room/products-by-room.component';
import { ProductsByCabinetComponent } from './produits/products-by-cabinet/products-by-cabinet.component';

@NgModule({
  declarations: [
    AdminLayoutComponent,
    AdminRolePageComponent,
    ArchivedUsersComponent,
    CategoriesComponent,
    DashboardComponent,
    ProfileComponent,
    ProductsByCabinetComponent,
    ProductsByLocationComponent,
    ProductsByRoomComponent,
    ProductsByWarehouseComponent,
    ProductsComponent,
    ProductStocksComponent,
    UsersListComponent,
    WarehousesComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AdminRoutingModule,

    // Standalone components and shared standalone
    ChatComponent,
    DocumentsComponent,
    SuppliersComponent,
    MiniThreadsComponent,
    ThreadWidgetComponent,
    StockMovementsComponent,
    UnitsComponent,
    ReferencesComponent,
    UserDashboardComponent,
    // Shared UI
    Storage3dViewerComponent,
    // Shared UI components omitted here to avoid cross-folder service imports
  ],
  providers: []
})
export class AdminModule { }

