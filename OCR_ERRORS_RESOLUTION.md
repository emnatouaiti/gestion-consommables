# Résolution des Erreurs OCR - Documents

## Erreurs Identifiées

### 1️⃣ **403 Forbidden** - `/api/admin/categories?status=active`

**Problème**: 
- Endpoint restreint aux rôles: `Responsable de stock`, `Responsable`, `Gestionnaire`
- Les agents OCR (`Agent de stock`, `Agent`) n'avaient pas accès
- Quand `loadCategories()` échoue, la liste devient vide
- L'utilisateur ne peut pas sélectionner une catégorie pour ajouter un produit inexistant
- Cela cause le 409 Conflict lors de l'application

**Solution Appliquée**:

#### 1.1 - Permissions Backend
✅ Fichier: `backend/routes/api.php` (ligne 150)

Avant:
```php
Route::middleware('role:Responsable de stock|Responsable|Gestionnaire')->group(function () {
```

Après:
```php
Route::middleware('role:Responsable de stock|Responsable|Gestionnaire|Agent de stock|Agent')->group(function () {
```

**Effet**: Les agents OCR ont maintenant accès à l'endpoint `/api/admin/categories`

#### 1.2 - Endpoint Public de Fallback
✅ Fichier: `backend/routes/api.php` (ligne 73)

Nouveau endpoint ajouté:
```php
// PUBLIC CATEGORIES - Accessible to authenticated users for OCR workflows
Route::middleware('auth:sanctum')->get('categories/public', [CategoryController::class, 'index']);
```

**Effet**: Point de secours si l'endpoint admin échoue

#### 1.3 - Frontend Fallback
✅ Fichier: `frontend/src/app/features/admin/documents/documents.component.ts`

Nouvelle méthode ajoutée: `loadCategoriesPublic()`

Logique:
1. Essaie `/api/admin/categories?status=active`
2. Si 403 ou erreur, tente `/api/categories/public?status=active`
3. En dernier recours, essaie le mode tree pour charger l'arborescence

**Effet**: L'utilisateur voit toujours les catégories, même sans permission admin

---

### 2️⃣ **409 Conflict** - `/api/admin/documents/{id}/apply`

**Problème**:
Le backend retourne 409 dans ces cas:
- Produits inactifs détectés
- Produits introuvables sans catégorie sélectionnée ← **LIÉ AU PROBLÈME 1**
- `auto_create_product = false` mais produit manquant

**Symptôme**: 
"Des produits sont introuvables. Choisissez une catégorie pour chacun."
→ Mais la liste des catégories est vide!

**Solution**: 
Voir la correction du problème #1 ci-dessus. Le 409 disparaîtra une fois que les catégories s'affichent.

**Visualisation du flux**:
```
1. Upload OCR PDF
   ↓
2. Produit introuvé → Modal pour sélectionner catégorie
   ↓
3. Besoin d'appeler loadCategories()
   ↓
4. (AVANT) 403 Forbidden → catégories = []
   (APRÈS) Fallback vers /api/categories/public → catégories remplies ✓
   ↓
5. Utilisateur sélectionne catégorie
   ↓
6. POST /api/admin/documents/{id}/apply
   ✓ Succès (200)
```

---

### 3️⃣ **404 Not Found** - Image `WOlAWbEAnsbIWi9ODEaOpmAqiENAGSVXV3HpNXkK.jpg`

**Problème**:
- Image de produit/catégorie manquante sur le serveur
- Fichier n'existe pas: `public/images/`

**Cause Probable**:
- URL brisée dans base de données
- Image supprimée mais référence restante
- Migration ou synchronisation incomplète

**Solutions**:

1. **Vérifier la BD**:
   ```sql
   SELECT id, title, image FROM categories WHERE image IS NOT NULL;
   SELECT id, title, image FROM products WHERE image IS NOT NULL;
   ```

2. **Nettoyer les références brisées**:
   ```sql
   -- Réinitialiser les images manquantes
   UPDATE categories SET image = NULL WHERE image IS NOT NULL 
   AND image NOT IN (SELECT DISTINCT image FROM categories WHERE image LIKE 'storage/%');
   ```

3. **Vérifier le stockage**:
   ```bash
   cd backend
   php artisan storage:link  # Recréer le symlink si nécessaire
   ls -la public/storage/
   ```

4. **Script de validation** (Optionnel):
   ```php
   // backend/check_images.php
   $products = Product::where('image', '!=', null)->get();
   foreach ($products as $p) {
       $path = 'public/' . $p->image;
       if (!file_exists($path)) {
           echo "Image manquante: {$p->image}\n";
       }
   }
   ```

---

## ✅ Checklist de Validation

- [ ] Redémarrer le serveur backend
- [ ] Vider le cache frontend (`Ctrl+Shift+R` ou `Cmd+Shift+R`)
- [ ] Tester avec un utilisateur ayant le rôle `Agent`
- [ ] Uprload un document OCR avec un produit inexistant
- [ ] Vérifier que la liste des catégories s'affiche
- [ ] Sélectionner une catégorie et appliquer
- [ ] Vérifier que l'application réussit (200 OK)

---

## 📋 Fichiers Modifiés

| Fichier | Modification | Ligne |
|---------|-------------|-------|
| `backend/routes/api.php` | Ajout rôles Agent au middleware categories | 150 |
| `backend/routes/api.php` | Nouveau endpoint public | 73 |
| `frontend/documents.component.ts` | Logique fallback | 93-137 |

---

## 🔍 Debugging Supplémentaire

Si les problèmes persistent:

```bash
# 1. Vérifier les permissions utilisateur
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/admin/categories
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/categories/public

# 2. Vérifier les logs
tail -f backend/storage/logs/laravel.log

# 3. Vérifier la config CORS
cat backend/config/cors.php
```

