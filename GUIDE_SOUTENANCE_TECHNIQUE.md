# 🎓 Guide de Soutenance Technique - Gestion des Consommables

**Document préparé pour la soutenance technique du projet de gestion des consommables**

---

## 📋 Table des Matières

1. [Architecture Générale](#architecture-générale)
2. [Gestion des PDF](#gestion-des-pdf)
3. [Gestion des Fichiers Excel](#gestion-des-fichiers-excel)
4. [Description et Ajout de Produits](#description-et-ajout-de-produits)
5. [OCR - Reconnaissance Optique de Caractères](#ocr---reconnaissance-optique-de-caractères)
6. [Authentification](#authentification)
7. [Visualisation 3D](#visualisation-3d)
8. [Gestion des Emails](#gestion-des-emails)
9. [Tableaux de Bord par Profil](#tableaux-de-bord-par-profil)

---

## 🏗️ Architecture Générale

### Stack Technique

**Backend (Laravel)**
- Framework: Laravel 11
- Base de données: MySQL
- Authentification: Laravel Sanctum (tokens API)
- OCR: Tesseract OCR
- Export: CSV/Excel compatible

**Frontend (Angular)**
- Framework: Angular 17+
- Visualisation 3D: Three.js
- UI: Composants personnalisés
- Services: HTTP Client avec intercepteurs

**Intégrations Externes**
- Google OAuth2 (Socialite)
- Gemini AI (génération de descriptions)
- Tesseract OCR (traitement local)

---

## 📄 Gestion des PDF avec Laravel Mailable

### Outil Utilisé
- **Laravel Mailable** (Système d'emails Laravel)
- **Blade Templates** (Templates de vues Laravel)

### Fichiers Impliqués

- `backend/app/Mail/NouvelleDemandePDF.php`
- `backend/app/Mail/ReturnToSupplierMail.php`
- `backend/app/Http/Controllers/Stock/ConsumableRequestController.php`

### Fonctionnement

**1. Génération de PDF pour les Demandes**

```php
// NouvelleDemandePDF.php
public function build()
{
    return $this->subject('Nouvelle demande de consommable')
        ->view('emails.nouvelle_demande')
        ->attach($this->pdfPath, [
            'as' => 'demande.pdf',
            'mime' => 'application/pdf',
        ]);
}
```

**2. Génération de PDF pour les Retours Fournisseurs**

```php
// ReturnToSupplierMail.php
public function build()
{
    $mail = $this->subject('Notification de Retour de Marchandise - Lot Expire')
                ->view('emails.return_supplier');

    if (file_exists($this->pdfPath)) {
        $mail->attach($this->pdfPath, [
            'as' => 'Bon_de_Retour_' . $this->stock->batch_number . '.pdf',
            'mime' => 'application/pdf',
        ]);
    }

    return $mail;
}
```

**3. Stockage des PDF**

- Les PDF sont stockés dans le système de fichiers Laravel (`storage/app/public`)
- Le chemin est enregistré en base de données
- Accès via l'API REST avec téléchargement direct

### Cas d'Usage

- **Demandes de consommables**: PDF généré automatiquement lors de la création
- **Retours fournisseurs**: PDF de bon de retour généré pour les produits expirés
- **Documents OCR**: PDF attachés aux notifications de validation

---

## 📊 Gestion des Fichiers Excel avec Laravel StreamedResponse

### Outil Utilisé
- **Laravel StreamedResponse** (Génération de fichiers à la volée)
- **PHP fputcsv** (Écriture CSV)
- **UTF-8 BOM** (Compatibilité Excel)

### Fichier Impliqué

- `backend/app/Http/Controllers/Admin/ReportController.php`

### Fonctionnement

**1. Export du Stock en CSV (Excel compatible)**

```php
public function exportStock(Request $request)
{
    $products = Product::query()
        ->where('status', 'active')
        ->with(['category', 'unit'])
        ->get();

    $response = new StreamedResponse(function () use ($products) {
        $handle = fopen('php://output', 'w');
        
        // Add UTF-8 BOM for Excel compatibility
        fputs($handle, "\xEF\xBB\xBF");
        
        fputcsv($handle, [
            'ID', 'Titre', 'Reference', 'Categorie',
            'Quantite en Stock', 'Seuil Min', 'Seuil Max', 'Status'
        ], ';');

        foreach ($products as $product) {
            $status = 'Normal';
            if ($product->stock_quantity == 0) {
                $status = 'Rupture';
            } elseif ($product->seuil_min && $product->stock_quantity < $product->seuil_min) {
                $status = 'Faible';
            }

            fputcsv($handle, [
                $product->id,
                $product->title,
                $product->reference,
                $product->category ? $product->category->title : 'N/A',
                $product->stock_quantity,
                $product->seuil_min,
                $product->seuil_max,
                $status
            ], ';');
        }

        fclose($handle);
    });

    $response->headers->set('Content-Type', 'text/csv; charset=utf-8');
    $response->headers->set('Content-Disposition', 'attachment; filename="rapport_stock_' . date('Y-m-d') . '.csv"');

    return $response;
}
```

**2. Export des Mouvements de Stock**

```php
public function exportMovements(Request $request)
{
    $movements = StockMovement::with(['creator', 'lines.product', 'supplier'])->latest()->get();

    $response = new StreamedResponse(function () use ($movements) {
        $handle = fopen('php://output', 'w');
        
        // Add UTF-8 BOM
        fputs($handle, "\xEF\xBB\xBF");
        
        fputcsv($handle, [
            'ID', 'Reference', 'Type', 'Status',
            'Cree Par', 'Fournisseur', 'Date', 'Produits (Lignes)'
        ], ';');

        foreach ($movements as $m) {
            $linesDesc = $m->lines->map(function ($line) {
                $pt = $line->product ? $line->product->title : 'Produit inconnu';
                return $pt . ' (x' . $line->quantity . ')';
            })->implode(', ');

            fputcsv($handle, [
                $m->id,
                $m->reference,
                $m->movement_type ?? $m->type,
                $m->status,
                $m->creator ? ($m->creator->nomprenom ?: $m->creator->name) : 'N/A',
                $m->supplier ? $m->supplier->name : 'N/A',
                $m->created_at->format('Y-m-d H:i:s'),
                $linesDesc
            ], ';');
        }

        fclose($handle);
    });

    $response->headers->set('Content-Type', 'text/csv; charset=utf-8');
    $response->headers->set('Content-Disposition', 'attachment; filename="rapport_mouvements_' . date('Y-m-d') . '.csv"');

    return $response;
}
```

### Caractéristiques Techniques

- **Format CSV** avec séparateur `;` (standard Excel français)
- **UTF-8 BOM** pour compatibilité Excel
- **StreamedResponse** pour gérer les gros fichiers
- **Calcul automatique du statut** (Normal, Faible, Rupture)
- **Jointures optimisées** avec les relations Eloquent

---

## 📦 Description et Ajout de Produits avec Laravel Eloquent + Gemini AI

### Outils Utilisés
- **Laravel Eloquent ORM** (Modèles et base de données)
- **Laravel Validator** (Validation des données)
- **Gemini AI API** (Génération de descriptions par IA)
- **Laravel HTTP Client** (Appels API externes)

### Fichier Impliqué

- `backend/app/Http/Controllers/Products/ProductController.php`

### Fonctionnement

**1. Création de Produit**

```php
public function store(Request $request)
{
    $validator = Validator::make($request->all(), [
        'status' => 'required|in:active,inactive',
        'title' => 'required|string|max:255',
        'short_description' => 'nullable|string|max:500',
        'description' => 'nullable|string',
        'commentaire' => 'nullable|string',
        'num_serie' => 'required|string|max:255',
        'num_inventaire' => 'nullable|string|max:255',
        'model' => 'required|string|max:255',
        'marque' => 'required|string|max:255',
        'seuil_min' => 'required|integer|min:0',
        'seuil_max' => 'required|integer|gt:seuil_min',
        'reference' => 'nullable|string|max:120',
        'categorie_id' => 'required|exists:categories,id',
        'has_expiration' => 'nullable|boolean',
        'stock_quantity' => 'nullable|integer|min:0',
        'unit_id' => 'nullable|exists:units,id',
        'supplier_ids' => 'nullable|array',
        'supplier_ids.*' => 'integer|exists:suppliers,id',
        'photo' => 'nullable',
        'photos' => 'nullable|array',
        'photos.*' => 'nullable|file|mimetypes:image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/heic,image/heif|max:2048',
    ]);

    // Vérification des doublons
    // Vérification des produits inactifs
    // Création avec relations fournisseurs
    // Gestion des photos multiples
}
```

**2. Génération Automatique de Descriptions (IA)**

```php
public function generateDescriptions(Request $request)
{
    $apiKey = config('services.gemini.key');
    
    if ($apiKey) {
        // Appel à l'API Gemini AI
        $prompt = "Génère une description courte (environ 150 caractères) et une description longue et détaillée (environ 500-1000 caractères) RÉDIGÉES EXCLUSIVEMENT EN FRANÇAIS pour le produit suivant : \n";
        $prompt .= "Titre: {$title}\n";
        if ($marque) $prompt .= "Marque: {$marque}\n";
        if ($model) $prompt .= "Modèle: {$model}\n";
        $prompt .= "\nInstructions :\n";
        $prompt .= "1. Le ton doit être professionnel et technique.\n";
        $prompt .= "2. Décris l'utilité, les caractéristiques et les avantages du produit.\n";
        $prompt .= "3. Réponds UNIQUEMENT au format JSON brut suivant (pas de texte avant ou après) :\n";
        $prompt .= "{\"short_description\": \"...\", \"description\": \"...\"}";

        $response = \Illuminate\Support\Facades\Http::post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={$apiKey}", [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => [
                'temperature' => 0.7,
                'topK' => 40,
                'topP' => 0.95,
                'maxOutputTokens' => 2048,
                'responseMimeType' => 'application/json',
            ]
        ]);

        if ($response->successful()) {
            $result = $response->json();
            $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';
            $text = preg_replace('/```json\s*|\s*```/', '', $text);
            $aiData = json_decode($text, true);

            if ($aiData && isset($aiData['short_description']) && isset($aiData['description'])) {
                return response()->json($aiData);
            }
        }
    }

    // Fallback local si l'API n'est pas disponible
    $short = "{$title}";
    if ($marque) $short .= " ({$marque})";
    if ($categoryName) $short .= " - Catégorie: {$categoryName}";
    $short .= ". Consommable fiable pour usage intensif.";

    $description = "Le produit \"{$title}\"";
    if ($marque) $description .= " sous la marque {$marque}";
    if ($model) $description .= " (Modèle: {$model})";
    $description .= " est une solution de haute qualité...";
    
    return response()->json([
        'short_description' => $short,
        'description' => $description,
    ]);
}
```

### Validation Anti-Doublons

**1. Vérification par Titre + Marque + Modèle**

```php
if (!empty($data['title'])) {
    $query = Product::where('title', $data['title']);
    
    if (empty($data['marque'])) {
        $query->whereNull('marque');
    } else {
        $query->where('marque', $data['marque']);
    }
    
    if (empty($data['model'])) {
        $query->whereNull('model');
    } else {
        $query->where('model', $data['model']);
    }

    $existingDuplicate = $query->first();

    if ($existingDuplicate) {
        return response()->json([
            'message' => 'Ce produit (Titre + Marque + Modèle) existe déjà.',
            'existing_product' => $existingDuplicate,
        ], 422);
    }
}
```

**2. Vérification par Référence**

```php
if (!empty($data['reference'])) {
    $existingRef = Product::query()
        ->whereRaw('LOWER(reference) = ?', [Str::lower($incomingRef)])
        ->first();

    if ($existingRef) {
        if (Str::lower((string) $existingRef->status) !== 'active') {
            // Propose de réactiver au lieu de créer un doublon
            return response()->json([
                'message' => 'Ce produit existe déjà mais il est inactif. Voulez-vous le réactiver?',
                'existing_product' => $existingRef,
                'suggested_update' => [
                    'method' => 'PUT',
                    'path' => '/api/products/' . $existingRef->id . '/activate',
                ],
            ], 422);
        }
    }
}
```

---

## 🔍 OCR - Reconnaissance Optique de Caractères avec Tesseract OCR

### Outil Utilisé
- **Tesseract OCR** (Moteur OCR open-source)
- **PHP shell_exec** (Exécution de commandes système)
- **TSV Format** (Tab-Separated Values pour données structurées)
- **Image Preprocessing** (Traitement d'image avant OCR)

### Fichier Impliqué

- `backend/app/Http/Controllers/Documents/DocumentController.php`

### Fonctionnement

**1. Upload et Traitement OCR**

```php
public function store(Request $request)
{
    set_time_limit(300);
    
    // Validation du fichier
    $request->validate([
        'file'         => 'required|file',
        'title'        => 'nullable|string|max:255',
        'type'         => 'nullable|string|max:100',
        'direction'    => 'nullable|in:in,out,unknown',
        'product_id'   => 'nullable|exists:products,id',
        'supplier_id'  => 'nullable|exists:suppliers,id',
        'warehouse_id' => 'nullable|numeric|exists:warehouses,id',
    ]);

    // Stockage du fichier
    $path       = $request->file('file')->store('documents', 'public');
    $fullPath   = Storage::disk('public')->path($path);
    
    // Exécution de Tesseract OCR
    $ocrText    = $this->runTesseract($fullPath);
    $tsvText    = $this->runTesseractTSV($fullPath);
    
    // Parsing des lignes
    $parsed     = [];
    if ($tsvText !== '') {
        $parsed = $this->parseLinesFromTSV($tsvText, $path);
    }
    if (empty($parsed) && $ocrText !== '') {
        $parsed = $this->parseLines($ocrText);
    }
    if (empty($parsed)) {
        $parsed = $this->extractTableFromImageHeuristic($fullPath);
    }
    
    // Déduction automatique du type et direction
    $guessedType = $request->input('type') ?: ($ocrText !== '' ? $this->guessType($ocrText) : 'document');
    $direction   = $request->input('direction', $ocrText !== '' ? $this->guessDirection($ocrText) : 'unknown');
    
    // Déduction du titre
    $autoTitle = $this->inferTitle($ocrText, $guessedType, $request->file('file')->getClientOriginalName(), $request->input('title'));
    
    // Détection du fournisseur
    $ocrSupplierName = $ocrText !== '' ? $this->guessSupplierName($ocrText) : null;
    $supplierEmail   = $ocrText !== '' ? $this->guessSupplierEmail($ocrText) : null;
    
    // Création du document avec données OCR
    $document = Document::create([
        'user_id'      => optional($request->user())->id,
        'product_id'   => $request->product_id,
        'supplier_id'  => $supplierId,
        'warehouse_id' => $warehouseId,
        'title'        => $autoTitle,
        'type'         => $guessedType,
        'direction'    => $direction,
        'path'         => $path,
        'ocr_text'     => $ocrText,
        'ocr_lines'    => $parsed,
        'status'       => 'pending',
    ]);

    return response()->json($document, 201);
}
```

**2. Exécution de Tesseract**

```php
private function runTesseractTSV(string $fullPath): string
{
    $binary = $this->tesseractBinary();
    if (!$binary) return '';

    $source    = $this->preprocessImage($fullPath);
    $isWindows = stripos(PHP_OS_FAMILY, 'Windows') !== false;
    
    // Essai avec différents modes PSM (Page Segmentation Mode)
    $psmOptions = [6, 3, 11, 1]; // Uniform block, fully automatic, sparse text, etc.
    $bestTsv = '';
    $bestCount = 0;

    foreach ($psmOptions as $psm) {
        $cmd = $tdpPrefix . $binArg . ' ' . $fileArg . ' ' . $tmpBaseArg
            . ' -l fra+eng --psm ' . $psm . ' --oem 1 --dpi 300 tsv'
            . ($isWindows ? ' 2>&1' : ' 2>/dev/null');

        @shell_exec($cmd);

        $tsvFile = $tmpBase . '.tsv';
        if (file_exists($tsvFile)) {
            $tsv = (string) file_get_contents($tsvFile);
            @unlink($tsvFile);

            // Compte les lignes significatives
            $lineCount = count(array_filter(explode("\n", $tsv), fn($l) => str_contains($l, "\t") && strlen($l) > 20));
            if ($lineCount > $bestCount) {
                $bestCount = $lineCount;
                $bestTsv = $tsv;
            }
            if ($lineCount > 5) break; // Bon résultat trouvé
        }
    }

    return $bestTsv;
}
```

**3. Détection Automatique du Type de Document**

```php
private function guessType(string $ocrText): string
{
    $text = Str::lower($ocrText);
    
    if (str_contains($text, 'bon de livraison')) return 'bon_livraison';
    if (str_contains($text, 'bon de réception')) return 'bon_reception';
    if (str_contains($text, 'bon de sortie')) return 'bon_sortie';
    if (str_contains($text, 'facture')) return 'facture';
    if (str_contains($text, 'devis')) return 'devis';
    if (str_contains($text, 'commande')) return 'commande';
    
    return 'document';
}
```

**4. Détection de la Direction (Entrée/Sortie)**

```php
private function guessDirection(string $ocrText): string
{
    $text = Str::lower($ocrText);
    
    // Mots-clés pour entrée
    $inKeywords = ['livraison', 'réception', 'entrée', 'in', 'reçu', 'bon de livraison'];
    foreach ($inKeywords as $kw) {
        if (str_contains($text, $kw)) return 'in';
    }
    
    // Mots-clés pour sortie
    $outKeywords = ['sortie', 'expédition', 'out', 'bon de sortie', 'retour'];
    foreach ($outKeywords as $kw) {
        if (str_contains($text, $kw)) return 'out';
    }
    
    return 'unknown';
}
```

**5. Normalisation des Quantités OCR**

```php
private function normalizeNumericLikeToken(string $token): ?string
{
    $raw = strtolower(trim($token));
    if ($raw === '') return null;

    $compact = preg_replace('/[^0-9a-z|]/', '', $raw);
    if ($compact === '') return null;

    // Rejette les tokens avec lettres peu probables pour OCR numérique
    if (preg_match('/[a-hj-np-rt-vx-y]/', $compact)) return null;

    // Mapping des confusions OCR courantes
    $mapped = strtr($compact, [
        'o' => '0', 'q' => '0', 'd' => '0',
        'i' => '1', 'l' => '1', '|' => '1',
        'z' => '2',
        's' => '5',
        'b' => '8',
        'g' => '9',
    ]);

    if (!preg_match('/^\d+$/', $mapped)) return null;
    return $mapped;
}
```

### Application des Données OCR

```php
public function apply(Request $request, int $id)
{
    $document = Document::findOrFail($id);
    $items = $request->input('items');

    // Validation des produits
    // Création automatique si nécessaire
    // Mise à jour des stocks
    // Création des mouvements de stock
    // Notifications aux responsables

    DB::transaction(function () use ($prepareActions, $document, $validSupplierId, $isManager, $user) {
        foreach ($prepareActions as $action) {
            // Création ou mise à jour des produits
            // Mise à jour des stocks
            // Création des lignes de mouvement
        }

        // Création du mouvement de stock
        $movement = StockMovement::create([
            'movement_type'   => $movementType,
            'reference'       => 'DOC-' . $document->id,
            'created_by'      => $user?->id,
            'depot_id'        => $document->warehouse_id,
            'status'          => $isManager ? 'executed' : 'pending_validation',
            'supplier_id'     => $document->supplier_id,
            'document_id'     => $document->id,
            // ...
        ]);
    });
}
```

---

## 🔐 Authentification avec Laravel Sanctum + Laravel Socialite

### Outils Utilisés
- **Laravel Sanctum** (Authentification par tokens API)
- **Laravel Socialite** (OAuth2 pour Google)
- **Laravel Hash** (Hashage des mots de passe)
- **Laravel Auth** (Système d'authentification Laravel)

### Fichiers Impliqués

- `backend/app/Http/Controllers/Auth/AuthController.php` (Authentification normale)
- `backend/app/Http/Controllers/Auth/SocialAuthController.php` (Google OAuth)

### 1. Authentification Normale

**Inscription**

```php
public function register(Request $request)
{
    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255',
        'email' => 'required|string|email|max:255|unique:users',
        'password' => 'required|string|min:6',
        'service' => 'nullable|string|max:255',
        'poste' => 'nullable|string|max:255',
        'siege' => 'nullable|string|max:255',
    ]);

    $roleRecord = \App\Models\Role::whereRaw('LOWER(name) = ?', ['utilisateur'])->first();

    $user = User::create([
        'nomprenom' => $request->name,
        'email' => $request->email,
        'password' => Hash::make($request->password),
        'service' => $request->input('service', 'Non defini'),
        'poste' => $request->input('poste', 'Non defini'),
        'siege' => $request->input('siege', 'Non defini'),
        'role_id' => $roleRecord ? $roleRecord->id : null,
    ]);

    $token = $user->createToken('auth_token')->plainTextToken;

    return response()->json([
        'message' => 'User created successfully',
        'user' => $user,
        'token' => $token,
    ]);
}
```

**Connexion**

```php
public function login(Request $request)
{
    if (!User::where('email', $request->email)->exists()) {
        return response()->json([
            'message' => 'Invalid login details'
        ], 401);
    }

    if (!Auth::attempt($request->only('email', 'password'))) {
        return response()->json([
            'message' => 'Invalid login details'
        ], 401);
    }

    $user = User::where('email', $request['email'])->firstOrFail();
    $token = $user->createToken('auth_token')->plainTextToken;

    return response()->json([
        'message' => 'Login success',
        'user' => $user->load('role'),
        'token' => $token,
    ]);
}
```

**Changement de Mot de Passe**

```php
public function changePassword(Request $request)
{
    $validator = Validator::make($request->all(), [
        'currentPassword' => 'required|string',
        'newPassword' => 'required|string|min:6',
    ]);

    $user = $request->user();

    if (!Hash::check($request->currentPassword, $user->password)) {
        return response()->json([
            'message' => 'Current password is incorrect'
        ], 422);
    }

    $user->update([
        'password' => Hash::make($request->newPassword)
    ]);

    return response()->json([
        'message' => 'Password changed successfully'
    ]);
}
```

**Déconnexion**

```php
public function logout(Request $request)
{
    $request->user()->currentAccessToken()->delete();

    return response()->json([
        'message' => 'Logged out successfully'
    ]);
}
```

### 2. Authentification Google OAuth2

**Redirection vers Google**

```php
public function redirectToGoogle()
{
    $url = Socialite::driver('google')
        ->stateless()
        ->with(['prompt' => 'select_account'])
        ->redirect()
        ->getTargetUrl();

    return response()->json([
        'url' => $url,
    ]);
}
```

**Callback Google**

```php
public function handleGoogleCallback()
{
    try {
        $googleUser = Socialite::driver('google')->stateless()->user();

        // Recherche par Google ID
        $user = User::where('google_id', $googleUser->id)->first();

        if ($user) {
            AuditService::log($user, 'LOGIN_GOOGLE', 'User logged in via Google');
        } else {
            // Recherche par email (liaison de compte)
            $user = User::where('email', $googleUser->email)->first();

            if ($user) {
                $user->update([
                    'google_id' => $googleUser->id,
                    'avatar' => $googleUser->avatar,
                ]);
                AuditService::log($user, 'LINK_GOOGLE', 'User linked Google account');
            } else {
                // Création automatique du compte
                $user = User::create([
                    'nomprenom' => $googleUser->name,
                    'email' => $googleUser->email,
                    'google_id' => $googleUser->id,
                    'password' => bcrypt(str()->random(24)),
                    'avatar' => $googleUser->avatar,
                    'photo' => $googleUser->avatar,
                    'service' => 'Non defini',
                    'poste' => 'Non defini',
                    'siege' => 'Non defini',
                ]);

                AuditService::log($user, 'REGISTER_GOOGLE', 'User registered via Google');
            }
        }

        // Vérification du rôle
        if (!$user->role_id) {
            return redirect('http://localhost:4200/login?error=' . urlencode('Votre compte est en attente de validation. Veuillez patienter jusqu\'à ce qu\'un administrateur vous assigne un rôle pour vous connecter.'));
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return redirect('http://localhost:4200/auth/callback?token=' . $token);
    } catch (Exception $e) {
        return redirect('http://localhost:4200/login?error=' . urlencode($e->getMessage()));
    }
}
```

### Sécurité

- **Tokens Laravel Sanctum**: Authentification par tokens Bearer
- **Hash des mots de passe**: Utilisation de `Hash::make()`
- **Validation des rôles**: Vérification du rôle avant accès
- **Audit des actions**: `AuditService` pour tracer les connexions
- **Stateless OAuth**: Pas de session côté serveur pour Google

---

## 🎮 Visualisation 3D avec Three.js

### Outil Utilisé
- **Three.js** (Moteur 3D WebGL)
- **WebGL Renderer** (Rendu graphique)
- **PBR Materials** (Matériaux physiquement réalistes)
- **Raycaster** (Détection de clics 3D)

### Fichier Impliqué

- `frontend/src/app/features/shared-components/storage-3d-viewer/storage-3d-viewer.component.ts`

### Architecture

**Moteur 3D**: Three.js r128
- Rendu WebGL
- Éclairage PBR (Physically Based Rendering)
- Ombres douces
- Tone mapping ACESFilmic

### Fonctionnalités

**1. Navigation Hiérarchique**

```typescript
// Navigation: Entrepôt → Salle → Emplacement/Armoire
onCanvasClick(e: MouseEvent) {
    if (this.type === 'warehouse' || this.type === 'room') {
        // Navigation vers sous-entité
        this.viewStack.push({ 
            type: this.type, 
            id: this.storageId, 
            title: this.title, 
            capacity: this.capacityUnits, 
            current: this.currentUnits 
        });
        this.type = found.entityType as any;
        this.storageId = found.data.id;
        this.title = found.data.name || found.data.code || '';
        this.capacityUnits = found.data.capacity_units || 0;
        this.currentUnits = found.data.current_units || 0;
        this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;
        this.fetchData();
    }
}
```

**2. Contrôles de Caméra**

```typescript
// Contrôle orbital
onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.prevMouse.x;
    const dy = e.clientY - this.prevMouse.y;
    this.targetSph.theta -= dx * 0.007;
    this.targetSph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.targetSph.phi + dy * 0.007));
    this.prevMouse = { x: e.clientX, y: e.clientY };
}

onWheel(e: WheelEvent) {
    e.preventDefault();
    this.targetSph.radius = Math.max(3, Math.min(34, this.targetSph.radius + e.deltaY * 0.012));
}

// Presets de caméra
setCameraPreset(preset: 'front' | 'top' | 'iso') {
    if (preset === 'front') { this.targetSph.theta = 0; this.targetSph.phi = 1.1; }
    if (preset === 'top')   { this.targetSph.phi = 0.18; }
    if (preset === 'iso')   { this.targetSph.theta = 0.6; this.targetSph.phi = 0.85; }
}
```

**3. Animation des Portes**

```typescript
toggleDoor() {
    if (this.doorAnimating) return;
    this.doorOpen = !this.doorOpen;
    this.doorTargetAngle = this.doorOpen ? Math.PI * 0.72 : 0;
    this.doorAnimating = true;
    
    if (this.doorOpen) {
        this.targetSph.theta = 0;
        this.targetSph.phi   = 1.18;
        this.targetSph.radius = Math.max(this.defaultRadius * 0.65, 5);
    } else {
        this.resetCamera();
    }
}
```

**4. Affichage des Produits**

```typescript
// Couleurs uniques par produit
toHex(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '00000'.substring(0, 6 - c.length) + c;
}

// Légende des produits
get uniqueProducts() {
    const map = new Map<string, { title: string; qty: number; colorHex: string }>();
    this.products.forEach(p => {
        const key = p.title;
        if (!map.has(key)) {
            map.set(key, { 
                title: p.title, 
                qty: p.local_quantity || p.stock_quantity || 1, 
                colorHex: this.toHex(p.title || '') 
            });
        } else {
            map.get(key)!.qty += (p.local_quantity || p.stock_quantity || 1);
        }
    });
    return Array.from(map.values());
}
```

**5. Jauge de Capacité**

```typescript
get gaugeStatus(): string {
    if (this.percentage >= 90) return 'Saturé';
    if (this.percentage >= 70) return 'Presque plein';
    return 'Disponible';
}

get gaugeStatusClass(): string {
    if (this.percentage >= 90) return 'gauge-full';
    if (this.percentage >= 70) return 'gauge-warn';
    return 'gauge-ok';
}
```

### Types de Vues

- **Entrepôt**: Vue globale avec salles
- **Salle**: Vue avec armoires et emplacements
- **Emplacement**: Vue détaillée avec produits
- **Armoire**: Vue avec portes ouvrables et produits

### Interactions

- **Glisser**: Rotation de la vue
- **Molette**: Zoom avant/arrière
- **Clic**: Navigation ou sélection
- **Clic sur porte**: Ouverture/fermeture
- **Clic sur produit**: Affichage des détails

---

## 📧 Gestion des Emails avec Laravel Mail + Laravel Notifications

### Outils Utilisés
- **Laravel Mail** (Système d'emails)
- **Laravel Mailable** (Classes d'emails)
- **Laravel Notifications** (Système de notifications)
- **Blade Templates** (Templates de vues pour emails)
- **SMTP** (Protocole d'envoi d'emails)

### Fichiers Impliqués

- `backend/app/Mail/NouvelleDemandePDF.php`
- `backend/app/Mail/ReturnToSupplierMail.php`
- `backend/app/Mail/NewUserCreated.php`
- `backend/app/Notifications/` (Diverses notifications)

### Types d'Emails

**1. Notification de Nouvelle Demande**

```php
class NouvelleDemandePDF extends Mailable
{
    public $demande;
    public $pdfPath;

    public function __construct($demande, $pdfPath)
    {
        $this->demande = $demande;
        $this->pdfPath = $pdfPath;
    }

    public function build()
    {
        return $this->subject('Nouvelle demande de consommable')
            ->view('emails.nouvelle_demande')
            ->attach($this->pdfPath, [
                'as' => 'demande.pdf',
                'mime' => 'application/pdf',
            ]);
    }
}
```

**2. Notification de Retour Fournisseur**

```php
class ReturnToSupplierMail extends Mailable
{
    public $stock;
    public $supplier;
    public $justification;
    public $pdfPath;

    public function build()
    {
        $mail = $this->subject('Notification de Retour de Marchandise - Lot Expire')
                    ->view('emails.return_supplier');

        if (file_exists($this->pdfPath)) {
            $mail->attach($this->pdfPath, [
                'as' => 'Bon_de_Retour_' . $this->stock->batch_number . '.pdf',
                'mime' => 'application/pdf',
            ]);
        }

        return $mail;
    }
}
```

**3. Notifications Laravel**

- `ConsumableRequestNotification`: Notification de demande de consommable
- `StockMovementNotification`: Notification de mouvement de stock
- `LowStockAlertNotification`: Alerte de stock faible
- `ProductExpirationAlert`: Alerte d'expiration de produit
- `CapacityAlertNotification`: Alerte de capacité dépassée

### Configuration

Les emails sont configurés dans:
- `config/mail.php`: Configuration SMTP
- `config/services.php`: Configuration des services externes
- `.env`: Variables d'environnement (MAIL_MAILER, MAIL_HOST, etc.)

### Envoi

```php
// Exemple d'envoi
use App\Mail\NouvelleDemandePDF;

Mail::to($destinataire)
    ->cc($copie)
    ->send(new NouvelleDemandePDF($demande, $pdfPath));
```

---

## 📊 Tableaux de Bord par Profil avec Laravel RBAC + Angular Components

### Outils Utilisés
- **Laravel RBAC** (Role-Based Access Control)
- **Laravel Gates/Policies** (Autorisations)
- **Angular Components** (Composants UI personnalisés)
- **Laravel Eloquent Relations** (Jointures optimisées)
- **Middleware Laravel** (Filtrage par rôle)

### Rôles et Permissions

**1. Administrateur**
- Gestion des utilisateurs
- Gestion des rôles et permissions
- Accès à tous les dépôts
- Validation des demandes
- Rapports globaux

**2. Directeur**
- Vue d'ensemble des stocks
- Validation des demandes
- Rapports par dépôt
- Gestion des fournisseurs

**3. Responsable de Stock**
- Gestion des stocks
- Réception des marchandises
- Validation des mouvements
- Gestion des emplacements

**4. Employé**
- Création de demandes
- Suivi de ses demandes
- Consultation du stock disponible
- Notifications personnelles

### Personnalisation des Tableaux de Bord

Chaque rôle accède à des indicateurs spécifiques:

**Administrateur**
- Nombre total d'utilisateurs
- Statistiques globales de stock
- Demandes en attente
- Alertes système

**Directeur**
- État des stocks par dépôt
- Demandes à valider
- Mouvements récents
- Rapports d'activité

**Responsable de Stock**
- Stock de son dépôt
- Entrées/Sorties du jour
- Produits en alerte
- Capacité des emplacements

**Employé**
- Ses demandes en cours
- Historique de ses demandes
- Stock disponible
- Notifications

---

## 🎯 Points Forts Techniques

1. **OCR Intelligent**: Tesseract avec détection automatique de type de document
2. **IA Intégrée**: Gemini AI pour génération de descriptions
3. **3D Interactive**: Three.js pour visualisation des entrepôts
4. **Anti-Doublons**: Validation stricte avec détection de produits inactifs
5. **OAuth2**: Authentification Google sécurisée
6. **Export Excel**: CSV compatible avec UTF-8 BOM
7. **PDF Automatiques**: Génération et attachement aux emails
8. **Notifications**: Système complet d'alertes et notifications
9. **RBAC**: Contrôle d'accès par rôle granulaire
10. **Audit**: Traçabilité complète des actions

---

## 📝 Conclusion

Ce système de gestion des consommables intègre des technologies modernes pour offrir une expérience utilisateur complète et professionnelle:

- **Automatisation**: OCR, IA, génération de PDF
- **Visualisation**: 3D interactive pour les entrepôts
- **Sécurité**: Authentification multiple, RBAC
- **Productivité**: Export Excel, notifications en temps réel
- **Fiabilité**: Validation anti-doublons, traçabilité

L'architecture modulaire permet une évolutivité facile et une maintenance simplifiée.

---

**Document préparé le**: 15 juin 2026  
**Version**: 1.0.0  
**Projet**: Gestion des Consommables
