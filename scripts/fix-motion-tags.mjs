import fs from 'node:fs';

const files = ['index.html', 'catalog.html'];
const badClose = `</${'motion.div'}>`;
const goodClose = `</${'div'}>`;
const badSelf = `></${'motion.div'}>`;
const goodSelf = `></${'div'}>`;

for (const file of files) {
	if (!fs.existsSync(file)) continue;
	let t = fs.readFileSync(file, 'utf8');
	const n = (t.match(new RegExp(badClose.replace('.', '\\.'), 'g')) || []).length;
	const n2 = (t.match(new RegExp(badSelf.replace('.', '\\.'), 'g')) || []).length;
	t = t.split(badClose).join(goodClose);
	t = t.split(badSelf).join(goodSelf);
	fs.writeFileSync(file, t, 'utf8');
	console.log(file, 'fixed closers:', n, 'self:', n2, 'remaining:', t.includes('motion.div'));
}
