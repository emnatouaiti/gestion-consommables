import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsersListComponent } from './users-list/users-list.component';
import { AdminLayoutComponent } from './admin-layout.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';
import { ProfileComponent } from './profile/profile';
import { ArchivedUsersComponent } from './archived-users/archived-users.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { AdminRolePageComponent } from './admin-role-page/admin-role-page.component';
import { CategoriesComponent } from './categories/categories.component';
import { ProductsComponent } from './products/products.component';
import { WarehousesComponent } from './warehouses/warehouses.component';
import { ReferencesComponent } from './references/references.component';
import { ProductStocksComponent } from './product-stocks/product-stocks.component';
import { ProductsByLocationComponent } from './products-by-location/products-by-location.component';
import { ProductsByCabinetComponent } from './products-by-cabinet/products-by-cabinet.component';
import { ProductsByWarehouseComponent } from './products-by-warehouse/products-by-warehouse.component';
import { ProductsByRoomComponent } from './products-by-room/products-by-room.component';
import { SuppliersComponent } from './suppliers/suppliers.component';
import { UnitsComponent } from './units/units.component';
import { StockMovementsComponent } from './stock-movements/stock-movements.component';
import { ConsumableRequestComponent } from '../../consumable-request/consumable-request';
import { DocumentsComponent } from './documents/documents.component';
import { ChatComponent } from './chat/chat.component';

const adminRoles = ['Administrateur'];
const directorRoles = ['Directeur'];
const managerRoles = ['Responsable de stock', 'Responsable', 'Gestionnaire'];
const agentRoles = ['Agent de stock', 'Agent'];
const userRoles = ['Utilisateur', 'Employé', 'Directeur'];

const adminAndDirector = [...adminRoles, ...directorRoles];
const managerAndAgent = [...managerRoles, ...agentRoles, ...directorRoles];
const directorAndManager = [...directorRoles, ...managerRoles];
const adminAndManagerAndAgent = [...adminRoles, ...managerRoles, ...agentRoles, ...directorRoles];

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      // 1. Dashboard & General
      { path: '', component: AdminRolePageComponent, data: { view: 'welcome' } },
      { path: 'dashboard', component: DashboardComponent, canActivate: [RoleGuard], data: { roles: adminAndDirector } },
      { path: 'profile', component: ProfileComponent },

      // 2. User Management
      { path: 'users', component: UsersListComponent, canActivate: [RoleGuard], data: { roles: adminAndDirector } },
      { path: 'archived', component: ArchivedUsersComponent, canActivate: [RoleGuard], data: { roles: adminAndDirector } },

      // 3. Catalogue & Configuration
      { path: 'gerer-categories', component: CategoriesComponent, canActivate: [RoleGuard], data: { roles: managerRoles } },
      { path: 'gerer-references', component: ReferencesComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'gerer-unites', component: UnitsComponent, canActivate: [RoleGuard], data: { roles: managerRoles } },
      { path: 'gerer-fournisseurs', component: SuppliersComponent, canActivate: [RoleGuard], data: { roles: adminAndManagerAndAgent } },

      // 4. Warehouse & Stock Locations
      { path: 'gerer-depots', component: WarehousesComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'gerer-locaux', component: WarehousesComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },

      // 5. Products & Inventory
      { path: 'gerer-produits', component: ProductsComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'produit/:productId/stocks', component: ProductStocksComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'location/:locationId/products', component: ProductsByLocationComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'cabinet/:cabinetId/products', component: ProductsByCabinetComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'room/:roomId/products', component: ProductsByRoomComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'warehouse/:warehouseId/products', component: ProductsByWarehouseComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },

      // 6. Operations & Requests
      { path: 'demandes-consommables', component: ConsumableRequestComponent, canActivate: [RoleGuard], data: { roles: userRoles, mode: 'request' } },
      { path: 'validation-demandes', component: ConsumableRequestComponent, canActivate: [RoleGuard], data: { roles: directorAndManager, mode: 'validation' } },
      { path: 'mouvements-stock', component: StockMovementsComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },
      { path: 'validation-mouvements', component: StockMovementsComponent, canActivate: [RoleGuard], data: { roles: managerRoles, mode: 'validation' } },
      { path: 'documents-ocr', component: DocumentsComponent, canActivate: [RoleGuard], data: { roles: managerAndAgent } },

      // 7. Communication & AI
      { path: 'chat', component: ChatComponent },
      { path: 'previsions', component: AdminRolePageComponent, canActivate: [RoleGuard], data: { roles: directorRoles, view: 'previsions' } },
      { path: 'anomalies-critiques', component: AdminRolePageComponent, canActivate: [RoleGuard], data: { roles: directorRoles, view: 'anomalies' } },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
