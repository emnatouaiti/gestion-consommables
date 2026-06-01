import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  constructor(private api: ApiService) {}

  listUsers(params?: any) { return this.api.get('users'); }
  listAll() { const params = new HttpParams().set('per_page', '10000'); return this.api.get('users', params); }
  getUser(id: number) { return this.api.get(`users/${id}`); }
  createUser(payload: any) { return this.api.post('users', payload); }
  updateUser(id: number, payload: any) { return this.api.put(`users/${id}`, payload); }
  deleteUser(id: number) { return this.api.delete(`users/${id}`); }

  roles() { return this.api.get('roles'); }
  list(q: any, perPage: any, status: any) { return this.api.get('users', <any>{ q, perPage, status }); }
  create(payload: any) { return this.createUser(payload); }
  update(id: number, payload: any) { return this.updateUser(id, payload); }
  delete(id: number) { return this.deleteUser(id); }
  listArchived(q?: string) {
    const params = new HttpParams().set('status', 'archived').set('per_page', '10000');
    return this.api.get('users', q ? params.set('q', q) : params);
  }
  restore(id: number) { return this.api.post(`users/${id}/restore`, {}); }
  forceDelete(id: number) { return this.api.delete(`users/${id}/force-delete`); }
}

