import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
  id: number;
  title: string;
  description: string | null;
  status: 'active' | 'inactive';
}

export interface Product {
  id: number;
  status: 'active' | 'inactive';
  title: string;
  description: string | null;
  seuil_min: number;
  reference: string;
  categorie_id: number;
  stock_quantity: number;
  purchase_price: number | null;
  sale_price: number | null;
  unit: string | null;
  location: string | null;
  barcode_value: string | null;
  category?: { id: number; title: string };
}

export interface CategoryPayload {
  title: string;
  description: string;
  status: 'active' | 'inactive';
}

export interface ProductPayload {
  status: 'active' | 'inactive';
  title: string;
  description: string;
  seuil_min: number;
  reference: string;
  categorie_id: number;
  stock_quantity: number;
  purchase_price: number | null;
  sale_price: number | null;
  unit: string;
  location: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiBase = 'http://127.0.0.1:8000/api/admin';
  private token = localStorage.getItem('token') ?? '';

  constructor(private readonly http: HttpClient) {}

  setToken(token: string): void {
    this.token = token.trim();
    localStorage.setItem('token', this.token);
  }

  private headers(): HttpHeaders {
    const currentToken = this.token || (localStorage.getItem('token') ?? '');
    return new HttpHeaders({
      Authorization: `Bearer ${currentToken}`,
      Accept: 'application/json',
    });
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiBase}/categories`, { headers: this.headers() });
  }

  createCategory(payload: CategoryPayload): Observable<{ message: string; category: Category }> {
    return this.http.post<{ message: string; category: Category }>(`${this.apiBase}/categories`, payload, {
      headers: this.headers(),
    });
  }

  updateCategory(id: number, payload: CategoryPayload): Observable<{ message: string; category: Category }> {
    return this.http.put<{ message: string; category: Category }>(`${this.apiBase}/categories/${id}`, payload, {
      headers: this.headers(),
    });
  }

  deleteCategory(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBase}/categories/${id}`, {
      headers: this.headers(),
    });
  }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiBase}/products`, { headers: this.headers() });
  }

  createProduct(payload: ProductPayload): Observable<{ message: string; product: Product }> {
    return this.http.post<{ message: string; product: Product }>(`${this.apiBase}/products`, payload, {
      headers: this.headers(),
    });
  }

  updateProduct(id: number, payload: ProductPayload): Observable<{ message: string; product: Product }> {
    return this.http.put<{ message: string; product: Product }>(`${this.apiBase}/products/${id}`, payload, {
      headers: this.headers(),
    });
  }

  deleteProduct(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBase}/products/${id}`, {
      headers: this.headers(),
    });
  }

  downloadBarcode(id: number): Observable<Blob> {
    return this.http.get(`${this.apiBase}/products/${id}/barcode`, {
      headers: this.headers(),
      responseType: 'blob',
    });
  }
}
