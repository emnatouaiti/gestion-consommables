# Système de Gestion des Demandes de Consommables

## Vue d'ensemble

Ce système permet aux utilisateurs de demander des consommables, avec une gestion complète des rôles et des autorisations.

## Architecture

### Backend (Laravel)

#### Modèles
- **ConsumableRequest** : Gère les demandes de consommables
  - `user_id` : Référence l'utilisateur qui fait la demande
  - `product_id` : Référence le produit (optionnel)
  - `item_name` : Nom de l'article demandé
  - `requested_quantity` : Quantité demandée
  - `approved_quantity` : Quantité approuvée
  - `status` : État de la demande (pending, approved, rejected)

#### Contrôleur
- **ConsumableRequestController**
  - `index()` : Affiche les demandes selon le rôle
  - `store()` : Crée une nouvelle demande
  - `approve()` : Approuve une demande
  - `reject()` : Rejette une demande

#### Routes API
```
GET    /api/consumable-requests              - Lister les demandes
POST   /api/consumable-requests              - Créer une demande
PUT    /api/consumable-requests/{id}/approve - Approuver une demande
PUT    /api/consumable-requests/{id}/reject  - Rejeter une demande
```

#### Logique métier
- **Directeur** : Reçoit la quantité entière demandée
- **Responsable** : Peut approuver mais reçoit le minimum entre la demande et le stock
- **Employé** : Reçoit le minimum entre la demande et le stock disponible

### Frontend (Angular)

#### Composants
- **ConsumableRequestComponent** : Interface principale
  - Formulaire pour créer une demande
  - Tableau affichant toutes les demandes
  - Boutons pour approuver/rejeter (si autorisé)

#### Services
- **ConsumableRequestService** : Communication avec l'API
  - Inclut les en-têtes d'authentification
  - Gère les erreurs

## Installation et Configuration

### 1. Backend

```bash
# Dans le dossier backend
cd backend

# Appliquer les migrations
php artisan migrate

# Démarrer le serveur
php artisan serve
```

### 2. Frontend

```bash
# Dans le dossier frontend
cd frontend

# Installer les dépendances
npm install

# Démarrer le serveur de développement
ng serve
```

## Utilisation

### Créer une demande
1. Accédez à la page "Demandes de Consommables"
2. Remplissez le formulaire avec :
   - Nom de l'article
   - Quantité demandée
3. Cliquez sur "Soumettre la Demande"

### Approuver/Rejeter une demande
1. Connectez-vous avec un compte Responsable ou Directeur
2. Consultez la liste des demandes (statut : pending)
3. Cliquez sur "Approuver" ou "Rejeter"

## Règles de gestion

1. **Création** : Tout utilisateur authentifié peut créer une demande
2. **Approbation** : Seuls les Responsables et Directeurs
3. **Visibilité** :
   - Directeur : Voit toutes les demandes
   - Responsable : Voit toutes les demandes sauf les rejetées
   - Employé : Voit seulement ses propres demandes
4. **Quantités** :
   - Directeur : Obtient la quantité totale demandée
   - Responsable/Employé : Obtient le minimum entre ce qu'il demande et ce qui est en stock

## Statuts de demande

- **pending** : En attente d'approbation
- **approved** : Approuvée et traitée
- **rejected** : Rejetée

## Fonctionnalités supplémentaires

- Notifications par email aux responsables
- Historique des demandes
- Gestion des stocks intégrée
- Interface responsive
- Validation des formulaires côté client et serveur

## Dépannage

### Les routes ne répondent pas
```bash
# Vérifier que le serveur Laravel est en cours d'exécution
php artisan serve
```

### Erreurs d'authentification
```bash
# Vérifier que le token est bien stocké dans le localStorage/sessionStorage
# Vérifier que l'utilisateur a les rôles nécessaires
```

### Erreurs CORS
```bash
# Vérifier la configuration dans config/cors.php
# S'assurer que le frontend URL est dans les origins autorisées
```

## Améliorations futures

1. Ajouter un système de notifications en temps réel (WebSocket)
2. Ajouter un système de suivi des versions des demandes
3. Implémenter une api d'export des demandes en PDF/Excel
4. Ajouter un système de commentaires sur les demandes
5. Implémenter un système de rappels pour les demandes en attente
