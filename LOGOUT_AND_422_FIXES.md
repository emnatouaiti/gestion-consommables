# Logout et Erreur 422 - Corrections Appliquées

## Problèmes Identifiés

### 1️⃣ **Problème de Déconnexion** - Redirection vers page "logout"

**Symptôme**: 
- Lors de la déconnexion, l'utilisateur se retrouve sur une page "logout" au lieu d'être redirigé vers la page de connexion.

**Cause Racine**:
- La méthode `logout()` dans `AuthService` attendait la réponse de l'API avant de naviguer vers `/login`
- Si l'API mettait du temps à répondre ou échouait, l'utilisateur restait sur la page courante
- Aucun route `/logout` n'était définie pour capturer une navigation directe vers cette URL

**Solutions Appliquées**:

#### 1.1 - Navigation Immédiate dans AuthService
✅ Fichier: `frontend/src/app/core/services/auth.service.ts`

**Avant:**
```typescript
logout() {
    this.apiService.post('logout').subscribe({
        next: () => this.purgeAuth(),
        error: () => this.purgeAuth()
    });
}
```

**Après:**
```typescript
logout() {
    // Navigate immediately to prevent being stuck on current page
    this.purgeAuth();
    // Then call the API to invalidate the session on the server
    this.apiService.post('logout').subscribe({
        next: () => {},
        error: () => {}
    });
}
```

**Effet**: 
- ✅ La navigation vers `/login` se fait immédiatement
- ✅ L'appel API est fait en arrière-plan pour invalider la session serveur
- ✅ L'utilisateur n'est plus bloqué sur la page courante

#### 1.2 - Route de Redirection /logout
✅ Fichier: `frontend/src/app/app-routing-module.ts`

**Ajout:**
```typescript
{ path: 'logout', redirectTo: 'login', pathMatch: 'full' },
```

**Effet**:
- ✅ Toute navigation directe vers `/logout` est redirigée vers `/login`
- ✅ Évite les URLs brisées ou les pages 404

---

### 2️⃣ **Erreur 422** - `/api/admin/documents`

**Symptôme**:
```
Failed to load resource: the server responded with a status of 422 (Unprocessable Content)
Http failure response for http://localhost:4200/api/admin/documents: 422 Unprocessable Content
```

**Cause Potentielle**:
- Problème avec les relations eager loading dans la requête
- Erreur de validation ou de requête dans le contrôleur
- Problème de permissions (mais devrait retourner 403)

**Solutions Appliquées**:

#### 2.1 - Amélioration du DocumentController@index
✅ Fichier: `backend/app/Http/Controllers/API/DocumentController.php`

**Améliorations:**
1. **Logging détaillé**: Ajout de logs pour les paramètres, user ID, et rôles
2. **Eager loading explicite**: Utilisation de fermetures pour les relations avec sélection de colonnes spécifiques
3. **Gestion d'erreurs améliorée**: Retourne plus de détails en cas d'erreur (ligne, fichier, message)
4. **Response explicite**: Utilise `response()->json($results, 200)` au lieu de retourner directement le modèle

**Nouvelle implémentation:**
```php
public function index(Request $request)
{
    try {
        Log::info('DocumentController@index reached', [
            'params' => $request->all(),
            'user' => auth()->id(),
            'user_roles' => auth()->user()?->roles ?? null,
        ]);

        $query = Document::query();

        // Only select specific columns from related models to avoid issues
        $query->with([
            'product' => function ($q) {
                $q->select('id', 'title', 'reference', 'has_expiration');
            },
            'supplier' => function ($q) {
                $q->select('id', 'name');
            },
            'warehouse' => function ($q) {
                $q->select('id', 'name');
            }
        ])->orderByDesc('id');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->input('product_id'));
        }

        $results = $query->limit(200)->get();
        Log::info('DocumentController@index results', ['count' => $results->count()]);
        return response()->json($results, 200);
    } catch (\Throwable $e) {
        Log::error('DocumentController@index error', [
            'msg' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'line' => $e->getLine(),
            'file' => $e->getFile(),
        ]);
        return response()->json([
            'message' => 'Erreur interne du serveur',
            'error' => $e->getMessage(),
            'line' => $e->getLine(),
        ], 500);
    }
}
```

**Effet**:
- ✅ Meilleure gestion des erreurs avec détails de debug
- ✅ Logs détaillés pour tracer les problèmes
- ✅ Sélection explicite des colonnes évite les problèmes de relations

---

## 📋 Fichiers Modifiés

| Fichier | Modification | Impact |
|---------|-------------|--------|
| `frontend/src/app/core/services/auth.service.ts` | Navigation immédiate avant appel API | Logout instantané |
| `frontend/src/app/app-routing-module.ts` | Route `/logout` → `/login` | Évite URLs brisées |
| `backend/app/Http/Controllers/API/DocumentController.php` | Amélioration index() avec logs et gestion d'erreurs | Meilleur debug 422 |

---

## 🔍 Comment Tester

### Test 1: Déconnexion
1. Se connecter à l'application
2. Cliquer sur le bouton de déconnexion (icône logout en haut à droite)
3. **Résultat attendu**: Redirection immédiate vers `/login`
4. Vérifier que l'utilisateur n'est pas bloqué sur une page "logout"

### Test 2:Erreur 422 Documents
1. Se connecter avec un utilisateur ayant le rôle: `Agent de stock`, `Agent`, `Responsable de stock`, `Responsable`, `Gestionnaire`, ou `Directeur`
2. Naviguer vers `/admin/documents-ocr`
3. **Résultat attendu**: La liste des documents se charge sans erreur 422
4. Si erreur 422 persiste, vérifier les logs Laravel:
   ```bash
   tail -f backend/storage/logs/laravel.log
   ```

### Test 3: Vérification des Logs
Si l'erreur 422 persiste, les logs devraient maintenant montrer:
- Les paramètres de la requête
- L'ID de l'utilisateur
- Les rôles de l'utilisateur
- Les détails complets de l'erreur (ligne, fichier, trace)

---

## 🛠️ Debugging Supplémentaire

Si les problèmes persistent:

```bash
# 1. Vérifier les logs Laravel
tail -f backend/storage/logs/laravel.log

# 2. Vérifier les permissions utilisateur
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/admin/documents

# 3. Vérifier que le user a les bons rôles
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/user

# 4. Vider le cache Laravel
cd backend
php artisan cache:clear
php artisan config:clear
php artisan route:clear

# 5. Redémarrer le backend
# Arrêter le serveur Laravel et le redémarrer

# 6. Vider le cache frontend
# Dans le navigateur: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
```

---

## ✅ Checklist de Validation

- [ ] Tester la déconnexion → devrait rediriger vers `/login` immédiatement
- [ ] Naviguer vers `/logout` manuellement → devrait rediriger vers `/login`
- [ ] Accéder à `/admin/documents-ocr` → devrait charger sans erreur 422
- [ ] Vérifier les logs Laravel pour voir les détails des requêtes
- [ ] Tester avec différents rôles utilisateurs

---

## 📝 Notes

1. **Logout**: La navigation se fait maintenant avant l'appel API pour éviter tout blocage. L'appel API est toujours fait en arrière-plan pour invalider la session côté serveur.

2. **422 Error**: Les logs détaillés devraient aider à identifier la cause exacte si l'erreur persiste. Les causes possibles incluent:
   - Problème de permissions (rôles)
   - Problème avec les relations du modèle Document
   - Problème de configuration de la base de données

3. **Intelephense Warnings**: Les avertissements dans `DocumentController.php` concernant `auth()` et `Imagick` sont des faux positifs de l'IDE. Ces fonctions existent au runtime.