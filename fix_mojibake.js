const fs = require('fs');
const path = require('path');

const files = [
  './frontend/src/app/features/consumable-request/consumable-request.ts',
  './frontend/src/app/features/dashboard/dashboard.component.ts',
  './frontend/src/app/features/produits/list-produit/products.component.ts'
];

const replacements = [
  [/ðŸ“ /g, ''],
  [/ðŸ’¬/g, ''],
  [/ðŸ ¬/g, ''],
  [/âš ï¸ /g, ''],
  [/â ³/g, ''],
  [/â Œ/g, ''],
  [/âž•/g, '']
];

for (const file of files) {
  const filePath = path.resolve(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [regex, replacement] of replacements) {
      content = content.replace(regex, replacement);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', file);
  }
}
