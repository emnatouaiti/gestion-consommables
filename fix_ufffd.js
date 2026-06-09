const fs = require('fs');
const path = require('path');

// Map of mojibake (single U+FFFD) to correct French characters
// The U+FFFD appears where accented chars were corrupted
// We need to look at context to determine the correct replacement

const files = [
  './frontend/src/app/features/admin-layout.component.ts',
  './frontend/src/app/features/admin-role-page/admin-role-page.component.html',
  './frontend/src/app/features/admin-role-page/admin-role-page.component.ts',
  './frontend/src/app/features/categories/categories.component.ts',
  './frontend/src/app/features/chat/chat.component.ts',
  './frontend/src/app/features/chat/mini-threads.component.ts',
  './frontend/src/app/features/chat/thread-widget.component.ts',
  './frontend/src/app/features/produits/list-produit/products.component.html',
  './frontend/src/app/features/profile/profile.html',
  './frontend/src/app/features/profile/profile.ts',
  './frontend/src/app/features/references/references.component.ts',
  './frontend/src/app/features/suppliers/suppliers.component.ts',
  './frontend/src/app/features/utilisateurs/list-users/users-list.component.html',
  './frontend/src/app/features/warehouses/warehouses.component.ts',
];

// Context-based replacements: find specific broken words and replace them
const wordReplacements = [
  // Common French words with accents
  ['D\uFFFDp\uFFFDts', 'Dépôts'],
  ['d\uFFFDp\uFFFDts', 'dépôts'],
  ['D\uFFFDp\uFFFDt', 'Dépôt'],
  ['d\uFFFDp\uFFFDt', 'dépôt'],
  ['Cat\uFFFDgories', 'Catégories'],
  ['cat\uFFFDgories', 'catégories'],
  ['Cat\uFFFDgorie', 'Catégorie'],
  ['cat\uFFFDgorie', 'catégorie'],
  ['Unit\uFFFDs', 'Unités'],
  ['unit\uFFFDs', 'unités'],
  ['Unit\uFFFD', 'Unité'],
  ['unit\uFFFD', 'unité'],
  ['R\uFFFDf\uFFFDrences', 'Références'],
  ['r\uFFFDf\uFFFDrences', 'références'],
  ['R\uFFFDf\uFFFDrence', 'Référence'],
  ['r\uFFFDf\uFFFDrence', 'référence'],
  ['Op\uFFFDrations', 'Opérations'],
  ['op\uFFFDrations', 'opérations'],
  ['Op\uFFFDration', 'Opération'],
  ['op\uFFFDration', 'opération'],
  ['Employ\uFFFD', 'Employé'],
  ['employ\uFFFD', 'employé'],
  ['Capacit\uFFFD', 'Capacité'],
  ['capacit\uFFFD', 'capacité'],
  ['satur\uFFFD', 'saturé'],
  ['Cr\uFFFD\uFFFD', 'Créé'],
  ['cr\uFFFD\uFFFD', 'créé'],
  ['Cr\uFFFDer', 'Créer'],
  ['cr\uFFFDer', 'créer'],
  ['cr\uFFFDation', 'création'],
  ['Cr\uFFFDation', 'Création'],
  ['G\uFFFDn\uFFFDral', 'Général'],
  ['g\uFFFDn\uFFFDral', 'général'],
  ['G\uFFFDrer', 'Gérer'],
  ['g\uFFFDrer', 'gérer'],
  ['G\uFFFDr\uFFFD', 'Géré'],
  ['g\uFFFDr\uFFFD', 'géré'],
  ['D\uFFFDtails', 'Détails'],
  ['d\uFFFDtails', 'détails'],
  ['D\uFFFDtail', 'Détail'],
  ['d\uFFFDtail', 'détail'],
  ['S\uFFFDlection', 'Sélection'],
  ['s\uFFFDlection', 'sélection'],
  ['s\uFFFDlectionn\uFFFD', 'sélectionné'],
  ['S\uFFFDlectionn\uFFFD', 'Sélectionné'],
  ['S\uFFFDlectionnez', 'Sélectionnez'],
  ['Supprimer d\uFFFDfinitivement', 'Supprimer définitivement'],
  ['d\uFFFDfinitivement', 'définitivement'],
  ['D\uFFFDfinitivement', 'Définitivement'],
  ['Num\uFFFDro', 'Numéro'],
  ['num\uFFFDro', 'numéro'],
  ['Quantit\uFFFD', 'Quantité'],
  ['quantit\uFFFD', 'quantité'],
  ['donn\uFFFDes', 'données'],
  ['Donn\uFFFDes', 'Données'],
  ['archiv\uFFFD', 'archivé'],
  ['Archiv\uFFFD', 'Archivé'],
  ['d\uFFFDsarchiv\uFFFD', 'désarchivé'],
  ['D\uFFFDsarchiv\uFFFD', 'Désarchivé'],
  ['D\uFFFDsarchiver', 'Désarchiver'],
  ['d\uFFFDsarchiver', 'désarchiver'],
  ['R\uFFFDle', 'Rôle'],
  ['r\uFFFDle', 'rôle'],
  ['R\uFFFDles', 'Rôles'],
  ['r\uFFFDles', 'rôles'],
  ['mod\uFFFD', 'modé'],
  ['Modifi\uFFFD', 'Modifié'],
  ['modifi\uFFFD', 'modifié'],
  ['Modifier', 'Modifier'],
  ['supprimer', 'supprimer'],
  ['Supprim\uFFFD', 'Supprimé'],
  ['supprim\uFFFD', 'supprimé'],
  ['ajout\uFFFD', 'ajouté'],
  ['Ajout\uFFFD', 'Ajouté'],
  ['pr\uFFFDnom', 'prénom'],
  ['Pr\uFFFDnom', 'Prénom'],
  ['R\uFFFDinitialiser', 'Réinitialiser'],
  ['r\uFFFDinitialiser', 'réinitialiser'],
  ['R\uFFFDcup\uFFFDrer', 'Récupérer'],
  ['r\uFFFDcup\uFFFDrer', 'récupérer'],
  ['R\uFFFDcup\uFFFDration', 'Récupération'],
  ['t\uFFFDl\uFFFDcharger', 'télécharger'],
  ['T\uFFFDl\uFFFDcharger', 'Télécharger'],
  ['t\uFFFDl\uFFFDchargement', 'téléchargement'],
  ['T\uFFFDl\uFFFDchargement', 'Téléchargement'],
  ['t\uFFFDl\uFFFDcharg\uFFFD', 'téléchargé'],
  ['T\uFFFDl\uFFFDcharg\uFFFD', 'Téléchargé'],
  ['Pr\uFFFDc\uFFFDdent', 'Précédent'],
  ['pr\uFFFDc\uFFFDdent', 'précédent'],
  ['pr\uFFFDc\uFFFDdente', 'précédente'],
  ['Pr\uFFFDc\uFFFDdente', 'Précédente'],
  ['\uFFFD', 'é'], // Fallback: single replacement char -> most common French accent
];

let totalFixed = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  for (const [broken, fixed] of wordReplacements) {
    content = content.split(broken).join(fixed);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    const remaining = (content.match(/\uFFFD/g) || []).length;
    console.log('Fixed:', filePath, remaining > 0 ? `(${remaining} U+FFFD remaining)` : '(clean)');
    totalFixed++;
  }
}

console.log('\nTotal files fixed:', totalFixed);
