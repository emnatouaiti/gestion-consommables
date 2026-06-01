# 🎯 États & Transitions des Produits

## Diagramme d'États

```
                              ┌──────────────────────────────────────────────────┐
                              │        CRÉATION STOCK                            │
                              │  (ProductStock créé)                             │
                              │  ├─ batch_number: LOT-001                        │
                              │  ├─ quantity: 50                                 │
                              │  └─ expiration_date: 2026-06-30                  │
                              └──────────────────────────────────────────────────┘
                                             │
                                             ▼
                    ┌────────────────────────────────────────┐
                    │     ÉTAT: STOCK ACTIF ✅              │
                    │  batch_status = 'active'              │
                    │  expiration_date > today + 7 jours    │
                    │  quantity > 0                          │
                    │  can_be_consumed = TRUE               │
                    └────────────────────────────────────────┘
                        │                              │
         ┌──────────────┴──────────────┬───────────────┴──────────────┐
         │                             │                              │
    [PASSAGE DU TEMPS]         [CONSOMMATION]               [STOCK = 0]
    OR                                │                         │
    [CRON DÉTECTE]                    ▼                         ▼
         │              ┌──────────────────────────┐   ┌────────────────┐
         │              │ CONSOMMATION APPROUVÉE   │   │  STOCK ZÉRO    │
         │              │ quantity -= requested    │   │  quantity = 0  │
         │              │ create STOCK_MOVEMENT    │   │  Alerte réappro│
         │              └──────────────────────────┘   └────────────────┘
         │                                                            │
         │                                                    [Attendre nouvelle entrée]
         │                                                            │
         ▼
    ┌─────────────────────────────────────────┐
    │  ALERTE: À 7 JOURS AVANT EXPIRATION  ⚠️  │
    │                                        │
    │  event_type = 'alert_7days'            │
    │  status = 'pending'                    │
    │  create ExpirationEvent                │
    │  → Notifier admins                     │
    └─────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    [NOTHING HAPPENS]      [CRON JOUR 8]
    (Still valid)               │
         │                       ▼
         │     ┌──────────────────────────────┐
         │     │  ALERTE: JOUR DE L'EXPIRATION│
         │     │  ⏰ AUJOURD'HUI C'EST LE JOUR│
         │     │                             │
         │     │  event_type = 'alert_expired'│
         │     │  status = 'pending'         │
         │     │  → Notifier URGENT          │
         │     └──────────────────────────────┘
         │                                │
         └────────────────┬───────────────┘
                          ▼
         ┌──────────────────────────────────┐
         │     ÉTAT: PRODUIT EXPIRÉ ❌      │
         │  batch_status = 'expired'        │
         │  expiration_date ≤ today         │
         │  can_be_consumed = FALSE         │
         │                                  │
         │  event_type = 'marked_as_expired'│
         │  status = 'acknowledged'         │
         └──────────────────────────────────┘
                          │
             ┌────────────┴────────────────┐
             │                            │
         [URGENT]                   [NORMAL]
         [NEEDED]                  [PEUT JETER]
             │                            │
             ▼                            ▼
    ┌──────────────────────┐   ┌──────────────────┐
    │ ADMIN OVERRIDE NEEDED│   │  ARCHIVAGE       │
    │                      │   │  Status: ARCHIVED│
    │ POST /force-consume  │   │  Conservation    │
    │ + justification      │   │  (historique)    │
    │                      │   │                  │
    │ → Débloquer accès    │   │  Requête future  │
    │ → Audit log complet  │   │  = lecture seul  │
    └──────────────────────┘   └──────────────────┘
             │
    [CONSOMMATION FORCÉE]
             │
             ▼
    ┌──────────────────────────────────┐
    │  event_type = 'consumed_expired' │
    │  Traçabilité: Qui, Quand, Pourquoi│
    │  Status: ACKNOWLEDGED            │
    │  Audit trail complet             │
    └──────────────────────────────────┘
```

---

## Tableau des États & Actions

| État | Statut | Colonne | Desc | Peut Consommer? | Actions Possibles |
|------|--------|--------|------|---|---|
| **ACTIF** | active | green | Valide, tout OK | ✅ OUI | Consommer, Consulter |
| **⚠️ 7j° AVANT** | active | yellow | Alerte ≤7j | ✅ OUI | Consommer, Accuser réception |
| **🔴 JOUR EXP** | active | orange | Aujourd'hui! | ✅ OUI (dernier jour) | Consommer, Accuser réception |
| **❌ EXPIRÉ** | expired | red | Après expiration | ❌ NON | Admin override seulement |
| **📚 ARCHIVÉ** | archived | gray | Historique | ❌ NON | Consulter historique |

---

## Table de Transition d'États

```
┌──────────────────┬─────────────────┬────────────────┬─────────────────────┐
│ ÉTAT COURANT     │ CONDITION       │ NOUVEL ÉTAT    │ ÉVÉNEMENT CRÉÉ      │
├──────────────────┼─────────────────┼────────────────┼─────────────────────┤
│ ACTIVE           │ exp_date > now  │ ACTIVE         │ (rien)              │
│ ACTIVE           │ now ≤ exp < 7j  │ ACTIVE         │ alert_7days         │
│ ACTIVE           │ exp_date today  │ ACTIVE         │ alert_expired       │
│ ACTIVE           │ exp_date < now  │ EXPIRED        │ blocked_from_use    │
│                  │                 │                │ marked_as_expired   │
├──────────────────┼─────────────────┼────────────────┼─────────────────────┤
│ EXPIRED          │ admin req       │ CONSUMED       │ consumed_expired    │
│ EXPIRED          │ manual request  │ ARCHIVED       │ (aucun)             │
├──────────────────┼─────────────────┼────────────────┼─────────────────────┤
│ ARCHIVED         │ (final)         │ ARCHIVED       │ (aucun)             │
└──────────────────┴─────────────────┴────────────────┴─────────────────────┘
```

---

## Propriétés des États

### 1️⃣ État: ACTIF (batch_status = 'active')
```php
// Propriétés
database:
  - batch_status = 'active'
  - expiration_date: quelconque ou NULL
  - quantity: quelconque

code:
  - canBeConsumed() = true
  - isExpired() = false
  - isExpiringSoon() = depends on date

// Accès
✅ Consommable
✅ Visible dans inventaire
✅ Peut être transféré

// Événements générés
- alert_7days (si expiration ≤ 7j)
- alert_expired (si expiration = today)
```

### 2️⃣ État: EXPIRÉ (batch_status = 'expired')
```php
// Propriétés
database:
  - batch_status = 'expired'
  - expiration_date: < today
  - quantity: n'importe

code:
  - canBeConsumed() = false
  - isExpired() = true
  - getExpirationStatus() = "❌ EXPIRÉ depuis X jours"

// Accès
❌ Non consommable (sans override)
✅ Visible mais marqué comme expiré
❌ Ne peut pas être transféré

// Événements générés
- blocked_from_consumption
- marked_as_expired
```

### 3️⃣ État: ARCHIVED (Status change not yet)
```php
// Future implémentation
database:
  - product.status = 'archived' (ou product_stocks.status)
  - expirationEvents conservées
  - quantity: 0

code:
  - canBeConsumed() = false
  - getStatus() = "📚 ARCHIVÉ"

// Accès
❌ Non consommable
✅ Visible en historique/rapports
❌ Caché du stock actif
```

---

## Flux Temporel: Exemple Concret

```
JOUR 1 (création):
  Admin crée stock LOT-001
  batch_status = 'active'
  quantity = 50
  expiration_date = 2026-05-23 (22 jours plus tard)
  → Aucun événement créé

JOUR 16 (8 jours avant):
  Cron: expirations:check
  Détecte: expiration_date - today = 7 jours (seuil atteint!)
  Action: createExpirationAlert() avec event_type='alert_7days'
  Résultat: ExpirationEvent créé
  Status: PENDING → admin doit accuser réception

JOUR 17-22:
  Employee essaie ConsumableRequest: LOT-001
  Vérification: canBeConsumed(stock) = true
  Action: APPROUVÉ ✅
  Mouvement: quantity = 50 → 45

JOUR 23 (JOUR DE L'EXPIRATION):
  Cron: expirations:check
  Détecte: expiration_date == today
  Action: createExpirationAlert() avec event_type='alert_expired'
  Status: batch_status toujours 'active' (pas encore expiré)
  Dernière chance: employee peut encore ConsumableRequest
  Résultat: APPROUVÉ (mais un seul jour!)

JOUR 24 (LENDEMAIN):
  Cron: expirations:check
  Détecte: expiration_date < today
  Action: markAsExpired()
  update product_stocks SET batch_status = 'expired'
  Événement: event_type = 'blocked_from_consumption'
  Résultat: canBeConsumed(stock) = false

JOUR 25-29:
  Employee essaie ConsumableRequest: LOT-001
  Vérification: canBeConsumed(stock) = false
  Action: REJETÉ ❌
  Raison: "Ce produit est expiré et ne peut pas être consommé"
  
  Exception: Admin peut forcer avec justification
  POST /force-consume
  Justification: "Patient critique - situation d'urgence"
  Résultat: quantity réduite, audit trail créé

JOUR 30+:
  Stock toujours marqué EXPIRÉ
  Rien ne change
  Peut être consulté en historique
  Les analytics peuvent calculer: "30 jours d'inaction"
```

---

## Expirations Spéciales

### Cas 1: Pas de Date d'Expiration
```
Propriétés:
  expiration_date = NULL
  
Comportement:
  isExpired() = false
  isExpiringSoon() = false
  canBeConsumed() = true (toujours)
  Aucun événement créé
  
Utilisation:
  Produits: papier, stylos, équipements durables
```

### Cas 2: Produit Sans Batch
```
Propriétés:
  batch_number = NULL
  expiration_date = quelconque
  
Comportement:
  Suivi quand même par stock.id
  expirationEvents.batch_number = NULL
  
Utilisation:
  Transition/migration de données
```

### Cas 3: Consumption Forcée (Admin Override)
```
Propriétés:
  event_type = 'consumed_expired'
  
Audit Trail:
  - created_by = admin_id
  - justification = "Patient critique..."
  - quantity = consommée
  
Rapport:
  "Produit consommé après expiration"
  "Responsable: [admin]"
  JA "Justification: [raison]"
```

---

## Alertes vs Événements

### Alertes (ExpirationEvent)
```
TYPE: alert_7days
├─ 7 jours avant l'expiration
├─ Status: PENDING
├─ Action: Notifier les utilisateurs
├─ Peut être ignorée

TYPE: alert_expired
├─ Le jour de l'expiration
├─ Status: PENDING
├─ Action: Notifier URGENT
├─ C'est le dernier jour!

TYPE: alert_acknowledged
├─ Admin a vu et traité
├─ Status: ACKNOWLEDGED
├─ Action: Archiver l'alerte
├─ Trace: Qui a traité, quand
```

### Événements Système (ExpirationEvent)
```
TYPE: blocked_from_consumption
├─ Créé automatiquement après l'expiration
├─ Status: ACKNOWLEDGED
├─ Action: Interdire la consommation
├─ Non-reversible

TYPE: marked_as_expired
├─ Marquage de l'archivage
├─ Status: ACKNOWLEDGED
├─ Action: Archiver le stock
├─ Final

TYPE: consumed_expired
├─ Override admin seulement
├─ Status: ACKNOWLEDGED
├─ Action: Logger l'exception
├─ Trace complète requise
```

---

## Queries SQL Par État

```sql
-- ÉTATS ACTIFS
SELECT * FROM product_stocks 
WHERE batch_status = 'active' AND quantity > 0;

-- EXPIRANT BIENTÔT (7 jours)
SELECT * FROM product_stocks 
WHERE batch_status = 'active' 
AND expiration_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)
AND expiration_date > NOW();

-- EXPIRÉÉS
SELECT * FROM product_stocks 
WHERE batch_status = 'expired';

-- ALERTES EN ATTENTE
SELECT * FROM expiration_events 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- HISTORIQUE: Qui a consommé un produit expiré?
SELECT * FROM expiration_events 
WHERE event_type = 'consumed_expired' 
ORDER BY created_at DESC;

-- RAPPORT MENSUEL: Combien de produits expiréés?
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as expired_count
FROM expiration_events
WHERE event_type = 'marked_as_expired'
GROUP BY month
ORDER BY month DESC;
```

---

## Intégration Frontend: Affichage des États

```typescript
// Component TypeScript
export class StockStatusComponent {
  getStatusBadge(stock: ProductStock): BadgeConfig {
    if (!stock.expiration_date) {
      return { label: 'Sans Expiration', color: 'gray' };
    }

    const service = this.expirationService;
    
    if (service.isExpired(stock.expiration_date)) {
      return { 
        label: '❌ Expiré', 
        color: 'red',
        tooltip: service.getExpirationStatus(stock)
      };
    }

    if (service.isExpiringSoon(stock.expiration_date)) {
      const days = stock.expiration_date.diffInDays(now());
      return { 
        label: `⚠️ Expire ${days}j`, 
        color: 'yellow' 
      };
    }

    return { 
      label: '✅ Valide', 
      color: 'green' 
    };
  }

  canConsume(stock: ProductStock): boolean {
    return this.expirationService.canBeConsumed(stock);
  }
}

// HTML Template
<ng-container [ngSwitch]="getStatusBadge(stock).color">
  <span class="badge badge-success" *ngSwitchCase="'green'">
    {{ getStatusBadge(stock).label }}
  </span>
  <span class="badge badge-warning" *ngSwitchCase="'yellow'">
    {{ getStatusBadge(stock).label }}
  </span>
  <span class="badge badge-danger" *ngSwitchCase="'red'">
    {{ getStatusBadge(stock).label }}
  </span>
  <span class="badge badge-secondary" *ngSwitchCase="'gray'">
    {{ getStatusBadge(stock).label }}
  </span>
</ng-container>

<!-- Désactiver bouton consommation si expiré -->
<button 
  [disabled]="!canConsume(stock)"
  (click)="onConsume(stock)"
>
  Consommer
</button>
```

