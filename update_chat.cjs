const fs = require('fs');
const path = 'src/components/modules/WhatsAppChat.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Destructure totalCount
content = content.replace(
  /conversations,\s+markAsRead,/,
  'conversations,\n    totalCount,\n    markAsRead,'
);

// 2. Update getUserTabs
content = content.replace(
  /count: conversations\.filter\(c => c\.status !== 'closed'\)\.length/,
  'count: totalCount'
);

fs.writeFileSync(path, content);
console.log('Update complete');

