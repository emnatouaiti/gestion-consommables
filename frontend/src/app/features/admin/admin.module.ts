import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminRoutingModule } from './admin-routing.module';
import { UsersListComponent } from './users-list/users-list.component';
import { AdminLayoutComponent } from './admin-layout.component';
import { AdminUsersService } from './services/admin-users.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProfileComponent } from './profile/profile';
import { ArchivedUsersComponent } from './archived-users/archived-users.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { UserDashboardComponent } from '../dashboard/user-dashboard.component';
import { AdminRolePageComponent } from './admin-role-page/admin-role-page.component';
import { CategoriesComponent } from './categories/categories.component';
import { ProductsComponent } from './products/products.component';
import { WarehousesComponent } from './warehouses/warehouses.component';
import { ReferencesComponent } from './references/references.component';
import { ProductStocksComponent } from './product-stocks/product-stocks.component';
import { ProductsByLocationComponent } from './products-by-location/products-by-location.component';
import { ProductsByWarehouseComponent } from './products-by-warehouse/products-by-warehouse.component';
import { ProductsByRoomComponent } from './products-by-room/products-by-room.component';
import { ProductsByCabinetComponent } from './products-by-cabinet/products-by-cabinet.component';
import { SuppliersComponent } from './suppliers/suppliers.component';
import { UnitsComponent } from './units/units.component';
import { StockMovementsComponent } from './stock-movements/stock-movements.component';
import { ConsumableRequestComponent } from '../../consumable-request/consumable-request';
import { DocumentsComponent } from './documents/documents.component';
import { ChatComponent } from './chat/chat.component';
import { ThreadWidgetComponent } from './chat/thread-widget.component';
import { MiniThreadsComponent } from './chat/mini-threads.component';
import { ProductBatchLifecycleComponent } from './components/product-batch-lifecycle/product-batch-lifecycle.component';
import { StockFormComponent } from './components/stock-form/stock-form.component';
import { Storage3dViewerComponent } from './components/storage-3d-viewer/storage-3d-viewer.component';

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
    AdminRoutingModule,
    ChatComponent,
    CommonModule,
    ConsumableRequestComponent,
    DocumentsComponent,
    FormsModule,
    MiniThreadsComponent,
    ProductBatchLifecycleComponent,
    ReactiveFormsModule,
    ReferencesComponent,
    RouterModule,
    StockFormComponent,
    StockMovementsComponent,
    Storage3dViewerComponent,
    SuppliersComponent,
    ThreadWidgetComponent,
    UnitsComponent,
    UserDashboardComponent,
  ],
  providers: [
    // empty on purpose; keeps module extensible
  ]
})
export class AdminModule { }
