# 🎨 Frontend Integration - Afficher le Cycle de Vie dans Angular

## 📍 Où Ajouter cette Fonctionnalité

La capture d'écran montre:
- **Produit**: Ordinateur HP (REF-HP-001)
- **Stocks par dépôt**: ben arous, jmilkj, ikj, lkml
- **Status**: "Hors stock" pour tous

### Ajouter à Cette Vue:
1. **Colonne d'expiration date** dans le tableau des stocks
2. **Badge de statut d'expiration** (✅ Valide / ⚠️ Expire 7j / ❌ Expiré)
3. **Widget Timeline** montrant le cycle de vie
4. **Section Alertes** affichant les expirations en attente
5. **Boutons d'action** (Acknowledge, Force Consume)

---

## 🎯 Composants Angular à Créer/Modifier

### 1️⃣ Service: `admin-expiration.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminExpirationService {
  private apiUrl = '/api/admin/expirations';

  constructor(private http: HttpClient) {}

  // Lister les produits expiréés
  getExpiredProducts(page = 1): Observable<any> {
    return this.http.get(`${this.apiUrl}/expired?page=${page}`);
  }

  // Lister les produits expirant bientôt
  getExpiringProducts(days = 7): Observable<any> {
    return this.http.get(`${this.apiUrl}/expiring-soon?days=${days}`);
  }

  // Lister les alertes non traitées
  getPendingAlerts(): Observable<any> {
    return this.http.get(`${this.apiUrl}/alerts`);
  }

  // Vérifier le statut d'un stock
  checkStockStatus(stockId: number): Observable<any> {
    return this.http.get(`/api/admin/product-stocks/${stockId}/expiration-status`);
  }

  // Marquer une alerte comme traitée
  acknowledgeAlert(alertId: number, status: string, notes?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${alertId}/acknowledge`, {
      status,
      notes
    });
  }

  // Forcer la consommation d'un produit expiré
  forceConsumeExpired(stockId: number, quantity: number, justification: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${stockId}/force-consume`, {
      quantity,
      justification
    });
  }

  // Obtenir les statistiques
  getStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }
}
```

### 2️⃣ Interface TypeScript: `models/expiration.model.ts`

```typescript
export interface ProductStock {
  id: number;
  product_id: number;
  batch_number?: string;
  expiration_date?: string; // Date ISO
  batch_status: 'active' | 'expired' | 'disposed';
  quantity: number;
  last_expiration_check?: string;
}

export interface ExpirationStatus {
  product_stock_id: number;
  product_id: number;
  batch_number?: string;
  expiration_date?: string;
  status: string; // "✅ Valide", "⚠️ Expire dans 7j", "❌ Expiré depuis 1j"
  can_be_consumed: boolean;
  batch_status: string;
}

export interface ExpirationEvent {
  id: number;
  product_id: number;
  product_stock_id: number;
  batch_number?: string;
  expiration_date: string;
  quantity_affected: number;
  event_type: 'alert_7days' | 'alert_expired' | 'blocked_from_consumption' | 'marked_as_expired' | 'consumed_expired' | 'disposed';
  status: 'pending' | 'acknowledged' | 'resolved' | 'ignored';
  action_details: string;
  created_at: string;
  created_by?: object;
  acknowledged_at?: string;
}

export interface ExpirationStats {
  total_expired_events: number;
  pending_alerts: number;
  recent_alerts_7days: number;
  products_expiring_soon_7days: number;
}
```

### 3️⃣ Composant: `product-expiration-status.component.ts`

```typescript
import { Component, Input, OnInit } from '@angular/core';
import { AdminExpirationService } from '../../../services/admin-expiration.service';
import { ExpirationStatus } from '../../../models/expiration.model';

@Component({
  selector: 'app-product-expiration-status',
  templateUrl: './product-expiration-status.component.html',
  styleUrls: ['./product-expiration-status.component.scss']
})
export class ProductExpirationStatusComponent implements OnInit {
  @Input() productStockId: number;
  @Input() batchNumber?: string;
  @Input() expirationDate?: string;

  expirationStatus: ExpirationStatus;
  loading = false;
  error: string;

  constructor(private expirationService: AdminExpirationService) {}

  ngOnInit() {
    this.checkStatus();
  }

  checkStatus() {
    this.loading = true;
    this.expirationService.checkStockStatus(this.productStockId).subscribe({
      next: (data) => {
        this.expirationStatus = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur de chargement';
        this.loading = false;
      }
    });
  }

  get badgeClass(): string {
    if (!this.expirationStatus) return 'badge-secondary';
    
    const status = this.expirationStatus.status;
    if (status.includes('EXPIRÉ')) return 'badge-danger';
    if (status.includes('Expire')) return 'badge-warning';
    return 'badge-success';
  }

  get statusIcon(): string {
    if (!this.expirationStatus) return '❓';
    if (this.expirationStatus.status.includes('EXPIRÉ')) return '❌';
    if (this.expirationStatus.status.includes('Expire')) return '⚠️';
    return '✅';
  }
}
```

### 4️⃣ Template HTML: `product-expiration-status.component.html`

```html
<div class="expiration-status">
  <!-- Loading -->
  <div *ngIf="loading" class="spinner-border spinner-border-sm" role="status">
    <span class="sr-only">Chargement...</span>
  </div>

  <!-- Error -->
  <div *ngIf="error" class="alert alert-danger alert-sm">
    {{ error }}
  </div>

  <!-- Status Badge -->
  <div *ngIf="expirationStatus && !loading">
    <span [ngClass]="['badge', badgeClass]">
      {{ statusIcon }} {{ expirationStatus.status }}
    </span>
    
    <!-- Batch Number -->
    <small *ngIf="expirationStatus.batch_number" class="text-muted d-block mt-1">
      Lot: <strong>{{ expirationStatus.batch_number }}</strong>
    </small>
    
    <!-- Expiration Date -->
    <small *ngIf="expirationStatus.expiration_date" class="text-muted d-block">
      Expire: <strong>{{ expirationStatus.expiration_date | date:'dd/MM/yyyy' }}</strong>
    </small>

    <!-- Cannot Consume Warning -->
    <div *ngIf="!expirationStatus.can_be_consumed" class="alert alert-danger alert-sm mt-2 mb-0">
      ⛔ Ce stock ne peut pas être consommé (expiré)
    </div>
  </div>
</div>
```

---

## 5️⃣ Composant: `product-stock-table.component.ts` (MODIFIER)

```typescript
// Dans product-stock-table.component.ts, ajouter dans le tableau:

export class ProductStockTableComponent implements OnInit {
  @Input() productId: number;
  
  stocks: ProductStock[] = [];
  expirationStatuses: Map<number, ExpirationStatus> = new Map();
  loading = false;

  constructor(
    private adminStockService: AdminStockService,
    private expirationService: AdminExpirationService
  ) {}

  ngOnInit() {
    this.loadStocks();
  }

  loadStocks() {
    this.loading = true;
    this.adminStockService.getProductStocks(this.productId).subscribe({
      next: (stocks) => {
        this.stocks = stocks;
        // Charger le statut d'expiration pour chaque stock
        stocks.forEach(stock => this.loadExpirationStatus(stock.id));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
      }
    });
  }

  loadExpirationStatus(stockId: number) {
    this.expirationService.checkStockStatus(stockId).subscribe({
      next: (status) => {
        this.expirationStatuses.set(stockId, status);
      }
    });
  }

  getExpirationStatus(stockId: number): ExpirationStatus {
    return this.expirationStatuses.get(stockId);
  }

  // Dans la table, afficher le statut d'expiration
  getRowClass(stock: ProductStock): string {
    const status = this.getExpirationStatus(stock.id);
    if (!status) return '';
    if (status.status.includes('EXPIRÉ')) return 'table-danger';
    if (status.status.includes('Expire')) return 'table-warning';
    return 'table-success';
  }
}
```

### 6️⃣ Template du Tableau stocks

```html
<table class="table table-sm">
  <thead>
    <tr>
      <th>Localisation</th>
      <th>Quantité</th>
      <th>Lot / Batch</th>
      <th>Date Expiration</th>
      <th>Statut</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let stock of stocks" [ngClass]="getRowClass(stock)">
      <td>{{ stock.warehouse_location?.name }}</td>
      <td>{{ stock.quantity }}</td>
      <td>{{ stock.batch_number || '-' }}</td>
      <td>{{ stock.expiration_date ? (stock.expiration_date | date:'dd/MM/yyyy') : '-' }}</td>
      <td>
        <app-product-expiration-status 
          [productStockId]="stock.id"
          [batchNumber]="stock.batch_number"
          [expirationDate]="stock.expiration_date">
        </app-product-expiration-status>
      </td>
      <td>
        <button 
          *ngIf="!getExpirationStatus(stock.id)?.can_be_consumed"
          class="btn btn-sm btn-danger"
          (click)="openForceConsumeModal(stock)">
          🆘 Consommer (Force)
        </button>
        <button 
          *ngIf="getExpirationStatus(stock.id)?.can_be_consumed"
          class="btn btn-sm btn-primary"
          (click)="openConsumableRequestModal(stock)">
          ✅ Consommer
        </button>
      </td>
    </tr>
  </tbody>
</table>
```

---

## ⏰ Composant: `product-lifecycle-timeline.component.ts`

```typescript
import { Component, Input, OnInit } from '@angular/core';

interface LifecycleEvent {
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'current' | 'pending';
  icon: string;
  color: string;
}

@Component({
  selector: 'app-product-lifecycle-timeline',
  templateUrl: './product-lifecycle-timeline.component.html',
  styleUrls: ['./product-lifecycle-timeline.component.scss']
})
export class ProductLifecycleTimelineComponent implements OnInit {
  @Input() expirationDate: string;
  @Input() batchNumber: string;

  events: LifecycleEvent[] = [];

  ngOnInit() {
    if (this.expirationDate) {
      this.generateTimeline();
    }
  }

  generateTimeline() {
    const expDate = new Date(this.expirationDate);
    const today = new Date();
    const sevenDaysBefore = new Date(expDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);

    this.events = [
      {
        title: '📦 Stock Actif',
        description: `Lot: ${this.batchNumber || 'N/A'}`,
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        icon: '✅',
        color: 'success'
      },
      {
        title: '⚠️ Alerte 7 jours avant',
        description: 'Notification envoyée aux admins',
        date: sevenDaysBefore.toISOString().split('T')[0],
        status: today < sevenDaysBefore ? 'pending' : 'completed',
        icon: '⚠️',
        color: 'warning'
      },
      {
        title: '🔴 Jour d\'Expiration',
        description: 'Dernier jour de consommation',
        date: this.expirationDate,
        status: today === expDate ? 'current' : today > expDate ? 'completed' : 'pending',
        icon: '🔴',
        color: 'danger'
      },
      {
        title: '❌ Produit Expiré',
        description: 'Consommation bloquée',
        date: new Date(expDate.getTime() + 86400000).toISOString().split('T')[0],
        status: today > expDate ? 'completed' : 'pending',
        icon: '❌',
        color: 'dark'
      },
      {
        title: '📚 Archivage',
        description: 'Conservation historique',
        date: new Date(expDate.getTime() + 86400000).toISOString().split('T')[0],
        status: 'pending',
        icon: '📚',
        color: 'secondary'
      }
    ];
  }
}
```

### Template Timeline

```html
<div class="lifecycle-timeline">
  <h5 class="mb-3">📅 Cycle de Vie du Produit</h5>
  
  <div class="timeline">
    <div *ngFor="let event of events; let last = last" 
         class="timeline-item"
         [ngClass]="'status-' + event.status">
      
      <div class="timeline-marker" [ngClass]="'bg-' + event.color">
        {{ event.icon }}
      </div>
      
      <div class="timeline-content">
        <h6>{{ event.title }}</h6>
        <p class="text-muted">{{ event.description }}</p>
        <small class="text-secondary">{{ event.date | date:'dd/MM/yyyy' }}</small>
      </div>

      <div *ngIf="!last" class="timeline-line" [ngClass]="'bg-' + event.color"></div>
    </div>
  </div>
</div>
```

### CSS pour Timeline

```scss
.lifecycle-timeline {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 20px 0;

  .timeline {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .timeline-item {
    display: flex;
    margin-bottom: 20px;
    position: relative;

    &.status-completed {
      opacity: 0.8;
    }

    &.status-current {
      .timeline-marker {
        box-shadow: 0 0 0 4px rgba(255, 0, 0, 0.2);
      }
    }
  }

  .timeline-marker {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-right: 20px;
    flex-shrink: 0;
    color: white;
  }

  .timeline-content {
    flex-grow: 1;
    padding: 10px 0;

    h6 {
      margin-bottom: 5px;
      font-weight: 600;
    }

    p {
      margin-bottom: 0;
      font-size: 14px;
    }
  }

  .timeline-line {
    position: absolute;
    left: 24px;
    top: 50px;
    width: 2px;
    height: 30px;
  }
}
```

---

## 🔔 Composant: `expiration-alerts-widget.component.ts`

```typescript
import { Component, OnInit } from '@angular/core';
import { AdminExpirationService } from '../../../services/admin-expiration.service';
import { ExpirationEvent } from '../../../models/expiration.model';

@Component({
  selector: 'app-expiration-alerts-widget',
  templateUrl: './expiration-alerts-widget.component.html',
  styleUrls: ['./expiration-alerts-widget.component.scss']
})
export class ExpirationAlertsWidgetComponent implements OnInit {
  alerts: ExpirationEvent[] = [];
  loading = false;
  alertCount = 0;

  constructor(private expirationService: AdminExpirationService) {}

  ngOnInit() {
    this.loadAlerts();
    // Rafraîchir toutes les 5 minutes
    setInterval(() => this.loadAlerts(), 5 * 60 * 1000);
  }

  loadAlerts() {
    this.loading = true;
    this.expirationService.getPendingAlerts().subscribe({
      next: (data) => {
        this.alerts = data.data || [];
        this.alertCount = this.alerts.length;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  acknowledgeAlert(alertId: number) {
    this.expirationService.acknowledgeAlert(alertId, 'acknowledged', 'Alerte traitée').subscribe({
      next: () => {
        this.loadAlerts();
      }
    });
  }

  getEventTypeLabel(eventType: string): string {
    const labels = {
      'alert_7days': '⚠️ Expire dans 7 jours',
      'alert_expired': '🔴 Jour de l\'expiration',
      'blocked_from_consumption': '🚫 Consommation bloquée',
      'marked_as_expired': '❌ Marqué comme expiré',
      'consumed_expired': '⚡ Consommé après expiration'
    };
    return labels[eventType] || eventType;
  }
}
```

### Template Alerts Widget

```html
<div class="alerts-widget">
  <div class="alert-header d-flex justify-content-between align-items-center">
    <h5>🔔 Alertes d'Expiration</h5>
    <span class="badge badge-danger" *ngIf="alertCount > 0">
      {{ alertCount }}
    </span>
  </div>

  <!-- Loading -->
  <div *ngIf="loading" class="text-center py-3">
    <div class="spinner-border spinner-border-sm"></div>
  </div>

  <!-- No Alerts -->
  <div *ngIf="!loading && alerts.length === 0" class="alert alert-success">
    ✅ Aucune alerte d'expiration
  </div>

  <!-- Alerts List -->
  <div *ngIf="!loading && alerts.length > 0" class="alerts-list">
    <div *ngFor="let alert of alerts" class="alert-item">
      <div class="alert-icon">
        {{ getEventTypeLabel(alert.event_type).split(' ')[0] }}
      </div>
      <div class="alert-content">
        <h6>{{ getEventTypeLabel(alert.event_type) }}</h6>
        <p class="text-muted mb-1">
          <small>
            Lot: <strong>{{ alert.batch_number }}</strong>
            - Exp: {{ alert.expiration_date | date:'dd/MM/yyyy' }}
          </small>
        </p>
        <p class="text-muted mb-2">{{ alert.action_details }}</p>
        <button 
          class="btn btn-sm btn-outline-primary"
          (click)="acknowledgeAlert(alert.id)">
          ✔️ Traiter
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 📊 Où Placer Tout Cela dans le Design Existant

### Sur la page du Produit

```
┌─────────────────────────────────────────────────────┐
│ Produit: Ordinateur HP (REF-HP-001)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Details] [Stock] [Documents] [Images]             │
│                                                     │
│ 🔔 Alertes d'Expiration                  [0 Alerte]│
│ ├─ Aucune alerte                                    │
│                                                     │
│ 📅 Cycle de Vie du Produit                          │
│ ├─ 📦 Stock Actif                                   │
│ ├─ ⚠️ Alerte 7 jours avant                         │
│ ├─ 🔴 Jour d'Expiration                             │
│ ├─ ❌ Produit Expiré                                │
│ └─ 📚 Archivage                                     │
│                                                     │
│ Disponibilité par Dépôt                             │
│ ┌───────────────────────────────────────────────┐  │
│ │ Dépôt    │ Qty │ Lot       │ Exp     │ Statut  │ │
│ ├──────────────────────────────────────────────┤  │
│ │ben arous │  50 │LOT-001   │01/06   │✅ Valide│ │
│ │jmilkj    │   0 │-         │-       │-       │ │
│ │ikj       │  25 │LOT-002   │25/05   │⚠️Expire│ │
│ │lkml      │   0 │-         │-       │-       │ │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ Actions                                             │
│ [+ Nouveau mouvement de stock]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Intégration dans le Module

### Dans `app.module.ts`

```typescript
import { ProductExpirationStatusComponent } from './components/product-expiration-status/product-expiration-status.component';
import { ProductLifecycleTimelineComponent } from './components/product-lifecycle-timeline/product-lifecycle-timeline.component';
import { ExpirationAlertsWidgetComponent } from './components/expiration-alerts-widget/expiration-alerts-widget.component';
import { AdminExpirationService } from './services/admin-expiration.service';

@NgModule({
  declarations: [
    ProductExpirationStatusComponent,
    ProductLifecycleTimelineComponent,
    ExpirationAlertsWidgetComponent,
    // ... autres composants
  ],
  imports: [
    // CommonModule, HttpClientModule, etc.
  ],
  providers: [
    AdminExpirationService,
    // ... autres services
  ]
})
export class AdminModule { }
```

---

## 📲 Utilisation sur la Page du Produit

```html
<!-- product-detail.component.html -->

<div class="product-container">
  <h2>{{ product.title }} ({{ product.reference }})</h2>

  <!-- Alertes Widget -->
  <div class="row">
    <div class="col-md-6">
      <app-expiration-alerts-widget></app-expiration-alerts-widget>
    </div>
    <div class="col-md-6">
      <!-- Stats ou autre widget -->
    </div>
  </div>

  <!-- Cycle de Vie Timeline (si un produit a une expiration) -->
  <app-product-lifecycle-timeline 
    [expirationDate]="productStocks[0]?.expiration_date"
    [batchNumber]="productStocks[0]?.batch_number"
    *ngIf="productStocks[0]?.expiration_date">
  </app-product-lifecycle-timeline>

  <!-- Tableau des Stocks -->
  <div class="stock-section">
    <h5>Disponibilité par Dépôt</h5>
    <table class="table table-sm table-hover">
      <thead class="table-light">
        <tr>
          <th>Localisation</th>
          <th>Quantité</th>
          <th>Lot / Batch</th>
          <th>Date Expiration</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let stock of productStocks" [ngClass]="getStockRowClass(stock)">
          <td>{{ stock.warehouse_location?.name }}</td>
          <td>
            <span class="badge" [ngClass]="stock.quantity > 0 ? 'badge-success' : 'badge-danger'">
              {{ stock.quantity }}
            </span>
          </td>
          <td>{{ stock.batch_number || '-' }}</td>
          <td>{{ stock.expiration_date ? (stock.expiration_date | date:'dd/MM/yyyy') : '-' }}</td>
          <td>
            <app-product-expiration-status 
              [productStockId]="stock.id"
              [batchNumber]="stock.batch_number"
              [expirationDate]="stock.expiration_date">
            </app-product-expiration-status>
          </td>
          <td>
            <button class="btn btn-sm btn-primary">
              Consommer
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Actions -->
  <div class="actions-section mt-4">
    <button class="btn btn-primary">
      + Nouveau mouvement de stock
    </button>
  </div>
</div>
```

---

## 🚀 Fichiers à Créer/Modifier

### À Créer:

```
frontend/src/app/features/admin/
├── services/
│   └── admin-expiration.service.ts                    (NOUVEAU)
├── models/
│   └── expiration.model.ts                            (NOUVEAU)
├── components/
│   ├── product-expiration-status/
│   │   ├── product-expiration-status.component.ts     (NOUVEAU)
│   │   ├── product-expiration-status.component.html   (NOUVEAU)
│   │   └── product-expiration-status.component.scss   (NOUVEAU)
│   ├── product-lifecycle-timeline/
│   │   ├── product-lifecycle-timeline.component.ts    (NOUVEAU)
│   │   ├── product-lifecycle-timeline.component.html  (NOUVEAU)
│   │   └── product-lifecycle-timeline.component.scss  (NOUVEAU)
│   └── expiration-alerts-widget/
│       ├── expiration-alerts-widget.component.ts      (NOUVEAU)
│       ├── expiration-alerts-widget.component.html    (NOUVEAU)
│       └── expiration-alerts-widget.component.scss    (NOUVEAU)
```

### À Modifier:

```
frontend/src/app/
├── app.module.ts                                      (Ajouter imports)
├── features/admin/
│   ├── pages/
│   │   └── product-detail.component.html              (Ajouter widgets)
│   └── components/
│       └── product-stock-table/
│           └── product-stock-table.component.ts       (Ajouter colonnes)
```

---

## ⚡ Quick Integration Checklist

- [ ] Créer `admin-expiration.service.ts`
- [ ] Créer `expiration.model.ts`
- [ ] Créer `product-expiration-status.component.*`
- [ ] Créer `product-lifecycle-timeline.component.*`
- [ ] Créer `expiration-alerts-widget.component.*`
- [ ] Modifier `app.module.ts` (imports)
- [ ] Modifier `product-detail.component.html`
- [ ] Modifier `product-stock-table.component.ts`
- [ ] Tester avec Postman d'abord
- [ ] Implémenter modal Force Consume

**Temps d'implémentation: 3-4 heures**

