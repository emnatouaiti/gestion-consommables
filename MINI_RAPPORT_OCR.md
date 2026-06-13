**Mini Rapport OCR — consotrack**

Résumé:
- **Objectif**: expliquer comment l'OCR est intégré à l'application (backend Laravel + frontend Angular), les commandes utilisées, bibliothèques, et où se trouvent les parties concernées dans le code.

Prérequis et bibliothèques principales:
- **Tesseract OCR**: moteur OCR CLI utilisé (langues `fra+eng`). Exemple d'exécutable Windows: `C:\Program Files\Tesseract-OCR\tesseract.exe`.
- **ImageMagick / Imagick**: prétraitement d'images soit via l'extension PHP `Imagick`, soit via la commande `magick` (CLI) pour deskew/threshold/resize.
- **Laravel (backend)**: logique OCR et parsing se trouve dans un contrôleur dédié.
- **Angular (frontend)**: interface d'upload et d'application des lignes OCR.

Commandes-clés observées dans le dépôt:
- Exemple simple (script de test):
  - `"C:\\Program Files\\Tesseract-OCR\\tesseract.exe" "<image>" stdout -l fra+eng --psm 6 --oem 1 2>&1`
  - Ce format apparaît dans `test_ocr.php` et `test_recent_ocr.php`.
- Tesseract pour TSV (extraction détaillée avec position/boîtes): options similaires mais `tsv` en sortie.
- ImageMagick (CLI) pour prétraitement (ex. dans `preprocessWithMagick`): `magick <in> -density 300 -resample 300x300 -deskew 40% -resize 200% ... <out>`.

Fichiers principaux (où se fait chaque étape):
- **Upload + UI**: [frontend/src/app/features/ocr/upload-document/documents.component.ts](frontend/src/app/features/ocr/upload-document/documents.component.ts)
  - `upload()` : envoie le fichier via `POST /api/documents`.
  - `runDiagnostic(doc)` : appelle `POST /api/documents/diagnostic` pour diagnostiquer/relancer l'OCR.
  - `saveDocumentOcrLines(doc)` : `PUT /api/documents/{id}` pour sauvegarder les `ocr_lines` éditées.
  - `apply(doc)` et `executeApply(...)` : transforme les `ocr_lines` en mouvements de stock (`POST /api/documents/{id}/apply`).

- **Endpoints & parsing OCR (backend)**: [backend/app/Http/Controllers/Documents/DocumentController.php](backend/app/Http/Controllers/Documents/DocumentController.php)
  - `diagnostic(Request $request)` : endpoint de diagnostic (contrôle rapide, return info basique).
  - `runTesseractTSV($path)` : exécute Tesseract pour produire TSV (position des mots) et choisit le meilleur `psm`.
  - `runTesseract($path)` : exécutions Tesseract en texte brut; choisit la meilleure combinaison `lang` + `psm`.
  - `preprocessImage()` / `preprocessWithMagick()` : préparation d'image (deskew, threshold, resize) via `Imagick` ou `magick`.
  - `parseLinesFromTSV($tsv, $storedPath)` : logique principale qui convertit le TSV de Tesseract en lignes structurées `{reference, title, quantity}`.
  - `parseLines($text)` : parsing basé sur texte brut (fallback si TSV non disponible).
  - `runTargetedNumericOcr($path, left, top, right, bottom)` : extrait une zone et force Tesseract à ne reconnaître que des chiffres (whitelist) pour récupérer des quantités.

- **Scripts de test**:
  - [test_ocr.php](test_ocr.php): script de test local qui appelle Tesseract directement et affiche un extrait du texte.
  - [test_recent_ocr.php](test_recent_ocr.php) et [test_stored_ocr.php](test_stored_ocr.php): tests ciblant des fichiers dans `storage`.

Explication du flux OCR (étapes réelles dans l'application):
1. L'utilisateur importe un document via l'UI Angular (`upload()` dans [documents.component.ts](frontend/src/app/features/ocr/upload-document/documents.component.ts)). Le backend stocke le fichier et lance (ou laisse lancer manuellement) le diagnostic/OCR.
2. Backend prétraite l'image (`preprocessImage()`), soit avec l'extension PHP `Imagick`, soit en appelant la commande `magick` si Imagick absent.
3. Backend exécute Tesseract de deux manières:
   - Full-page text OCR: `runTesseract()` — plusieurs essais `lang`/`psm`, choix du meilleur résultat.
   - TSV OCR: `runTesseractTSV()` — pour obtenir boîtes (left/top/right/bottom) et confiance par mot; utile pour extraire tableaux en colonnes.
4. Parsing: si on a TSV, la méthode `parseLinesFromTSV()` regroupe les mots par ligne en utilisant la position verticale, détecte la ligne d'en-tête (colonne référence / désignation / quantité), puis pour chaque ligne extrait `reference`, `title` et `quantity` en appliquant heuristiques (normalisation des erreurs OCR, fuzzy maps pour 1/0/l/o, blacklist, tests de validité).
5. Extraction ciblée de quantités: quand la zone probable de quantité est identifiée, `runTargetedNumericOcr()` recadre l'image autour de cette zone, applique plusieurs filtres (adaptiveThreshold, resize, etc.), puis appelle Tesseract avec `tessedit_char_whitelist=0123456789` et plusieurs `psm` pour retrouver un chiffre fiable.
6. Résultats: le backend renvoie `ocr_lines` (tableau d'objets) et `ocr_text` brut; le frontend présente ces lignes, permet édition / ajout / suppression, puis `apply()` transforme ces lignes en mouvements de stock via l'endpoint `POST /api/documents/{id}/apply`.

Points techniques importants (résumés du code):
- Robustesse des heuristiques:
  - `isHeaderRow()` détecte une ligne d'en-tête en comptant plusieurs signaux (ref/descr/qty).
  - `tryParseQuantity()` combine normalisation char->digit, mapping de confusions connues (`l0` => 10, `io` => 10, etc.), et rejette les dates/années.
  - `fixOcrTitleNoise()` nettoie des patterns récurrents (ex: 'Odinateur' -> 'Ordinateur').
- Prétraitement:
  - `preprocessImage()` fait deskew, enhance, resize×2, adaptiveThreshold et produit un TIFF temporaire pour Tesseract.
  - Fallback via `preprocessWithMagick()` si Imagick indisponible.
- Choix des options Tesseract:
  - Langues testées: `fra+eng`, `fra`, `eng`.
  - Plusieurs `--psm` testés pour trouver celui donnant le meilleur score (ex. 6,3,11,1). Pour TSV, on force `tsv` et récupère boîtes et confiance.

Illustration (schéma du flux):
```mermaid
flowchart LR
  A[Frontend: upload file] --> B[Backend: store file (/storage)]
  B --> C{Preprocess}
  C -->|Imagick| D[Preprocessed image]
  C -->|magick CLI| D
  D --> E[Tesseract TSV / Text]
  E --> F[parseLinesFromTSV / parseLines]
  F --> G[ocr_lines saved on Document]
  G --> H[Frontend: display/edit/save (PUT /api/documents/{id})]
  H --> I[Apply to stock (POST /api/documents/{id}/apply)]
```

Conseils d'utilisation et commandes d'installation (Windows exemple):
- Installer Tesseract (Windows): télécharger l'installateur ou via Chocolatey:
  - `choco install tesseract` (si Chocolatey est installé)
  - Vérifier: `"C:\\Program Files\\Tesseract-OCR\\tesseract.exe" --version`
- Installer ImageMagick (CLI) ou activer l'extension PHP Imagick:
  - CLI: télécharger ImageMagick et ajouter `magick` au PATH.
  - PHP Imagick (Windows): activer l'extension `php_imagick.dll` correspondante.

Où regarder dans le dépôt pour comprendre/ajuster l'OCR:
- Frontend UI: [frontend/src/app/features/ocr/upload-document/documents.component.ts](frontend/src/app/features/ocr/upload-document/documents.component.ts)
- Backend: logique OCR complète: [backend/app/Http/Controllers/Documents/DocumentController.php](backend/app/Http/Controllers/Documents/DocumentController.php)
- Scripts de test locaux: [test_ocr.php](test_ocr.php), [test_recent_ocr.php](test_recent_ocr.php), [test_stored_ocr.php](test_stored_ocr.php)
- Guide d'erreurs: [OCR_ERRORS_RESOLUTION.md](OCR_ERRORS_RESOLUTION.md)

Si vous voulez, je peux:
- Générer des captures d'écran explicatives (UI) en local si vous voulez que je crée des images d'annotation.
- Extraire et commenter ligne par ligne un extrait du contrôleur ou du composant frontend précis que vous voulez inclure dans une documentation cliente.

Fin du mini-rapport.
