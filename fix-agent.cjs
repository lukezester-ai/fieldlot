const fs = require('fs');
let lines = fs.readFileSync('server/fieldlot-agent-tools.ts', 'utf8').split('\n');

// 765 is 0-indexed for 766
lines[765] = "					draftText = \`Hello, I am contacting you regarding your listing for ${item.title} (ID: ${id}). I would like to propose a price of ${offer} for the requested quantity. Please let me know if you are open to discussing this. Looking forward to your reply. Best regards,\`;";
lines[795] = "				const summary = \`Cleaned listings (pruned ${data.pruned})\`;";
lines[852] = "					id: \`doc-${Date.now()}\`,";
lines[853] = "					text: \`=== ${title} ===\\n${content}\`";
lines[865] = "				const msg = \`Unknown tool: ${name}\`;";

fs.writeFileSync('server/fieldlot-agent-tools.ts', lines.join('\n'));
console.log('Fixed lines');
