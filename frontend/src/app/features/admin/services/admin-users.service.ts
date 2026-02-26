import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  constructor(private api: ApiService) {}

  list(q: string | null = null, per_page: number = 20, status: 'active' | 'archived' | 'all' = 'active') {
    let params = new HttpParams();
    params = params.set('per_page', String(per_page));
    params = params.set('status', status);
    if (q) params = params.set('q', q);
    return this.api.get('admin/users', params);
  }

  get(id: any) {
    return this.api.get(`admin/users/${id}`);
  }

  create(data: any) {
    const formData = this.toFormData(data);
    return this.api.post('admin/users', formData);
  }

  update(id: any, data: any) {
    const formData = this.toFormData(data);
    formData.append('_method', 'PUT');
    return this.api.post(`admin/users/${id}`, formData);
  }

  delete(id: any) {
    return this.api.delete(`admin/users/${id}`);
  }

  listArchived(q: string | null = null, per_page: number = 20) {
    return this.list(q, per_page, 'archived');
  }

  restore(id: any) {
    return this.api.post(`admin/users/${id}/restore`, {});
  }

  forceDelete(id: any) {
    return this.api.delete(`admin/users/${id}/force`);
  }

  roles() {
    return this.api.get('admin/roles');
  }

  private toFormData(payload: any): FormData {
    const formData = new FormData();

    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      if (value instanceof File) {
        formData.append(key, value);
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          formData.append(`${key}[]`, String(item));
        });
        return;
      }

      formData.append(key, String(value));
    });

    return formData;
  }
}
