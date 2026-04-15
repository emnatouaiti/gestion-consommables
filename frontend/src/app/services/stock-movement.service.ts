import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../core/services/api.service';
import { HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class StockMovementService {
  private readonly apiPath = 'stock-movements';

  constructor(private api: ApiService) {}

  list(query?: {
    page?: number;
    per_page?: number;
    status?: string;
    movement_type?: string;
    reference?: string;
    product_id?: number;
    date_from?: string;
    date_to?: string;
  }): Observable<any> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params = params.set(key, String(value));
      });
    }
    return this.api.get(this.apiPath, params);
  }

  show(id: number): Observable<any> {
    return this.api.get(`${this.apiPath}/${id}`);
  }

  create(payload: any): Observable<any> {
    // If this is an entry movement, ask the API to create missing warehouse product records.
    try {
      const type = payload?.movement_type || payload?.type || '';
      if (String(type).toLowerCase() === 'entry') {
        payload.create_if_missing = true;
      }
    } catch (e) {
      // ignore
    }
    return this.api.post(this.apiPath, payload);
  }

  update(id: number, payload: any): Observable<any> {
    return this.api.put(`${this.apiPath}/${id}`, payload);
  }

  destroy(id: number): Observable<any> {
    return this.api.delete(`${this.apiPath}/${id}`);
  }

  validate(id: number): Observable<any> {
    return this.api.put(`${this.apiPath}/${id}/validate`, {});
  }

  cancel(id: number, reason?: string): Observable<any> {
    return this.api.put(`${this.apiPath}/${id}/cancel`, { reason });
  }

  getProducts(): Observable<any> {
    return this.api.get('products/request-list');
  }
}
