# 🎯 Guide d'Intégration - Ajouter le Cycle de Vie dans le Détail Produit

## 📋 Fichiers Créés

```
frontend/src/app/features/components/
├── stock-form/
│   ├── stock-form.component.ts           ✅ NOUVEAU
│   ├── stock-form.component.html         ✅ NOUVEAU
│   └── stock-form.component.scss         ✅ NOUVEAU
└── product-batch-lifecycle/
    ├── product-batch-lifecycle.component.ts   ✅ NOUVEAU
    ├── product-batch-lifecycle.component.html ✅ NOUVEAU
    └── product-batch-lifecycle.component.scss ✅ NOUVEAU
```

---

## 🔧 Étapes d'Intégration

### 1️⃣ Importer les Composants dans le Module

**Fichier: `frontend/src/app/features/admin.module.ts`**

```typescript
import { StockFormComponent } from './components/stock-form/stock-form.component';
import { ProductBatchLifecycleComponent } from './components/product-batch-lifecycle/product-batch-lifecycle.component';

@NgModule({
  declarations: [
    StockFormComponent,           // ← AJOUTER
    ProductBatchLifecycleComponent, // ← AJOUTER
    // ... autres composants existants
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,  // Important pour les formulaires réactifs
    HttpClientModule,
    // ...
  ],
  providers: [
    AdminStockService,
    AdminExpirationService, // ← AJOUTER si n'existe pas
  ]
})
export class AdminModule { }
```

---

### 2️⃣ Modifier la Page `product-detail.component.ts`

**Fichier: `frontend/src/app/features/pages/product-detail/product-detail.component.ts`**

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { AdminStockService } from '../../services/admin-stock.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit {
  product: any;
  productStocks: any[] = [];
  warehouseLocations: any[] = [];
  suppliers: any[] = [];
  loading = false;
  showAddStockForm = false; // ← NOUVEAU

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private adminStockService: AdminStockService
  ) {}

  ngOnInit() {
    const productId = this.route.snapshot.paramMap.get('id');
    this.loadProduct(productId);
    this.loadStocks(productId);
    this.loadLocations();
    this.loadSuppliers();
  }

  loadProduct(id: string) {
    this.productService.getProduct(id).subscribe((data) => {
      this.product = data;
    });
  }

  loadStocks(productId: string) {
    this.adminStockService.getProductStocks(productId).subscribe((stocks) => {
      this.productStocks = stocks;
    });
  }

  loadLocations() {
    this.adminStockService.getWarehouseLocations().subscribe((locations) => {
      this.warehouseLocations = locations;
    });
  }

  loadSuppliers() {
    this.adminStockService.getSuppliers().subscribe((suppliers) => {
      this.suppliers = suppliers;
    });
  }

  // NOUVEAU: Gérer l'ajout d'un stock
  onStockAdded(stock: any) {
    console.log('Stock ajouté:', stock);
    this.productStocks.push(stock);
    this.showAddStockForm = false;
  }

  // NOUVEAU: Gérer l'annulation du formulaire
  onAddStockCancelled() {
    this.showAddStockForm = false;
  }

  toggleAddStockForm() {
    this.showAddStockForm = !this.showAddStockForm;
  }
}
```

---

### 3️⃣ Modifier le Template `product-detail.component.html`

**Fichier: `frontend/src/app/features/pages/product-detail/product-detail.component.html`**

```html
<div class="product-detail-container">
  <div class="container-fluid">
    
    <!-- HEADER: Titre du Produit -->
    <div class="product-header mb-4">
      <h1>{{ product?.title }}</h1>
      <p class="text-muted">
        <strong>Référence:</strong> {{ product?.reference }} | 
        <strong>Catégorie:</strong> {{ product?.categorie?.name }}
      </p>
    </div>

    <!-- NAVIGATION TABS -->
    <ul class="nav nav-tabs mb-4" role="tablist">
      <li class="nav-item">
        <a class="nav-link active" data-bs-toggle="tab" href="#tab-details">
          Détails
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" data-bs-toggle="tab" href="#tab-stock">
          Stock & Expiration
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" data-bs-toggle="tab" href="#tab-documents">
          Documents
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" data-bs-toggle="tab" href="#tab-images">
          Images
        </a>
      </li>
    </ul>

    <!-- TAB CONTENT -->
    <div class="tab-content">
      
      <!-- TAB 1: Détails -->
      <div class="tab-pane fade show active" id="tab-details">
        <div class="row">
          <div class="col-md-6">
            <h5>Information Générale</h5>
            <dl class="row">
              <dt class="col-sm-4">Référence:</dt>
              <dd class="col-sm-8">{{ product?.reference }}</dd>
              
              <dt class="col-sm-4">Catégorie:</dt>
              <dd class="col-sm-8">{{ product?.categorie?.name }}</dd>
              
              <dt class="col-sm-4">Unité:</dt>
              <dd class="col-sm-8">{{ product?.unit || '-' }}</dd>
              
              <dt class="col-sm-4">Stock:</dt>
              <dd class="col-sm-8">
                <span class="badge" [ngClass]="product?.stock_quantity > 0 ? 'badge-success' : 'badge-danger'">
                  {{ product?.stock_quantity }} unités
                </span>
              </dd>
            </dl>
          </div>
          <div class="col-md-6">
            <h5>Prix</h5>
            <dl class="row">
              <dt class="col-sm-4">Coût:</dt>
              <dd class="col-sm-8">{{ product?.purchase_price | currency }}</dd>
              
              <dt class="col-sm-4">Vente:</dt>
              <dd class="col-sm-8">{{ product?.sale_price | currency }}</dd>
            </dl>
          </div>
        </div>
      </div>

      <!-- TAB 2: STOCK & EXPIRATION ← NOUVEAU -->
      <div class="tab-pane fade" id="tab-stock">
        
        <!-- 🔔 Alertes Widget -->
        <div class="row mb-4">
          <div class="col-md-12">
            <app-expiration-alerts-widget></app-expiration-alerts-widget>
          </div>
        </div>

        <!-- 📺 CYCLE DE VIE: Afficher pour chaque batch -->
        <div class="row mb-4">
          <div class="col-md-12">
            <app-product-batch-lifecycle 
              [productId]="product?.id"
              [productStocks]="productStocks">
            </app-product-batch-lifecycle>
          </div>
        </div>

        <!-- 📋 Tableau des Stocks (Disponibilité par Dépôt) -->
        <div class="row mb-4">
          <div class="col-md-12">
            <div class="card">
              <div class="card-header bg-light">
                <h5 class="mb-0">📍 Disponibilité par Dépôt</h5>
              </div>
              <div class="card-body">
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
                      <td>{{ stock.warehouse_location?.name || stock.cabinet_id || '-' }}</td>
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
                        <button 
                          class="btn btn-sm btn-primary"
                          (click)="onConsume(stock)">
                          Consommer
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Aucun stock -->
                <div *ngIf="productStocks.length === 0" class="alert alert-info">
                  Aucun stock pour ce produit
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 📝 FORMULAIRE D'AJOUT DE STOCK ← NOUVEAU -->
        <div class="row">
          <div class="col-md-12">
            <div class="card">
              <div class="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 class="mb-0">➕ Ajouter un Stock</h5>
                <button 
                  class="btn btn-sm btn-outline-secondary"
                  (click)="toggleAddStockForm()">
                  {{ showAddStockForm ? '🔼 Réduire' : '🔽 Afficher' }}
                </button>
              </div>

              <div class="card-body" *ngIf="showAddStockForm">
                <app-stock-form
                  [productId]="product?.id"
                  [warehouseLocations]="warehouseLocations"
                  [suppliers]="suppliers"
                  (stockAdded)="onStockAdded($event)"
                  (cancelled)="onAddStockCancelled()">
                </app-stock-form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Documents -->
      <div class="tab-pane fade" id="tab-documents">
        <!-- Contenu existant -->
      </div>

      <!-- TAB 4: Images -->
      <div class="tab-pane fade" id="tab-images">
        <!-- Contenu existant -->
      </div>

    </div>
  </div>
</div>
```

---

### 4️⃣ Ajouter les Services (si n'existant pas)

**Fichier: `frontend/src/app/features/services/admin-expiration.service.ts`**

(Voir le guide EXPIRATION_FRONTEND_GUIDE.md - Ajouter la classe AdminExpirationService)

---

## 📐 Architecture Visuelle

```
┌─────────────────────────────────────────────────────────────┐
│ PRODUIT: Ordinateur HP (REF-HP-001)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Détails] [Stock & Expiration] [Documents] [Images]        │
│                                                             │
│ ═══════════════════════════════════════════════════════════ │
│                                                             │
│ 🔔 ALERTES D'EXPIRATION                       [0 Alerte]   │
│                                                             │
│ 📦 CYCLES DE VIE PAR LOT                                   │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ [✅ LOT-001 01/06 50 unités]                        │    │
│ │ [⚠️ LOT-002 25/05 25 unités]  ← Sélectionné        │    │
│ │ [❌ LOT-003 10/05 0 unités]                         │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ 📅 Lot: LOT-002 [⚠️ Expire dans 4 jour(s)]               │
│ · Date exp: 25/05/2026                                    │
│ · Quantité: 25 unités                                     │
│ · Jours restants: 4                                       │
│                                                             │
│ 📊 CYCLE DE VIE                                            │
│ ├─ [✅ 📦 Stock Actif]                                     │
│ ├─ [✔ ⚠️ Alerte 7 jours]                                  │
│ ├─ [☊ 🔴 Jour d'Expiration]  ← EN COURS                   │
│ ├─ [○ 🚫 Blocage Consommation]                            │
│ └─ [○ 📚 Archivage]                                        │
│                                                             │
│ 📍 EMPLACEMENTS                                            │
│ [📦 ben arous 25 unités]                                  │
│ [📦 jmilkj 0 unités]                                      │
│                                                             │
│ [✅ Consommer ce lot] [🆘 Forcer Consommation]            │
│                                                             │
│ 📊 RÉSUMÉ                                                  │
│ Total: 3 | Valides: 1 | Attention: 1 | Expiréés: 1      │
│                                                             │
│ ═══════════════════════════════════════════════════════════ │
│                                                             │
│ 📍 DISPONIBILITÉ PAR DÉPÔT                                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Localisation │ Qty │ Lot     │ Exp    │ Statut │    │   │
│ ├──────────────┼──────────────────────────────────────┤   │
│ │ben arous          │50  │LOT-001 │01/06  │✅     │    │   │
│ │jmilkj            │0   │-      │-     │-     │    │   │
│ │ikj               │25  │LOT-002 │25/05  │⚠️    │    │   │
│ │lkml              │0   │-      │-     │-     │    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ═══════════════════════════════════════════════════════════ │
│                                                             │
│ ➕ AJOUTER UN STOCK                                        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 📍 Localisation:  [ben arous ▼]                     │   │
│ │ 🏭 Fournisseur:   [- ▼]                             │   │
│ │ 📦 Quantité:      [50]                              │   │
│ │ 📋 Lot:          [LOT-2026-004]                     │   │
│ │ 📅 Exp:          [01/07/2026]  ⏰ 30 jour(s)        │   │
│ │                                                      │   │
│ │ [✅ Ajouter Stock] [❌ Annuler]                      │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 CSS à Ajouter (Optionnel)

**Fichier: `frontend/src/app/features/pages/product-detail/product-detail.component.scss`**

```scss
.product-detail-container {
  padding: 20px 0;

  .product-header {
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 20px;

    h1 {
      color: #333;
      font-weight: 700;
      margin-bottom: 10px;
    }

    p {
      font-size: 14px;
    }
  }

  .nav-tabs {
    border-bottom: 2px solid #f0f0f0;

    .nav-link {
      color: #666;
      border: none;
      border-bottom: 3px solid transparent;
      padding: 12px 20px;
      font-weight: 600;
      transition: all 0.3s ease;

      &:hover {
        color: #007bff;
        background: #f8f9fa;
      }

      &.active {
        color: #007bff;
        border-bottom-color: #007bff;
        background: transparent;
      }
    }
  }

  .tab-content {
    padding: 20px 0;
  }

  .card {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    margin-bottom: 20px;

    .card-header {
      border-bottom: 1px solid #e0e0e0;
      padding: 15px;

      h5 {
        margin: 0;
        color: #333;
        font-weight: 600;
      }
    }

    .card-body {
      padding: 20px;
    }
  }

  .table {
    margin-bottom: 0;

    thead {
      background: #f8f9fa;
    }

    th {
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #dee2e6;
    }

    td {
      vertical-align: middle;
      padding: 12px;
    }

    tr:hover {
      background: #f8f9fa;
    }
  }

  .btn {
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 4px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
  }
}
```

---

## ✅ Checklist d'Intégration

- [ ] Créer les 6 fichiers de composants (ts/html/scss)
- [ ] Importer les composants dans `admin.module.ts`
- [ ] Modifier `product-detail.component.ts` (ajouter méthodes)
- [ ] Modifier `product-detail.component.html` (ajouter sections)
- [ ] Créer le service `AdminExpirationService` si besoin
- [ ] Tester l'ajout d'un stock avec date d'expiration
- [ ] Vérifier que le timeline s'affiche correctement
- [ ] Tester la sélection de différents batches
- [ ] Vérifier les filtres et tri

**Temps d'implémentation: 2-3 heures**

---

## 🚀 Test Rapide

1. Naviguer vers un produit
2. Cliquer sur l'onglet "Stock & Expiration"
3. Voir le widget des alertes (vide si aucune alerte)
4. Voir la timeline du cycle de vie
5. Cliquer sur le bouton "➕ Ajouter un Stock"
6. Remplir le formulaire avec:
   - Localisation: ben arous
   - Quantité: 50
   - Lot: LOT-2026-001
   - Date: 01/07/2026
7. Cliquer "Ajouter Stock"
8. Voir le nouveau batch apparaître dans les cycles de vie

---

## 💡 Features Avancées (v2)

- [ ] Modal pour voir toutes les alertes
- [ ] Export Excel des stocks par expiration
- [ ] Graphique des expirations par mois
- [ ] Notification push pour alertes urgentes
- [ ] Historique des mouvements par batch


