# 📦 Système de Gestion des Consommables

Un système complet et fonctionnel pour gérer les demandes de consommables avec une architecture moderne basée sur Laravel et Angular.

## 🎯 Objectifs

✅ Permettre aux utilisateurs de demander des consommables  
✅ Permettre aux responsables d'approuver ou rejeter les demandes  
✅ Gérer les quantités selon les rôles  
✅ Notifier les responsables des nouvelles demandes  
✅ Afficher l'historique des demandes

## 🏗️ Architecture

```
gestion-consommables/
├── backend/                 # API Laravel avec Sanctum
│   ├── app/
│   │   ├── Models/
│   │   │   └── ConsumableRequest.php
│   │   ├── Http/Controllers/
│   │   │   └── ConsumableRequestController.php
│   │   └── Notifications/
│   │       └── ConsumableRequestNotification.php
│   ├── database/migrations/
│   │   └── create_consumable_requests_table.php
│   ├── routes/
│   │   └── api.php
│   └── tests/
│       └── Feature/ConsumableRequestTest.php
│
├── frontend/                # Application Angular
│   ├── src/app/
│   │   ├── consumable-request/
│   │   │   ├── consumable-request.ts
│   │   │   ├── consumable-request.html
│   │   │   ├── consumable-request.css
│   │   │   └── consumable-request.spec.ts
│   │   ├── services/
│   │   │   └── consumable-request.service.ts
│   │   └── layout/
│   │       ├── layout.ts
│   │       └── layout.html
│   └── angular.json
│
├── CONSUMABLE_MANAGEMENT.md  # Documentation technique
├── VERIFICATION.md            # Checklist de vérification
└── postman_collection.json   # Tests API
```

## 🚀 Démarrage Rapide

### Backend

```bash
cd backend

# Installer les dépendances
composer install

# Configurer l'environnement
cp .env.example .env
php artisan key:generate

# Appliquer les migrations
php artisan migrate

# Démarrer le serveur
php artisan serve
# Server running at http://127.0.0.1:8000
```

### Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Démarrer le serveur de développement
ng serve --open
# Application available at http://localhost:4200
```

## 👥 Rôles et Permissions

### 🔑 Directeur
- Voir toutes les demandes
- Approuver les demandes
- Rejeter les demandes
- Reçoit 100% de la quantité demandée

### 📋 Responsable
- Voir les demandes en attente et approuvées
- Approuver les demandes
- Rejeter les demandes
- Reçoit le min(demandé, stock)

### 👤 Employé
- Créer des demandes
- Voir ses propres demandes
- Reçoit le min(demandé, stock)

## 📱 Interface Utilisateur

### Employé - Créer une Demande
1. Accédez à la page "Demandes de Consommables"
2. Remplissez le formulaire :
   - **Article** : Nom du produit (minimum 3 caractères)
   - **Quantité** : Nombre requis (minimum 1)
3. Cliquez sur "Soumettre la Demande"
4. Confirmez l'envoi via le message de feedback

### Responsable - Gérer les Demandes
1. Consultez la liste des demandes en attente (status: pending)
2. Cliquez sur :
   - **✓ Approuver** : Approuve la demande
   - **✗ Rejeter** : Rejette la demande
3. Le statut change immédiatement

## 🔗 API Endpoints

### Authentification
```bash
POST /api/register
POST /api/login
```

### Demandes de Consommables
```bash
# Toutes les demandes (filtrées selon le rôle)
GET /api/consumable-requests
Headers: Authorization: Bearer {token}

# Créer une demande
POST /api/consumable-requests
Headers: Authorization: Bearer {token}
Body: {
  "item_name": "Papier A4",
  "requested_quantity": 100
}

# Approuver une demande
PUT /api/consumable-requests/{id}/approve
Headers: Authorization: Bearer {token}

# Rejeter une demande
PUT /api/consumable-requests/{id}/reject
Headers: Authorization: Bearer {token}
```

## 📊 Statuts de Demande

| Statut | Description | Actions possibles |
|--------|-------------|-------------------|
| `pending` | En attente d'approbation | Approuver / Rejeter |
| `approved` | Approuvée et traitée | Aucune |
| `rejected` | Rejetée | Aucune |

## 🔐 Sécurité

- ✅ Authentification par Sanctum (Laravel)
- ✅ Contrôle d'accès basé sur les rôles (RBAC)
- ✅ Validation des entrées côté client et serveur
- ✅ Protection CORS
- ✅ Hachage des mots de passe avec bcrypt
- ✅ Tokens d'authentification sécurisés

## 🧪 Tests

### Exécuter les Tests
```bash
cd backend
php artisan test tests/Feature/ConsumableRequestTest.php
```

### Cas de Test Couverts
- ✅ Création de demande par un utilisateur
- ✅ Approbation par un responsable
- ✅ Quantités accordées au directeur
- ✅ Rejet de demande
- ✅ Permissions d'accès
- ✅ Authentification
- ✅ Filtre par rôle

## 📧 Notifications

Les responsables et directeurs reçoivent une notification par email quand :
- Une nouvelle demande est créée
- Contient les détails : article, quantité, demandeur

## 🌐 Tester Avec Postman

1. Importez le fichier `postman_collection.json`
2. Définissez la variable `token` après login
3. Testez chaque endpoint

## 📈 Améliorations Possibles

- [ ] Système de commentaires sur les demandes
- [ ] Export des demandes en PDF/Excel
- [ ] Notifications en temps réel (WebSocket)
- [ ] Suivi des versions des demandes
- [ ] Système de rappels automatiques
- [ ] Tableau de bord d'analyse
- [ ] Configuration des quantités maximales par rôle
- [ ] Intégration avec le système d'inventaire

## 🐛 Dépannage

### Erreur : "Could not open input file: artisan"
```bash
# Assurez-vous d'être dans le dossier backend
cd backend
php artisan serve
```

### Erreur CORS
Vérifiez `backend/config/cors.php` et assurez-vous que l'URL du frontend est autorisée.

### Erreur d'authentification
Vérifiez que le token est bien stocké en localStorage et que l'utilisateur a les rôles corrects.

## 📞 Support

Pour plus d'informations, consultez :
- `CONSUMABLE_MANAGEMENT.md` - Guide technique détaillé
- `VERIFICATION.md` - Checklist de configuration
- `backend/tests/Feature/ConsumableRequestTest.php` - Exemples d'utilisation

## 📄 Licence

Ce projet est fourni à titre d'exemple éducatif.

---

**Version**: 1.0.0  
**Date**: 26 février 2026  
**Status**: ✅ Production Ready
