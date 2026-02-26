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
import { ProductStocksComponent } from './product-stocks/product-stocks.component';
import { ProductsByLocationComponent } from './products-by-location/products-by-location.component';
import { ProductsByWarehouseComponent } from './products-by-warehouse/products-by-warehouse.component';
import { ProductsByRoomComponent } from './products-by-room/products-by-room.component';
import { SuppliersComponent } from './suppliers/suppliers.component';
import { UnitsComponent } from './units/units.component';

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
    ProductsByWarehouseComponent,
    ProductsByRoomComponent,
  ],
  imports: [CommonModule, AdminRoutingModule, ReactiveFormsModule, FormsModule, RouterModule, SuppliersComponent, UnitsComponent]
})
export class AdminModule { }
