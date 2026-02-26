import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminStockComponent } from './components/admin-stock/admin-stock.component';
import { UnauthorizedComponent } from './components/unauthorized/unauthorized.component';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';

@NgModule({
  declarations: [
    App,
    AdminStockComponent,
    UnauthorizedComponent,
    AdminLayoutComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, HttpClientModule],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
