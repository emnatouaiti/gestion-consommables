import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsersListComponent } from './users-list/users-list.component';
import { UserFormComponent } from './user-form/user-form.component';
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
import { ProductStocksComponent } from './product-stocks/product-stocks.component';
import { ProductsByLocationComponent } from './products-by-location/products-by-location.component';
import { ProductsByWarehouseComponent } from './products-by-warehouse/products-by-warehouse.component';
import { ProductsByRoomComponent } from './products-by-room/products-by-room.component';
import { SuppliersComponent } from './suppliers/suppliers.component';
import { UnitsComponent } from './units/units.component';

const adminRoles = ['Administrateur'];
const directorRoles = ['Directeur', 'Validateur'];
const agentManagerRoles = ['Agent', 'Responsable', 'Gestionnaire'];
const userRoles = ['Utilisateur'];

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        component: AdminRolePageComponent,
        data: { view: 'welcome' }
      },

      { path: 'dashboard', component: DashboardComponent },
      { path: 'profile', component: ProfileComponent },

      { path: 'users', component: UsersListComponent, canActivate: [RoleGuard], data: { roles: adminRoles } },
      { path: 'create', component: UserFormComponent, canActivate: [RoleGuard], data: { roles: adminRoles } },
      { path: 'archived', component: ArchivedUsersComponent, canActivate: [RoleGuard], data: { roles: adminRoles } },

      {
        path: 'validation-demandes',
        component: AdminRolePageComponent,
        canActivate: [RoleGuard],
        data: { roles: directorRoles, view: 'validation' }
      },
      {
        path: 'anomalies-critiques',
        component: AdminRolePageComponent,
        canActivate: [RoleGuard],
        data: { roles: directorRoles, view: 'anomalies' }
      },
      {
        path: 'previsions',
        component: AdminRolePageComponent,
        canActivate: [RoleGuard],
        data: { roles: directorRoles, view: 'previsions' }
      },

      {
        path: 'gerer-categories',
        component: CategoriesComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },
      {
        path: 'gerer-produits',
        component: ProductsComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },

      {
        path: 'gerer-depots',
        component: WarehousesComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },

      {
        path: 'produit/:productId/stocks',
        component: ProductStocksComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },

      {
        path: 'location/:locationId/products',
        component: ProductsByLocationComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },

      {
        path: 'room/:roomId/products',
        component: ProductsByRoomComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },

      {
        path: 'warehouse/:warehouseId/products',
        component: ProductsByWarehouseComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },

      {
        path: 'gerer-fournisseurs',
        component: SuppliersComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },
      {
        path: 'gerer-unites',
        component: UnitsComponent,
        canActivate: [RoleGuard],
        data: { roles: adminRoles }
      },

      {
        path: 'mes-demandes',
        component: AdminRolePageComponent,
        canActivate: [RoleGuard],
        data: { roles: userRoles, view: 'demandes' }
      },

      // Keep this dynamic route last to avoid matching static admin paths (ex: gerer-categories).
      { path: ':id', component: UserFormComponent, canActivate: [RoleGuard], data: { roles: adminRoles } }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
