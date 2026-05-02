# 📅 Cycle de Vie des Produits - Guide Complet

## 📊 Schéma Visuel du Cycle de Vie

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATION PRODUIT                             │
│                  (Status: ACTIVE)                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ENTRÉE STOCK PAR BATCH (LOT)                       │
│  ├─ Batch Number (ex: LOT-2026-001)                             │
│  ├─ Expiration Date (ex: 2026-06-30)                            │
│  ├─ Quantity (ex: 50)                                           │
│  └─ Location (Cabinet/Entrepôt)                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │          │
                    ▼          ▼
            STOCK OK    STOCK BAS
         (Qty > Min)  (Qty ≤ Min)
                    │          │
                    └────┬─────┘
                         │
                    ┌────┴────────────┐
                    │                 │
                    ▼                 ▼
        DAYS OK              EXPIRATION CHECK
      (Days ∞)                 (All daily)
        │                       │
        │         ┌─────┬──────┬┴────┐
        │         │     │      │     │
        ▼         ▼     ▼      ▼     ▼
    CONSUME   ALERT  ALERT  BLOCK  DISPOSE
              (7j)   (0d)    (1d)
                │     │      │      │
                └─────┴──────┴──────┘
                      │
                      ▼
             CREATE EXPIRATION_EVENTS
             (Audit Trail)
```

## 📦 Structure de Base de Données

### Table: `product_stocks`
**Champs d'expiration ajoutés:**

| Champ | Type | Description |
|-------|------|-------------|
| `batch_number` | string | N° de lot unique (ex: LOT-2026-001) |
| `expiration_date` | date | Date limite d'utilisation |
| `batch_status` | enum | active \| expired \| disposed |
| `last_expiration_check` | timestamp | Dernière vérification automatique |

**Indices pour performance:**
```sql
INDEX(expiration_date)
INDEX(product_id, expiration_date)
INDEX(batch_status)
```

### Table: `expiration_events`
**Table d'audit pour toutes les expirations:**

| Champ | Type | Description |
|-------|------|-------------|
| `product_id` | FK | Produit concerné |
| `product_stock_id` | FK | Stock particulier |
| `batch_number` | string | N° de lot |
| `expiration_date` | date | Date d'expiration |
| `quantity_affected` | uint | Quantité impactée |
| `event_type` | enum | alert_7days \| alert_expired \| blocked_from_consumption \| marked_as_expired \| consumed_expired \| disposed |
| `status` | enum | pending \| acknowledged \| resolved \| ignored |
| `action_details` | text | Raison/détails |
| `created_by` | FK | Admin qui a créé l'événement |
| `acknowledged_by` | FK | Admin qui a reconnu l'alerte |
| `acknowledged_at` | timestamp | Quand l'alerte a été traitée |

## 🔧 Service: `ExpirationManagementService`

### Méthodes Principales

#### 1️⃣ **Détection & Vérification**

```php
// Vérifier TOUS les produits (appel via cron)
$metrics = $service->checkAllExpirations();
// Retour: [alerts_7days, alerts_expired, blocked, errors]

// Vérifier UN SEUL produit
$service->checkExpirationStatus($productStock);

// Tests
$service->isExpiringSoon($date)  // true si < 7 jours
$service->isExpired($date)        // true si passé
```

#### 2️⃣ **Actions sur Produits Expiréés**

```php
// ACTION 1: Créer une ALERTE (notification)
$event = $service->createExpirationAlert(
    $productStock,
    'alert_7days',
    'Détails...'
);

// ACTION 2: BLOQUER la consommation
$service->blockFromConsumption($productStock, 'Raison');

// ACTION 3: MARQUER COMME EXPIRÉ
$service->markAsExpired(
    $productStock,
    'Raison',
    $userId // qui a marqué
);

// OVERRIDE ADMIN: Consommer un produit expiré (cas d'urgence)
$service->forceConsumeExpired(
    productStock: $stock,
    quantity: 5,
    userId: $adminId,
    justification: 'Cas d\'urgence - justification...'
);
```

#### 3️⃣ **Requêtes & Rapports**

```php
// Liste paginée des produits expiréés
$expired = $service->getExpiredProducts(15); // 15 par page

// Liste des produits expirant bientôt
$expiring = $service->getExpiringProducts(7); // 7 jours

// Alertes en attente
$alerts = $service->getPendingAlerts(15);

// Historique complet
$history = $service->getExpirationHistory(50);

// Vérifier si un stock peut être consommé
$canConsume = $service->canBeConsumed($stock); // true/false

// Message d'expiration (pour affichage)
$message = $service->getExpirationStatus($stock);
// "❌ EXPIRÉ depuis 3 jour(s)"
// "⚠️ Expire dans 5 jour(s)"
// "✅ Valide"
```

## 🌐 API REST Endpoints

### Expirations

**Vérifier toutes les expirations (admin/cron)**
```http
POST /api/admin/expirations/check
```

**Lister les produits expiréés**
```http
GET /api/admin/expirations/expired?page=1&per_page=15
```

**Lister les produits expirant bientôt**
```http
GET /api/admin/expirations/expiring-soon?days=7
```

**Lister les alertes non traitées**
```http
GET /api/admin/expirations/alerts?page=1
```

**Historique complet des expirations**
```http
GET /api/admin/expirations/history?page=1&per_page=50
```

**Statistiques sur les expirations**
```http
GET /api/admin/expirations/stats
```

**Vérifier un stock particulier**
```http
GET /api/admin/product-stocks/{id}/expiration-status
```

**Marquer une alerte comme traitée**
```http
POST /api/admin/expirations/{id}/acknowledge
Content-Type: application/json

{
  "status": "acknowledged",  // ou "resolved", "ignored"
  "notes": "Notes optionnelles..."
}
```

**Admin: Forcer consommation d'un produit expiré**
```http
POST /api/admin/expirations/{stockId}/force-consume
Content-Type: application/json

{
  "quantity": 10,
  "justification": "Cas d'urgence - raison importante..."
}
```

## 🖥️ Commandes Artisan

```bash
# Vérifier toutes les expirations
php artisan expirations:check

# Avec détails verbeux
php artisan expirations:check --verbose

# Définir le seuil d'alerte (défaut: 7 jours)
php artisan expirations:check --days-before=10

# Nettoyer les vieux logs (> 12 mois)
php artisan expirations:cleanup --months=12
```

## 📋 Exemple d'Utilisation Complète

### Scénario: Un produit expirando

**Jour 1 (J-7):**
- Cron job appelle `expirations:check`
- Service détecte que batch expire dans 7 jours
- Alerte créée: `ExpirationEvent` avec `event_type='alert_7days'`
- Notification envoyée aux admins

**Jour 5 (J-3):**
- User essaie de consommer le produit
- Vérification: `$service->canBeConsumed($stock)` = true
- Peut toujours être consommé

**Jour 7 (J-0):**
- Cron job detects: AUJOURD'HUI C'EST LE JOUR
- Nouvelle alerte: `event_type='alert_expired'`
- Product bloqué: `batch_status = 'expired'`
- Tentative consommation = REJECT

**Jour 8 (J+1):**
- Cron job détecte: DÉPASSÉ
- Service crée: `event_type='marked_as_expired'`
- Stock archivé

**Si urgent: Admin override**
- Admin appelle: `POST /api/admin/expirations/{stockId}/force-consume`
- Justification obligatoire: "Cas d'urgence - patient critique"
- Consommation forcée logged comme: `event_type='consumed_expired'`
- Traçabilité complète conservée

## 🔐 Permissions Requises

```php
// Dans le middleware du contrôleur:
$this->middleware('permission:manage-stock');      // Lire les alertes
$this->middleware('permission:admin')->only([      // Forcer consommation
    'forceConsumeExpired',
    'acknowledgeAlert'
]);
```

## 📊 Integration avec ProductStock

**Le modèle ProductStock doit avoir:**

```php
class ProductStock extends Model {
    protected $fillable = [
        // ... existant
        'batch_number',
        'expiration_date',
        'batch_status',
        'last_expiration_check',
    ];

    // Relation avec ExpirationEvent
    public function expirationEvents()
    {
        return $this->hasMany(ExpirationEvent::class);
    }

    // Accesseur pour connaître l'état
    public function getIsExpiredAttribute()
    {
        return $this->batch_status === 'expired';
    }
}
```

## 🔔 Notifications (À implémenter)

Une notification devrait être envoyée lors:
1. **7 jours avant**: `ProductExpirationAlertSoon` (jaune ⚠️)
2. **Jour de l'expiration**: `ProductExpirationToday` (rouge 🔴)
3. **Consommation forcée**: `ProductForcedConsumption` (admin log)

## 📈 Rapports & KPIs

```php
$stats = $expirationService;

// Nombre total de produits expiréés
$totalExpired = ExpirationEvent::where('event_type', 'marked_as_expired')->count();

// Alertes non traitées
$pendingAlerts = ExpirationEvent::where('status', 'pending')->count();

// Produits expirant dans 7 jours
$expiringWeek = $service->getExpiringProducts(7)->count();

// Consommations forcées (audit)
$forcedConsumptions = ExpirationEvent::where('event_type', 'consumed_expired')->count();
```

## ⚠️ Points Importants

1. **Pas de suppression physique**: Les produits expiréés sont marqués `batch_status='expired'` et archivés, jamais supprimés
2. **Traçabilité totale**: Chaque action crée un `ExpirationEvent` audit
3. **Cron job quotidien**: Doit exécuter `expirations:check` chaque jour pour alertes à temps
4. **Permissions strictes**: Seul un admin peut forcer une consommation expiréée
5. **Notifications**: Implémentez des notifications pour les alertes urgentes

## 📥 Integration dans routes/api.php

```php
// Dans backend/routes/api.php
Route::middleware(['auth:sanctum', 'permission:manage-stock'])->group(function () {
    Route::prefix('/admin')->group(function () {
        // ... routes existantes
        
        // Ajouter les routes d'expiration
        include_once __DIR__ . '/expiration-routes.php';
    });
});
```

## 🎯 Prochaines Étapes

1. ✅ Migrer la base de données
2. ✅ Ajouter les modèles & service
3. ✅ Exposer les API endpoints
4. ⏳ Créer l'interface Angular (frontend)
5. ⏳ Implémenter les notifications
6. ⏳ Configurer le cron job
7. ⏳ Tester le workflow complet
