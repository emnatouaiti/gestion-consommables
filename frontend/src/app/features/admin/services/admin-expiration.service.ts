import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class AdminExpirationService {
  private readonly apiBase = 'admin';

  constructor(
    private readonly api: ApiService,
    private readonly http: HttpClient
  ) { }

  /**
   * Récupère les stocks avec leurs dates d'expiration groupés par batch
   */
  getProductStocksWithExpiration(productId: number): Observable<any[]> {
    return this.api.get(`${this.apiBase}/products/${productId}/stocks`);
  }

  /**
   * Récupère le cycle de vie d'un batch (timeline + statut)
   */
  getBatchLifecycle(productId: number): Observable<any> {
    return this.api.get(`${this.apiBase}/products/${productId}/expiration/batches`);
  }

  /**
   * Récupère les expirations imminentes (< 7 jours)
   */
  getExpiringSoon(productId: number): Observable<any[]> {
    return this.api.get(`${this.apiBase}/products/${productId}/expiration/expiring-soon`);
  }

  /**
   * Récupère les produits expirés
   */
  getExpiredProducts(): Observable<any[]> {
    return this.api.get(`${this.apiBase}/products/expiration/expired`);
  }

  /**
   * Vérifie le statut d'expiration d'un stock
   */
  checkStockStatus(stockId: number): Observable<any> {
    return this.api.get(`${this.apiBase}/stocks/${stockId}/expiration-status`);
  }

  /**
   * Force la consommation d'un stock expiré (admin only)
   */
  forceConsumeExpired(stockId: number, justification: string): Observable<any> {
    return this.api.post(`${this.apiBase}/stocks/${stockId}/force-consume`, {
      justification
    });
  }

  /**
   * Reconnaît une alerte d'expiration
   */
  acknowledgeAlert(eventId: number): Observable<any> {
    return this.api.post(`${this.apiBase}/expiration-events/${eventId}/acknowledge`, {});
  }

  /**
   * Obtient tous les events d'expiration d'un produit
   */
  getExpirationEvents(productId: number): Observable<any[]> {
    return this.api.get(`${this.apiBase}/products/${productId}/expiration-events`);
  }
}
