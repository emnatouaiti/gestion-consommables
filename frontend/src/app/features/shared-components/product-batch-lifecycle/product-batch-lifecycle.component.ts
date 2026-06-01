import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminExpirationService } from '../../../core/services/admin-expiration.service';

/**
 * Composant: Afficher le cycle de vie pour chaque batch/date d'expiration unique
 *
 * Pour chaque date d'expiration distincte du produit:
 * - Affiche une timeline du cycle de vie
 * - Statut actuel (Valide, Expire bientôt, Expiré)
 * - Action possible (Consommer, Acknowledge, Force-consume)
 */
interface BatchLifecycle {
  batch_number: string;
  expiration_date: string;
  status: string; // "✅ Valide" | "⚠️ Expire" | "❌ Expiré"
  color: string; // "success" | "warning" | "danger"
  daysLeft: number;
  quantity: number; // Total des stocks avec cette date
  stockIds: number[]; // IDs des stocks avec cette date
  events: LifecycleEvent[];
}

interface LifecycleEvent {
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'current' | 'pending';
  icon: string;
  color: string;
}

@Component({
  selector: 'app-product-batch-lifecycle',
  templateUrl: './product-batch-lifecycle.component.html',
  styleUrls: ['./product-batch-lifecycle.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ProductBatchLifecycleComponent implements OnInit, OnChanges {
  @Input() productId!: number;
  @Input() productStocks: any[] = [];

  batches: BatchLifecycle[] = [];
  loading = false;
  selectedBatch: BatchLifecycle | null = null;

  constructor(private expirationService: AdminExpirationService) {}

  ngOnInit() {
    this.generateBatchLifecycles();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['productStocks']) {
      this.generateBatchLifecycles();
    }
  }

  /**
   * Générer les cycles de vie pour chaque batch unique (date d'expiration)
   */
  generateBatchLifecycles() {
    if (!this.productStocks || this.productStocks.length === 0) {
      return;
    }

    // Grouper les stocks par date d'expiration
    const groupedByDate = this.groupBy(this.productStocks, 'expiration_date');

    this.batches = Object.keys(groupedByDate).map((dateKey) => {
      const stocks = groupedByDate[dateKey];
      const firstStock = stocks[0];
      const expirationDate = firstStock.expiration_date;
      const totalQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
      const stockIds = stocks.map(s => s.id);

      // Calculer le statut
      const today = new Date();
      let expDate: Date | null = null;
      let daysLeft = Infinity;
      let status = 'Sans date d\'expiration';
      let color = 'success';

      if (expirationDate && expirationDate !== 'null') {
        expDate = new Date(expirationDate);
        daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
          status = 'Expiré depuis ' + Math.abs(daysLeft) + ' jour(s)';
          color = 'danger';
        } else if (daysLeft <= 7) {
          status = 'Expire dans ' + daysLeft + ' jour(s)';
          color = 'warning';
        } else {
          status = 'Valide';
        }
      }

      // Générer la timeline du cycle de vie
      const events = this.generateTimeline(expirationDate);

      return {
        batch_number: firstStock.batch_number || 'Sans lot',
        expiration_date: expirationDate,
        status,
        color,
        daysLeft,
        quantity: totalQuantity,
        stockIds,
        events
      };
    });

    // Trier par date d'expiration (les plus proches d'abord)
    this.batches.sort((a, b) => {
      return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
    });

    // Sélectionner le premier batch par défaut
    if (this.batches.length > 0) {
      this.selectedBatch = this.batches[0];
    }
  }

  /**
   * Générer une timeline pour une date d'expiration
   */
  generateTimeline(expirationDate: string): LifecycleEvent[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!expirationDate || expirationDate === 'null') {
      return [
        {
          title: 'Stock Actif',
          description: 'Produit en circulation',
          date: this.formatDate(new Date()),
          status: 'current',
          icon: 'check',
          color: 'success'
        }
      ];
    }

    const expDate = new Date(expirationDate);
    today.setHours(0, 0, 0, 0);
    expDate.setHours(0, 0, 0, 0);

    const sevenDaysBefore = new Date(expDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);

    return [
      {
        title: 'Stock Actif',
        description: 'Produit en circulation',
        date: this.formatDate(new Date()),
        status: today < sevenDaysBefore ? 'current' : 'completed',
        icon: 'check',
        color: 'success'
      },
      {
        title: 'Alerte 7 jours avant',
        description: 'Notification aux administrateurs',
        date: this.formatDate(sevenDaysBefore),
        status: today < sevenDaysBefore ? 'pending' : today <= expDate ? 'completed' : 'completed',
        icon: 'alert-triangle',
        color: 'warning'
      },
      {
        title: 'Jour d\'Expiration',
        description: 'Dernier jour de consommation autorisée',
        date: this.formatDate(expDate),
        status: today === expDate ? 'current' : today > expDate ? 'completed' : 'pending',
        icon: 'calendar',
        color: 'danger'
      },
      {
        title: 'Blocage Consommation',
        description: 'Stock marqué comme expiré',
        date: this.formatDate(new Date(expDate.getTime() + 86400000)),
        status: today > expDate ? 'completed' : 'pending',
        icon: 'slash',
        color: 'dark'
      },
      {
        title: 'Archivage',
        description: 'Historique conservé',
        date: this.formatDate(new Date(expDate.getTime() + 86400000 * 2)),
        status: 'pending',
        icon: 'archive',
        color: 'secondary'
      }
    ];
  }

  /**
   * Grouper un tableau par une clé composite (batch_number + expiration_date)
   */
  groupBy(array: any[], key: string): { [key: string]: any[] } {
    return array.reduce((result, item) => {
      // Use both batch number and expiration date for unique grouping
      const batch = item.batch_number || 'Sans lot';
      const date = item.expiration_date || 'null';
      const groupKey = `${batch}|${date}`;
      
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {});
  }

  /**
   * Formater une date
   */
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Sélectionner un batch
   */
  selectBatch(batch: BatchLifecycle) {
    this.selectedBatch = batch;
  }

  /**
   * Obtenir la classe CSS pour le badge de statut
   */
  getStatusBadgeClass(batch: BatchLifecycle): string {
    return `badge-${batch.color}`;
  }

  /**
   * Obtenir les stocks pour le batch sélectionné
   */
  getSelectedBatchStocks(): any[] {
    if (!this.selectedBatch) return [];
    return this.productStocks.filter(s => this.selectedBatch!.stockIds.includes(s.id));
  }

  /**
   * Vérifier si le batch peut être consommé
   */
  canConsume(batch: BatchLifecycle): boolean {
    return batch.daysLeft === Infinity || batch.daysLeft >= 0;
  }

  /**
   * Action: Consommer
   */
  onConsume(batch: BatchLifecycle) {
    if (this.canConsume(batch)) {
      console.log('Consommer batch:', batch.batch_number);
      // TODO: Ouvrir modal de consommation
    }
  }

  /**
   * Action: Forcer la consommation (admin override)
   */
  onForceConsume(batch: BatchLifecycle) {
    if (!this.canConsume(batch)) {
      console.log('Forcer consommation:', batch.batch_number);
      // TODO: Ouvrir modal force-consume avec justification
    }
  }

  getValidBatchesCount(): number {
    return this.batches.filter(b => b.daysLeft === Infinity || b.daysLeft > 7).length;
  }

  getWarningBatchesCount(): number {
    return this.batches.filter(b => b.daysLeft >= 0 && b.daysLeft <= 7).length;
  }

  getExpiredBatchesCount(): number {
    return this.batches.filter(b => b.daysLeft < 0).length;
  }
}
