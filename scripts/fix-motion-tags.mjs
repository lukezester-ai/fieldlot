import fs from 'node:fs';
import path from 'node:path';

const files = ['index.html', 'catalog.html'].map((f) =>
	path.resolve(process.cwd(), f),
);

const voidTags = new Set([
	'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

for (const file of files) {
	if (!fs.existsSync(file)) continue;
	let html = fs.readFileSync(file, 'utf8');
	const stack = [];
	let out = '';
	let i = 0;
	const reOpen = /^<([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/;
	const reClose = /^<\/([a-zA-Z][\w:-]*)>/;
	const reMotionClose = /^<\/motion>/;
	while (i < html.length) {
		if (html[i] !== '<') {
			out += html[i++];
			continue;
		}
		let m;
		if ((m = html.slice(i).match(reMotionClose))) {
			const tag = stack.pop() || 'motion';
			out += `</${tag}>`;
			i += m[0].length;
			continue;
		}
		if ((m = html.slice(i).match(reClose))) {
			out += m[0];
			if (stack.length) stack.pop();
			i += m[0].length;
			continue;
		}
		if ((m = html.slice(i).match(reOpen))) {
			const [, tag, attrs, self] = m;
			out += m[0];
			const lower = tag.toLowerCase();
			if (!self && !voidTags.has(lower) && !attrs.includes('/>')) stack.push(lower);
			i += m[0].length;
			continue;
		}
		out += html[i++];
	}
	fs.writeFileSync(file, out);
	console.log('fixed', path.basename(file), (out.match(/motion/g) || []).length, 'motion left');
}
