import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('server').filter(f => f.endsWith('.ts'));
files.forEach(f => {
	const p = path.join('server', f);
	const txt = fs.readFileSync(p, 'utf8');
	const n = txt.replace(/'bg' \| 'en'/g, "'bg' | 'en' | 'de'");
	if (txt !== n) {
		fs.writeFileSync(p, n);
		console.log('Updated ' + f);
	}
});
