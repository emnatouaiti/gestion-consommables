import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminWarehouseService {
  private readonly apiBase = '/api/admin';

  constructor(private http: HttpClient) { }

  /* ─── Warehouses ─── */

  listWarehouses(search: string | null = null, perPage = 20, status = 'active'): Observable<any> {
    let params = new HttpParams()
      .set('per_page', perPage.toString())
      .set('status', status);

    if (search) {
      params = params.set('q', search);
    }

    return this.http.get(`${this.apiBase}/warehouses`, { params });
  }

  getWarehouse(id: number): Observable<any> {
    return this.http.get(`${this.apiBase}/warehouses/${id}`);
  }

  createWarehouse(data: any): Observable<any> {
    return this.http.post(`${this.apiBase}/warehouses`, data);
  }

  updateWarehouse(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiBase}/warehouses/${id}`, data);
  }

  deleteWarehouse(id: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/warehouses/${id}`);
  }

  /* ─── Warehouse Rooms ─── */

  listRooms(warehouseId: number | null = null, search: string | null = null, perPage = 20, status = 'active'): Observable<any> {
    let params = new HttpParams()
      .set('per_page', perPage.toString())
      .set('status', status);

    if (warehouseId) {
      params = params.set('warehouse_id', warehouseId.toString());
    }

    if (search) {
      params = params.set('q', search);
    }

    return this.http.get(`${this.apiBase}/warehouse-rooms`, { params });
  }

  getRoom(id: number): Observable<any> {
    return this.http.get(`${this.apiBase}/warehouse-rooms/${id}`);
  }

  createRoom(data: any): Observable<any> {
    return this.http.post(`${this.apiBase}/warehouse-rooms`, data);
  }

  updateRoom(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiBase}/warehouse-rooms/${id}`, data);
  }

  deleteRoom(id: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/warehouse-rooms/${id}`);
  }

  /* ─── Warehouse Locations ─── */

  listLocations(roomId: number | null = null, search: string | null = null, perPage = 20, status = 'active'): Observable<any> {
    let params = new HttpParams()
      .set('per_page', perPage.toString())
      .set('status', status);

    if (roomId) {
      params = params.set('room_id', roomId.toString());
    }

    if (search) {
      params = params.set('q', search);
    }

    return this.http.get(`${this.apiBase}/warehouse-locations`, { params });
  }

  getLocation(id: number): Observable<any> {
    return this.http.get(`${this.apiBase}/warehouse-locations/${id}`);
  }

  createLocation(data: any): Observable<any> {
    return this.http.post(`${this.apiBase}/warehouse-locations`, data);
  }

  updateLocation(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiBase}/warehouse-locations/${id}`, data);
  }

  deleteLocation(id: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/warehouse-locations/${id}`);
  }

  /* ─── Warehouse Products ─── */

  getWarehouseProducts(warehouseId: number): Observable<any> {
    return this.http.get(`${this.apiBase}/warehouses/${warehouseId}/products`);
  }

  getRoomProducts(roomId: number): Observable<any> {
    return this.http.get(`${this.apiBase}/warehouse-rooms/${roomId}/products`);
  }

  /* ─── Warehouse Cabinets (Armoires) ─── */

  listCabinets(roomId: number | null = null, search: string | null = null, perPage = 20, status = 'active'): Observable<any> {
    let params = new HttpParams()
      .set('per_page', perPage.toString())
      .set('status', status);

    if (roomId) {
      params = params.set('room_id', roomId.toString());
    }

    if (search) {
      params = params.set('q', search);
    }

    return this.http.get(`${this.apiBase}/warehouse-cabinets`, { params });
  }

  getCabinet(id: number): Observable<any> {
    return this.http.get(`${this.apiBase}/warehouse-cabinets/${id}`);
  }

  createCabinet(data: any): Observable<any> {
    return this.http.post(`${this.apiBase}/warehouse-cabinets`, data);
  }

  updateCabinet(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiBase}/warehouse-cabinets/${id}`, data);
  }

  deleteCabinet(id: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/warehouse-cabinets/${id}`);
  }

}
