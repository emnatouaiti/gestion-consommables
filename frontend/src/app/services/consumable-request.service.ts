import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../core/services/api.service';

@Injectable({
  providedIn: 'root',
})
export class ConsumableRequestService {
  private readonly apiPath = 'consumable-requests';
  private readonly productsApiPath = 'products/request-list';

  constructor(private apiService: ApiService) {}

  getRequests(): Observable<any> {
    return this.apiService.get(this.apiPath);
  }

  getProducts(): Observable<any> {
    return this.apiService.get(this.productsApiPath);
  }

  createRequest(data: any): Observable<any> {
    return this.apiService.post(this.apiPath, data);
  }

  updateRequest(id: number, data: any): Observable<any> {
    return this.apiService.put(`${this.apiPath}/${id}`, data);
  }

  deleteRequest(id: number): Observable<any> {
    return this.apiService.delete(`${this.apiPath}/${id}`);
  }

  approveRequest(id: number, approvedQuantity?: number): Observable<any> {
    const payload = approvedQuantity !== undefined ? { approved_quantity: approvedQuantity } : {};
    return this.apiService.put(`${this.apiPath}/${id}/approve`, payload);
  }

  rejectRequest(id: number, reason?: string): Observable<any> {
    return this.apiService.put(`${this.apiPath}/${id}/reject`, { reason });
  }

  confirmExit(id: number, data: any): Observable<any> {
    return this.apiService.put(`${this.apiPath}/${id}/confirm-exit`, data);
  }

  getProductStocks(productId: number): Observable<any> {
    return this.apiService.get(`admin/products/${productId}/stocks`);
  }
}
