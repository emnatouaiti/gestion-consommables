import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminCatalogComponent } from './components/admin-catalog/admin-catalog.component';
import { UnauthorizedComponent } from './components/unauthorized/unauthorized.component';
import { AdminGuard } from './guards/admin.guard';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';

const routes: Routes = [
  { path: '', redirectTo: 'admin/catalog', pathMatch: 'full' },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AdminGuard],
    children: [
      { path: '', redirectTo: 'catalog', pathMatch: 'full' },
      { path: 'catalog', component: AdminCatalogComponent },
    ],
  },
  { path: 'unauthorized', component: UnauthorizedComponent },
  { path: '**', redirectTo: 'admin/catalog' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
