import { Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminRefService {
  constructor(private api: ApiService) {}

  // Fabricants
  listFabricants(): Observable<any> { return this.api.get('admin/fabricants'); }
  createFabricant(payload: any) { return this.api.post('admin/fabricants', payload); }
  updateFabricant(id: number, payload: any) { return this.api.put(`admin/fabricants/${id}`, payload); }
  deleteFabricant(id: number) { return this.api.delete(`admin/fabricants/${id}`); }

  // Marques
  listMarques(params?: any) { let q = ''; if (params?.fabricant_id) q = `?fabricant_id=${encodeURIComponent(params.fabricant_id)}`; return this.api.get('admin/marques' + q); }
  createMarque(payload: any) { return this.api.post('admin/marques', payload); }
  updateMarque(id: number, payload: any) { return this.api.put(`admin/marques/${id}`, payload); }
  deleteMarque(id: number) { return this.api.delete(`admin/marques/${id}`); }

  // Modeles
  listModeles(params?: any) { let q = []; if (params?.fabricant_id) q.push(`fabricant_id=${encodeURIComponent(params.fabricant_id)}`); if (params?.marque_id) q.push(`marque_id=${encodeURIComponent(params.marque_id)}`); return this.api.get('admin/modeles' + (q.length ? ('?' + q.join('&')) : '')); }
  createModele(payload: any) { return this.api.post('admin/modeles', payload); }
  updateModele(id: number, payload: any) { return this.api.put(`admin/modeles/${id}`, payload); }
  deleteModele(id: number) { return this.api.delete(`admin/modeles/${id}`); }
}
