import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminRefService {
  constructor(private api: ApiService) {}

  // Marques
  listMarques(params?: any) { return this.api.get('marques'); }
  createMarque(payload: any) { return this.api.post('marques', payload); }
  updateMarque(id: number, payload: any) { return this.api.put(`marques/${id}`, payload); }
  deleteMarque(id: number) { return this.api.delete(`marques/${id}`); }

  // Modeles
  listModeles(params?: any) { let q: string[] = []; if (params?.marque_id) q.push(`marque_id=${encodeURIComponent(params.marque_id)}`); return this.api.get('modeles' + (q.length ? ('?' + q.join('&')) : '')); }
  createModele(payload: any) { return this.api.post('modeles', payload); }
  updateModele(id: number, payload: any) { return this.api.put(`modeles/${id}`, payload); }
  deleteModele(id: number) { return this.api.delete(`modeles/${id}`); }
}

