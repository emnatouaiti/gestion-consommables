const fs = require('fs');
const path = require('path');

function findBroken(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findBroken(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // Look for '??' patterns that are likely broken emojis
        if (/['"]\?\?['"]/.test(line) || />\s*\?\?\s*</.test(line)) {
          console.log(fullPath + ':' + (i+1) + ': ' + line.trim());
        }
      });
    }
  }
}

findBroken('./frontend/src');
