import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { AuthGuard } from './core/guards/auth.guard';

import { GoogleCallbackComponent } from './features/auth/google-callback/google-callback.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: GoogleCallbackComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  { path: 'admin', canActivate: [AuthGuard], loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule) },
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  { path: '**', redirectTo: 'admin' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
