import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class UnitService {
  constructor(private api: ApiService) {}

  list(): Observable<any[]> {
    return this.api.get('admin/units');
  }

  create(payload: any): Observable<any> {
    return this.api.post('admin/units', payload);
  }

  update(id: number, payload: any): Observable<any> {
    return this.api.put(`admin/units/${id}`, payload);
  }

  delete(id: number): Observable<any> {
    return this.api.delete(`admin/units/${id}`);
  }
}
