import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminExpirationService {
  constructor(private api: ApiService) {}

  listExpirations(query: any = {}) { return this.api.get('expirations'); }
  exportExpirations(params?: any) { return this.api.get('expirations/export'); }

  // Get lifecycle information (batches) for a product
  getBatchLifecycle(productId: number) {
    return this.api.get(`expirations/${productId}/lifecycle`);
  }

  // Get batches expiring soon for a product
  getExpiringSoon(productId: number) {
    return this.api.get(`expirations/${productId}/expiring-soon`);
  }

  // Get expiration-related events for a product
  getExpirationEvents(productId: number) {
    return this.api.get(`expirations/${productId}/events`);
  }

  // Mark a batch for elimination
  eliminateBatch(batchId: number, justification: string) {
    return this.api.post(`expirations/${batchId}/eliminate`, { justification });
  }

  // Return a batch to its supplier
  returnToSupplierBatch(batchId: number, justification: string) {
    return this.api.post(`expirations/${batchId}/return-to-supplier`, { justification });
  }
}

