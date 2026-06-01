import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class UnitService {
  constructor(private api: ApiService) {}

  list(): Observable<any[]> {
    return this.api.get('units');
  }

  create(payload: any): Observable<any> {
    return this.api.post('units', payload);
  }

  update(id: number, payload: any): Observable<any> {
    return this.api.put(`units/${id}`, payload);
  }

  delete(id: number): Observable<any> {
    return this.api.delete(`units/${id}`);
  }
}

