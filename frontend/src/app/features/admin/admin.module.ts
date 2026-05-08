import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminRoutingModule } from './admin-routing.module';
import { UsersListComponent } from './users-list/users-list.component';
import { AdminLayoutComponent } from './admin-layout.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserFormComponent } from './user-form/user-form.component';
import { ProfileComponent } from './profile/profile';
import { ArchivedUsersComponent } from './archived-users/archived-users.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { AdminRolePageComponent } from './admin-role-page/admin-role-page.component';
import { CategoriesComponent } from './categories/categories.component';
import { ProductsComponent } from './products/products.component';
import { WarehousesComponent } from './warehouses/warehouses.component';
import { FabricantsComponent } from './fabricants/fabricants.component';
import { MarquesComponent } from './marques/marques.component';
import { ModelesComponent } from './modeles/modeles.component';
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
import { AuditLogsComponent } from './audit-logs/audit-logs.component';
import { DocumentsComponent } from './documents/documents.component';
import { ChatComponent } from './chat/chat.component';
import { ThreadWidgetComponent } from './chat/thread-widget.component';
import { MiniThreadsComponent } from './chat/mini-threads.component';
import { ProductBatchLifecycleComponent } from './components/product-batch-lifecycle/product-batch-lifecycle.component';
import { StockFormComponent } from './components/stock-form/stock-form.component';
import { Storage3dViewerComponent } from './components/storage-3d-viewer/storage-3d-viewer.component';

@NgModule({
  declarations: [
    UsersListComponent,
    AdminLayoutComponent,
    UserFormComponent,
    ProfileComponent,
    ArchivedUsersComponent,
    DashboardComponent,
    AdminRolePageComponent,
    CategoriesComponent,
    ProductsComponent,
    WarehousesComponent,
    ProductStocksComponent,
    ProductsByLocationComponent,
    ProductsByCabinetComponent,
    ProductsByWarehouseComponent,
    ProductsByRoomComponent,
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    FabricantsComponent,
    MarquesComponent,
    ModelesComponent,
    ProductBatchLifecycleComponent,
    StockFormComponent,
    ReferencesComponent,
    SuppliersComponent,
    UnitsComponent,
    StockMovementsComponent,
    ConsumableRequestComponent,
    AuditLogsComponent,
    DocumentsComponent,
    ChatComponent,
    ThreadWidgetComponent,
    MiniThreadsComponent,
    Storage3dViewerComponent
  ],
  providers: [
    // empty on purpose; keeps module extensible
  ]
})
export class AdminModule { }
