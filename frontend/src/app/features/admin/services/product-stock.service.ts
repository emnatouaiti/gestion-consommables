import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductStockService {
  private readonly apiBase = '/api/admin';

  constructor(private http: HttpClient) {}

  getProductStocks(productId: number): Observable<any> {
    return this.http.get(`${this.apiBase}/products/${productId}/stocks`);
  }

  getTotalStock(productId: number): Observable<any> {
    return this.http.get(`${this.apiBase}/products/${productId}/total-stock`);
  }

  addStock(productId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiBase}/products/${productId}/stocks`, data);
  }

  updateStock(stockId: number, data: any): Observable<any> {
    return this.http.put(`${this.apiBase}/product-stocks/${stockId}`, data);
  }

  deleteStock(stockId: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/product-stocks/${stockId}`);
  }

  searchStocks(search: string | null = null, perPage = 20): Observable<any> {
    let params = new HttpParams().set('per_page', perPage.toString());

    if (search) {
      params = params.set('q', search);
    }

    return this.http.get(`${this.apiBase}/product-stocks/search`, { params });
  }
}
