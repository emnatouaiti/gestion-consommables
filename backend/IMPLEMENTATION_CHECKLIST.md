# 🚀 Checklist d'Implémentation - Cycle de Vie des Produits

## ✅ Phase 1: Préparation & Migrations (Base de Données)

### Migrations Laravel
- [ ] **1️⃣ Migrer les colonnes d'expiration**
  - Fichier: `database/migrations/2026_05_02_000001_add_expiration_fields_to_product_stocks.php`
  - Commande: `php artisan migrate`
  - Vérifie: `batch_number`, `expiration_date`, `batch_status`, `last_expiration_check`

- [ ] **2️⃣ Créer la table d'événements d'expiration**
  - Fichier: `database/migrations/2026_05_02_000002_create_expiration_events_table.php`
  - Commande: `php artisan migrate`
  - Vérifie: All ENUMs et foreign keys

### Vérification Base de Données
```bash
# Vérifier les tables
php artisan tinker
>>> \DB::select('DESCRIBE product_stocks')
>>> \DB::select('DESCRIBE expiration_events')

# Ou en MySQL:
DESCRIBE product_stocks;
DESCRIBE expiration_events;
```

---

## ✅ Phase 2: Modèles & Services (Backend)

### Modèles
- [ ] **1️⃣ Créer le modèle `ExpirationEvent`**
  - Fichier: `app/Models/ExpirationEvent.php`
  - Vérifie: Relations (belongsTo), scopes, accesseurs
  - Test: `ExpirationEvent::count()` doit fonctionner

- [ ] **2️⃣ Mettre à jour le modèle `ProductStock`**
  - Fichier: `app/Models/ProductStock.php`
  - Ajouter: 
    ```php
    public function expirationEvents()
    {
        return $this->hasMany(ExpirationEvent::class);
    }
    ```
  - Tests: Les relations fonctionnent

### Services
- [ ] **1️⃣ Crear le service `ExpirationManagementService`**
  - Fichier: `app/Services/ExpirationManagementService.php`
  - Vérifie: Tous les 15+ méthodes implémentées
  - Tests unitaires (optionnel)

---

## ✅ Phase 3: Contrôleurs & Routes (API REST)

### Contrôleur
- [ ] **1️⃣ Créer le contrôleur `ExpirationController`**
  - Fichier: `app/Http/Controllers/API/ExpirationController.php`
  - Vérifie: Toutes les 7 actions
  - Tests: `php artisan route:list | grep expiration`

### Routes
- [ ] **1️⃣ Ajouter les routes dans `routes/api.php`**
  ```php
  // Dans routes/api.php (avant ou après les autres routes admin):
  Route::middleware(['auth:sanctum', 'permission:manage-stock'])->group(function () {
      include_once __DIR__ . '/expiration-routes.php';
  });
  ```

- [ ] **2️⃣ Vérifier toutes les routes**
  ```bash
  php artisan route:list | grep -i expiration
  # Doit afficher 8 routes
  ```

### Tests API (Postman/Insomnia)
- [ ] Test: `GET /api/admin/expirations/expired`
- [ ] Test: `GET /api/admin/expirations/expiring-soon?days=7`
- [ ] Test: `GET /api/admin/expirations/alerts`
- [ ] Test: `GET /api/admin/expirations/history`
- [ ] Test: `GET /api/admin/expirations/stats`
- [ ] Test: `POST /api/admin/expirations/check`

---

## ✅ Phase 4: Commandes Artisan

### Artisan Command
- [ ] **1️⃣ Crear la commande `CheckExpirationsCommand`**
  - Fichier: `app/Console/Commands/CheckExpirationsCommand.php`
  - Enregistrement automatique dans `kernel.php` si suivant les conventions Laravel
  - Teste: 
    ```bash
    php artisan expirations:check
    php artisan expirations:check --verbose
    ```

### Scheduler (Cron Job)
- [ ] **1️⃣ Configurer le scheduler**
  - Fichier: `app/Console/Kernel.php`
  - Ajouter dans `schedule()`:
    ```php
    $schedule->command('expirations:check --verbose')
        ->daily()  // À 00:00:00
        ->withoutOverlapping()  // Max 1 instance
        ->onFailure(function () {
            \Log::error('Expiration check failed!');
        });
    ```

### Cron Linux/Windows
- [ ] **1️⃣ Configurer le cron**
  ```bash
  # Linux: crontab -e
  * 0 * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
  
  # Ou directement:
  * 0 * * * cd /path/to/backend && php artisan expirations:check >> storage/logs/expirations.log 2>&1
  ```

---

## ✅ Phase 5: Tests Manuels

### Tests d'Expiration
- [ ] **Test 1: Créer un stock avec date d'expiration**
  ```bash
  # Créer un produit d'abord
  # POST /api/admin/products
  
  # Puis créer un stock avec expiration
  POST /api/admin/product-stocks
  {
    "product_id": 1,
    "warehouse_location_id": 1,
    "quantity": 50,
    "batch_number": "LOT-TEST-001",
    "expiration_date": "2026-05-09"  // 7 jours à partir d'aujourd'hui
  }
  ```

- [ ] **Test 2: Vérifier l'alerte 7 jours**
  ```bash
  # Exécuter le check
  php artisan expirations:check --verbose
  
  # Vérifier les alertes
  GET /api/admin/expirations/alerts
  # Doit voir: event_type='alert_7days', status='pending'
  ```

- [ ] **Test 3: Modifier la date d'expiration (simuler le temps)**
  ```php
  // Dans tinker
  $stock = ProductStock::find(1);
  $stock->update(['expiration_date' => now()->subDays(1)]);
  
  // Puis vérifier
  php artisan expirations:check
  
  // Doit créer: event_type='marked_as_expired'
  ```

- [ ] **Test 4: Tentative de consommation d'un produit expiré**
  ```bash
  # Vérifier d'abord si peut être consommé
  GET /api/admin/product-stocks/{id}/can-consume
  # Doit retourner: "can_consume": false
  
  # Essayer la consommation (doit être rejeté)
  POST /api/consumable-requests
  {
    "product_id": 1,
    "requested_quantity": 10
  }
  # Doit retourner 422 Unprocessable Entity
  ```

- [ ] **Test 5: Admin override (force-consume)**
  ```bash
  POST /api/admin/expirations/{stockId}/force-consume
  {
    "quantity": 5,
    "justification": "Patient critique - situation d'urgence"
  }
  # Doit créer: event_type='consumed_expired'
  ```

### Requêtes SQL de Vérification
```sql
-- Voir tous les stocks avec expiration
SELECT * FROM product_stocks WHERE expiration_date IS NOT NULL;

-- Voir les alertes non traitées
SELECT * FROM expiration_events WHERE status = 'pending';

-- Voir les produits expiréés
SELECT * FROM product_stocks WHERE batch_status = 'expired';

-- Historique complet
SELECT * FROM expiration_events ORDER BY created_at DESC;
```

---

## ✅ Phase 6: Frontend Angular (bonus)

### Service Angular
- [ ] **1️⃣ Créer le service `AdminExpirationService`**
  - Méthodes principales:
    - `getExpiredProducts()`
    - `getExpiringProducts(days)`
    - `getPendingAlerts()`
    - `acknowledgeAlert(id, status)`
    - `forceConsumeExpired(stockId, qty, justification)`

### Composants Angular
- [ ] **1️⃣ Dashboard - Afficher les alertes**
  - Widget: Nombre d'alertes en attente
  - Widget: Nombre de produits expiréés

- [ ] **2️⃣ Expired Products List**
  - Table paginée
  - Filtres (product_id, date range)
  - Actions (acknowledge, force-consume)

- [ ] **3️⃣ Expiring Soon Alert**
  - Afficher les 7 prochains jours
  - Badge rouge si aujourd'hui

- [ ] **4️⃣ Force Consume Modal**
  - Input: quantity
  - Textarea: justification obligatoire
  - Bouton confirm (admin only)

---

## ✅ Phase 7: Documentation & Maintenance

### Documentation
- [ ] ✅ Créé: `PRODUCT_LIFECYCLE_GUIDE.md`
- [ ] ✅ Créé: `DATABASE_SCHEMA.md`
- [ ] ✅ Créé: `INTEGRATION_EXAMPLES.php`
- [ ] [ ] Créer: README avec diagrammes

### Logs & Monitoring
- [ ] Vérifier les logs d'expiration: `storage/logs/expirations.log`
- [ ] Monitorer les erreurs Artisan chaque jour

### Maintenance Régulière
- [ ] Mensuel: Nettoyer les vieux enregistrements
  ```bash
  php artisan expirations:cleanup --months=12
  ```

---

## 📊 Résumé des Fichiers Créés

### Base de Données
✅ `database/migrations/2026_05_02_000001_add_expiration_fields_to_product_stocks.php`
✅ `database/migrations/2026_05_02_000002_create_expiration_events_table.php`

### Modèles
✅ `app/Models/ExpirationEvent.php`

### Services
✅ `app/Services/ExpirationManagementService.php`

### Contrôleurs
✅ `app/Http/Controllers/API/ExpirationController.php`

### Artisan
✅ `app/Console/Commands/CheckExpirationsCommand.php`

### Routes
✅ `routes/expiration-routes.php`

### Documentation
✅ `PRODUCT_LIFECYCLE_GUIDE.md`
✅ `DATABASE_SCHEMA.md`
✅ `INTEGRATION_EXAMPLES.php`

---

## 🎯 Estimé Temps d'Implémentation

| Phase | Tâche | Temps |
|-------|-------|-------|
| 1 | Migrations BD | 15 min |
| 2 | Modèles & Services | 30 min |
| 3 | Contrôleurs & Routes | 20 min |
| 4 | Artisan Commands | 15 min |
| 5 | Tests Manuels | 30 min |
| 6 | Frontend Angular | 2-3 h |
| **TOTAL** | | **4-5 heures** |

---

## 🆘 Dépannage Courant

### ❌ Erreur: "Class 'ExpirationEvent' not found"
```bash
# Solution: Vérifier que le fichier existe et que composer autoload est à jour
composer dump-autoload
php artisan config:cache
```

### ❌ Erreur: "Unknown column 'batch_number' in product_stocks"
```bash
# Solution: Migrations non exécutées
php artisan migrate --force
# Vérifier:
php artisan migrate:status
```

### ❌ Cron job n'exécute pas la commande
```bash
# Solution: Vérifier le scheduler
# 1. Vérifier que cron est en place
crontab -l

# 2. Vérifier les logs
tail -f storage/logs/laravel.log

# 3. Tester manuellement
php artisan schedule:work  # Mode test
```

### ❌ Alertes non créées automatiquement
```bash
# Solution: Vérifier que le scheduler s'exécute
# 1. Vérifier que la commande fonctionne
php artisan expirations:check --verbose

# 2. Vérifier que les dates d'expiration existent
mysql> SELECT COUNT(*) FROM product_stocks WHERE expiration_date IS NOT NULL;

# 3. Vérifier les logs
tail -f storage/logs/expirations.log
```

---

## ✨ Features Futur (v2.0)

- [ ] Notifications par email pour alertes urgentes
- [ ] Dashboard Filament pour gestion admin
- [ ] Export PDF des rapports d'expiration
- [ ] Graphiques de tendances (produits expiréés par mois)
- [ ] Intégration SMS pour alertes critiques
- [ ] API webhook pour systèmes externes
- [ ] Batch disposal tracking (où sont jetés les produits)

---

## 📞 Support & Questions

Pour des questions sur l'implémentation:
1. Vérifier la documentation du projet
2. Lire `PRODUCT_LIFECYCLE_GUIDE.md`
3. Vérifier `INTEGRATION_EXAMPLES.php` pour les exemples
4. Consulter les logs: `storage/logs/`

