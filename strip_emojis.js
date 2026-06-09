const fs = require('fs');
const path = require('path');

const dir = './frontend/src';

function stripEmojis(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      stripEmojis(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      // Match emojis that take presentation forms, or extended pictographics
      // Not matching \p{Emoji} alone to avoid stripping digits and normal punctuation.
      content = content.replace(/[\p{Extended_Pictographic}]/gu, '');
      // Some other symbols like warning ⚠️ are \p{Emoji} but not pictographic
      content = content.replace(/⚠️/g, '');
      content = content.replace(/✅/g, '');
      content = content.replace(/❌/g, '');
      content = content.replace(/📌/g, '');
      content = content.replace(/➕/g, '');
      content = content.replace(/⏳/g, '');
      content = content.replace(/👤/g, '');
      content = content.replace(/💬/g, '');

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Stripped emojis in:', fullPath);
      }
    }
  }
}

stripEmojis(dir);
