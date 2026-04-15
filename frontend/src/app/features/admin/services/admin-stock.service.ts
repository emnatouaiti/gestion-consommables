import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class AdminStockService {
  private readonly apiBase = '/api';

  constructor(
    private readonly api: ApiService,
    private readonly http: HttpClient
  ) { }

  /* ─── Categories ─── */

  listCategories(params?: { tree?: boolean; status?: string; q?: string }): Observable<any[]> {
    let path = 'admin/categories';
    const query: string[] = [];

    if (params?.tree) query.push('tree=1');
    if (params?.status && params.status !== 'all') query.push(`status=${encodeURIComponent(params.status)}`);
    if (params?.q) query.push(`q=${encodeURIComponent(params.q)}`);

    if (query.length) {
      path += `?${query.join('&')}`;
    }

    return this.api.get(path);
  }

  createCategory(payload: any): Observable<any> {
    return this.api.post('admin/categories', payload);
  }

  updateCategory(id: number, payload: any): Observable<any> {
    return this.api.put(`admin/categories/${id}`, payload);
  }

  deleteCategory(id: number): Observable<any> {
    return this.api.delete(`admin/categories/${id}`);
  }

  /* ─── Products ─── */

  listProducts(params?: {
    q?: string;
    status?: string;
    categorie_id?: number | null;
    supplier_id?: number | null;
    low_stock_only?: boolean;
    out_of_stock_only?: boolean;
    page?: number;
    per_page?: number;
  }): Observable<any> {
    let path = 'admin/products';
    const query: string[] = [];

    if (params?.q) query.push(`q=${encodeURIComponent(params.q)}`);
    if (params?.status && params.status !== 'all') query.push(`status=${encodeURIComponent(params.status)}`);
    if (params?.categorie_id) query.push(`categorie_id=${encodeURIComponent(String(params.categorie_id))}`);
    if (params?.supplier_id) query.push(`supplier_id=${encodeURIComponent(String(params.supplier_id))}`);
    if (params?.low_stock_only) query.push('low_stock_only=1');
    if (params?.out_of_stock_only) query.push('out_of_stock_only=1');
    if (params?.page) query.push(`page=${encodeURIComponent(String(params.page))}`);
    if (params?.per_page) query.push(`per_page=${encodeURIComponent(String(params.per_page))}`);

    if (query.length) {
      path += `?${query.join('&')}`;
    }

    return this.api.get(path);
  }

  productsOverview(): Observable<any> {
    return this.api.get('admin/products-overview');
  }

  createProduct(payload: any): Observable<any> {
    return this.api.post('admin/products', this.toFormData(payload));
  }

  updateProduct(id: number, payload: any): Observable<any> {
    const formData = this.toFormData(payload);
    formData.append('_method', 'PUT');
    return this.api.post(`admin/products/${id}`, formData);
  }

  deleteProduct(id: number): Observable<any> {
    return this.api.delete(`admin/products/${id}`);
  }

  downloadBarcode(productId: number): Observable<Blob> {
    return this.http.get(`${this.apiBase}/admin/products/${productId}/barcode`, {
      responseType: 'blob'
    });
  }

  getProduct(productId: number): Observable<any> {
    return this.api.get(`admin/products/${productId}`);
  }

  getProductsByLocation(locationId: number): Observable<any> {
    return this.api.get(`admin/warehouse-locations/${locationId}/products`);
  }

  getDashboardStats(): Observable<any> {
    return this.api.get('admin/dashboard');
  }

  getRecommendations(): Observable<any> {
    return this.api.get('admin/recommendations');
  }

  downloadReport(type: 'stock' | 'movements'): Observable<Blob> {
    return this.http.get(`${this.apiBase}/admin/reports/${type}`, {
      responseType: 'blob'
    });
  }

  private toFormData(payload: any): FormData {
    const formData = new FormData();

    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      if (value instanceof File) {
        formData.append(key, value);
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item instanceof File) {
            formData.append(`${key}[]`, item);
          } else {
            formData.append(`${key}[]`, String(item));
          }
        });
        return;
      }

      formData.append(key, String(value));
    });

    return formData;
  }
}
