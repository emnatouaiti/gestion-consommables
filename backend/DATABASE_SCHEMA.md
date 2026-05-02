# 📊 Schéma Base de Données Complet

## Diagramme Entité-Relation

```
┌─────────────────────────────────────────────────────────┐
│ PRODUCTS                                                │
├─────────────────────────────────────────────────────────┤
│ PK  id                                                  │
│     status (active/inactive/archived)                  │
│     title                                               │
│     reference (unique)                                  │
│ FK  categorie_id                                        │
│     stock_quantity (agrégat)                            │
│     seuil_min                                           │
│     seuil_max                                           │
│     purchase_price                                      │
│     sale_price                                          │
│     unit                                                │
│     barcode_value                                       │
│     created_at / updated_at                             │
└─┬───────────────────────────────────────────────────────┘
  │
  │ 1───N (HasMany)
  │
  └─┬─────────────────────────────────────────────────────┐
    │                                                     │
┌───▼─────────────────────────────────────────────────────┐
│ PRODUCT_STOCKS (NOUVEAU)                               │
├──────────────────────────────────────────────────────────┤
│ PK  id                                                  │
│ FK  product_id                                          │
│ FK  warehouse_location_id                               │
│ FK  cabinet_id                                          │
│ FK  supplier_id                                         │
│     quantity                                            │
│                                                        │
│ 【CHAMPS D'EXPIRATION AJOUTÉS】                         │
│     batch_number (ex: LOT-2026-001)                     │
│     expiration_date (ex: 2026-06-30)                    │
│     batch_status (active|expired|disposed)              │
│     last_expiration_check                               │
│                                                        │
│     last_updated / created_at / updated_at              │
└─┬───────────────────────────────────────────────────────┘
  │
  │ 1───N (HasMany)
  │
  └─────────────────────────────────────────────────────────┐
                                                           │
┌──────────────────────────────────────────────────────────┐
│ EXPIRATION_EVENTS (TABLE D'AUDIT) 【NOUVELLE】          │
├──────────────────────────────────────────────────────────┤
│ PK  id                                                   │
│ FK  product_id                                           │
│ FK  product_stock_id                                     │
│     batch_number                                         │
│     expiration_date                                      │
│     quantity_affected                                    │
│     event_type:                                          │
│         • alert_7days                                    │
│         • alert_expired                                  │
│         • blocked_from_consumption                       │
│         • marked_as_expired                              │
│         • consumed_expired                               │
│         • disposed                                       │
│     status (pending|acknowledged|resolved|ignored)       │
│     action_details                                       │
│     notes                                                │
│ FK  created_by (User qui a créé l'événement)             │
│ FK  acknowledged_by (User qui a traité)                  │
│     acknowledged_at                                      │
│     created_at / updated_at                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ STOCK_MOVEMENTS (EXISTANT)                               │
├──────────────────────────────────────────────────────────┤
│ PK  id                                                   │
│     movement_type (in/out)                               │
│     status (planned|executed|validated)                  │
│ FK  created_by                                           │
│     executed_at / validated_by                           │
│     created_at / updated_at                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ CONSUMABLE_REQUESTS (EXISTANT)                           │
├──────────────────────────────────────────────────────────┤
│ PK  id                                                   │
│ FK  user_id                                              │
│ FK  product_id                                           │
│     requested_quantity                                   │
│     approved_quantity                                    │
│     status (pending|approved|rejected)                   │
│     batch_code (groupement logique)                      │
│     reject_reason                                        │
│     created_at / updated_at                              │
└──────────────────────────────────────────────────────────┘
```

## Détail des Colonnes

### 1. `product_stocks` - Champs d'Expiration

| Colonne | Type | Null | Default | Commentaire |
|---------|------|------|---------|------------|
| `id` | BIGINT | NO | AUTO | ID unique |
| `product_id` | BIGINT | NO | - | FK vers products |
| `warehouse_location_id` | BIGINT | NO | - | FK vers emplacements |
| `cabinet_id` | BIGINT | YES | NULL | FK vers cabinets |
| `supplier_id` | BIGINT | YES | NULL | FK vers fournisseurs |
| `quantity` | INT UNSIGNED | NO | 0 | Quantité en stock |
| `batch_number` | VARCHAR(255) | YES | NULL | N° de lot (LOT-2026-001) |
| `expiration_date` | DATE | YES | NULL | Date limite d'utilisation |
| `batch_status` | VARCHAR(50) | NO | 'active' | active \| expired \| disposed |
| `last_expiration_check` | TIMESTAMP | YES | NULL | Dernier scan auto |
| `last_updated` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Dernière modifi |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Peut dérouler |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Peut dérouler |

**Indices:**
```sql
UNIQUE KEY uk_batch (product_id, batch_number, warehouse_location_id)
INDEX idx_expiration_date (expiration_date)
INDEX idx_product_expiration (product_id, expiration_date)
INDEX idx_batch_status (batch_status)
INDEX idx_location (warehouse_location_id)
```

### 2. `expiration_events` - Table d'Audit Complète

| Colonne | Type | Null | Default | Commentaire |
|---------|------|------|---------|------------|
| `id` | BIGINT | NO | AUTO | ID unique |
| `product_id` | BIGINT | NO | - | FK vers products |
| `product_stock_id` | BIGINT | NO | - | FK vers product_stocks |
| `batch_number` | VARCHAR(255) | YES | NULL | Numéro de lot |
| `expiration_date` | DATE | NO | - | Date expiration du lot |
| `quantity_affected` | INT UNSIGNED | NO | - | Qty concernée par l'événement |
| `event_type` | ENUM | NO | - | Type d'événement (voir values) |
| `status` | ENUM | NO | 'pending' | État de l'alerte |
| `action_details` | TEXT | YES | NULL | Détails de l'action |
| `notes` | TEXT | YES | NULL | Notes additionnelles |
| `created_by` | BIGINT | YES | NULL | FK users (qui a créé) |
| `acknowledged_by` | BIGINT | YES | NULL | FK users (qui a traité) |
| `acknowledged_at` | TIMESTAMP | YES | NULL | Quand reconnu |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Peut dérouler |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Peut dérouler |

**ENUM event_type:**
- `alert_7days` - Alerte 7 jours avant
- `alert_expired` - Alerte jour de l'expiration
- `blocked_from_consumption` - Blocage après expiration
- `marked_as_expired` - Marqué comme expiré (archivage)
- `consumed_expired` - Consommé après expiration (admin override)
- `disposed` - Jeté/Destruction déchet

**ENUM status:**
- `pending` - En attente de traitement
- `acknowledged` - Reconnu par un admin
- `resolved` - Problème résolu
- `ignored` - Volontairement ignoré

**Indices:**
```sql
FOREIGN KEY fk_product (product_id) REFERENCES products(id)
FOREIGN KEY fk_product_stock (product_stock_id) REFERENCES product_stocks(id)
FOREIGN KEY fk_created_by (created_by) REFERENCES users(id)
FOREIGN KEY fk_acknowledged_by (acknowledged_by) REFERENCES users(id)

INDEX idx_product_id (product_id)
INDEX idx_event_type (event_type)
INDEX idx_status (status)
INDEX idx_expiration_date (expiration_date)
INDEX idx_created_at (created_at)
INDEX idx_pending (status, created_at) -- Pour requête rapide des alertes
FULLTEXT INDEX ft_notes (action_details, notes) -- Recherche texte
```

## Récapitulatif des Changements

### ✅ Migrations à Exécuter

1. **`2026_05_02_000001_add_expiration_fields_to_product_stocks.php`**
   - Ajoute colonnes d'expiration à `product_stocks`
   - Crée les indices

2. **`2026_05_02_000002_create_expiration_events_table.php`**
   - Crée la nouvelle table `expiration_events`
   - Crée tous les indices et FK

### ✅ Modèles à Ajouter

1. **`App\Models\ExpirationEvent`** (NOUVEAU)
   - Relations vers Product, ProductStock, User
   - Scopes pour requêtes rapides
   - Accesseurs pour état expiration

### ✅ Services à Ajouter

1. **`App\Services\ExpirationManagementService`** (NOUVEAU)
   - Gestion complete du cycle de vie
   - Détection, alertes, blocage, archivage
   - Requêtes & rapports

### ✅ Contrôleurs à Ajouter

1. **`App\Http\Controllers\API\ExpirationController`** (NOUVEAU)
   - Endpoints REST pour gérer les expirations
   - Scan automatique
   - Acknowledge & force-consume

### ✅ Commandes à Ajouter

1. **`App\Console\Commands\CheckExpirationsCommand`** (NOUVEAU)
   - Commande artisan `expirations:check`
   - À configurer en cron job

## Commandes SQL pour Créer les Tables

### Créer product_stocks avec expiration (directement)

```sql
-- Si vous ne voulez pas utiliser les migrations
ALTER TABLE product_stocks ADD COLUMN batch_number VARCHAR(255) NULL AFTER quantity;
ALTER TABLE product_stocks ADD COLUMN expiration_date DATE NULL AFTER batch_number;
ALTER TABLE product_stocks ADD COLUMN batch_status VARCHAR(50) DEFAULT 'active' AFTER expiration_date;
ALTER TABLE product_stocks ADD COLUMN last_expiration_check TIMESTAMP NULL AFTER batch_status;

CREATE INDEX idx_expiration_date ON product_stocks(expiration_date);
CREATE INDEX idx_product_expiration ON product_stocks(product_id, expiration_date);
CREATE INDEX idx_batch_status ON product_stocks(batch_status);
```

### Créer expiration_events

```sql
CREATE TABLE expiration_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    product_stock_id BIGINT NOT NULL,
    batch_number VARCHAR(255) NULL,
    expiration_date DATE NOT NULL,
    quantity_affected INT UNSIGNED NOT NULL,
    event_type ENUM(
        'alert_7days',
        'alert_expired',
        'blocked_from_consumption',
        'marked_as_expired',
        'consumed_expired',
        'disposed'
    ) NOT NULL,
    status ENUM('pending', 'acknowledged', 'resolved', 'ignored') DEFAULT 'pending',
    action_details TEXT NULL,
    notes TEXT NULL,
    created_by BIGINT NULL,
    acknowledged_by BIGINT NULL,
    acknowledged_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_stock FOREIGN KEY (product_stock_id) REFERENCES product_stocks(id) ON DELETE CASCADE,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_acknowledged_by FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_product_id (product_id),
    INDEX idx_event_type (event_type),
    INDEX idx_status (status),
    INDEX idx_expiration_date (expiration_date),
    INDEX idx_created_at (created_at),
    INDEX idx_pending (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Vérification des Données

```sql
-- Voir tous les stocks avec date d'expiration
SELECT 
    ps.id,
    p.title,
    ps.batch_number,
    ps.expiration_date,
    ps.batch_status,
    ps.quantity,
    DATEDIFF(ps.expiration_date, CURDATE()) as jours_restants,
    CASE 
        WHEN expiration_date < CURDATE() THEN '❌ EXPIRÉ'
        WHEN expiration_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN '⚠️ ALERTE'
        ELSE '✅ OK'
    END as statut
FROM product_stocks ps
JOIN products p ON p.id = ps.product_id
WHERE ps.expiration_date IS NOT NULL
ORDER BY ps.expiration_date ASC;

-- Voir les alertes non traitées
SELECT 
    ee.id,
    p.title,
    ee.batch_number,
    ee.event_type,
    ee.status,
    ee.created_at
FROM expiration_events ee
JOIN products p ON p.id = ee.product_id
WHERE ee.status = 'pending'
ORDER BY ee.created_at DESC;
```
