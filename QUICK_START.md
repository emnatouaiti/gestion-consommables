# 🚀 DÉMARRAGE RAPIDE - Gestion des Consommables

## 5 Minutes pour Démarrer

### Étape 1: Backend (2 minutes)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

✅ **Backend en cours d'exécution sur**: `http://localhost:8000`

### Étape 2: Frontend (2 minutes)

```bash
cd frontend
npm install
ng serve --open
```

✅ **Frontend ouvert sur**: `http://localhost:4200`

### Étape 3: Test Rapide (1 minute)

1. **Créez un compte** (Register):
   - Nom complet: Votre Nom
   - Email: test@example.com
   - Mot de passe: password123

2. **Connexion** (Login):
   - Email: test@example.com
   - Mot de passe: password123

3. **Créez une demande**:
   - Article: "Papier A4"
   - Quantité: 100
   - ✓ Soumettre

4. **Vérifiez** que la demande apparaît dans la liste

---

## 🎯 Premier Cas d'Usage Complet

### Scénario: Un employé demande du papier, le responsable approuve

**1. EMPLOYÉ - Créer une demande**
```
1. Accédez à "Demandes de Consommables"
2. Remplissez:
   - Article: "Papier A4"
   - Quantité: 100
3. Cliquez "Soumettre la Demande"
✓ Notification envoyée au responsable
```

**2. RESPONSABLE - Approuver la demande**
```
1. Connectez-vous avec un compte Responsable
2. Allez à "Demandes de Consommables"
3. Voir la demande "Papier A4" (status: pending)
4. Cliquez "✓ Approuver"
✓ Demande approuvée avec quantité min(100, stock)
```

**3. EMPLOYÉ - Voir le résultat**
```
1. Reconnectez-vous en tant qu'employé
2. Votre demande passe à "Approved"
3. Quantité approuvée affichée
```

---

## 🔧 Dépannage Rapide

### Erreur 1: "Port 8000 déjà utilisé"
```bash
php artisan serve --port=8001
# Utilisez http://localhost:8001
```

### Erreur 2: "ng: command not found"
```bash
npm install -g @angular/cli@latest
```

### Erreur 3: "CORS error"
- Backend et Frontend doivent être sur des ports différents
- Les URL doivent correspondre en http/https

### Erreur 4: "Database connection failed"
Vérifiez .env:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=votre_base
DB_USERNAME=root
DB_PASSWORD=
```

---

## 📱 Tester Avec Postman

1. **Téléchargez Postman**: https://www.postman.com/downloads/

2. **Importez la collection**:
   ```
   Fichier → Import → Sélectionnez postman_collection.json
   ```

3. **Login d'abord**:
   ```
   1. Allez à "Authentication > Login"
   2. Envoyez la requête
   3. Copiez le token reçu
   4. Définissez la variable {{token}}
   ```

4. **Testez les endpoints**:
   ```
   - GET /api/consumable-requests
   - POST /api/consumable-requests
   - PUT /api/consumable-requests/1/approve
   ```

---

## 🔐 Rôles par Défaut

Après migration, créez des utilisateurs avec ces rôles:

### 1. Directeur
```php
$user = User::create([...]);
$user->assignRole('directeur');
// Peut: Voir toutes les demandes, approuver, rejeter
// Reçoit: 100% de la quantité
```

### 2. Responsable
```php
$user = User::create([...]);
$user->assignRole('responsable');
// Peut: Voir les demandes, approuver, rejeter
// Reçoit: min(demandé, stock)
```

### 3. Employé (Défaut)
```php
$user = User::create([...]);
// Peut: Créer des demandes
// Voit: Ses propres demandes
// Reçoit: min(demandé, stock)
```

---

## 📊 Flux de Travail Principal

```
Employé crée demande
        ↓
    [status: pending]
        ↓
Responsable reçoit notification
        ↓
    Responsable approuve/rejette
        ↓
[status: approved/rejected]
        ↓
Employé voit le résultat
```

---

## ⚙️ Configuration Commune

### Changer le port du backend
```bash
php artisan serve --host=0.0.0.0 --port=8001
```

### Changer le port du frontend
```bash
ng serve --port=4201
```

### Activer HTTPS en développement
```bash
php artisan serve --host=127.0.0.1 --port=8000 --secure
```

---

## 🧪 Test Complet (Automated)

```bash
# Dans le dossier backend
php artisan test

# Ou spécifiquement les demandes
php artisan test tests/Feature/ConsumableRequestTest.php
```

---

## 📞 Besoin d'Aide?

- 📖 Lire: `README_CONSUMABLES.md`
- 🔍 Détails: `CONSUMABLE_MANAGEMENT.md`
- ✓ Vérifier: `VERIFICATION.md`
- 🧪 Tests: `postman_collection.json`

---

## ✨ Vous Avez Terminé! 🎉

Le système est maintenant prêt à l'emploi. Bon développement!
