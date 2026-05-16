/**
 * Re-download site images (Pexels). Run: node scripts/fix-crop-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public/images');
const q = '?auto=compress&cs=tinysrgb&w=800';

const files = {
	// Hero — домати, чушки, краставици
	'hero/tomatoes.jpg': `https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg${q}`,
	'hero/peppers.jpg': `https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg${q}`,
	'hero/cucumbers.jpg': `https://images.pexels.com/photos/3764643/pexels-photo-3764643.jpeg${q}`,
	// Логистика — хладилен камион
	'logistics/transport.jpg': `https://images.pexels.com/photos/4489720/pexels-photo-4489720.jpeg${q}`,
	// Категории
	'crops/oil.jpg': `https://images.pexels.com/photos/4207699/pexels-photo-4207699.jpeg${q}`,
	'crops/feed.jpg': `https://images.pexels.com/photos/4220967/pexels-photo-4220967.jpeg${q}`,
	'crops/fertilizer.jpg': `https://images.pexels.com/photos/2132227/pexels-photo-2132227.jpeg${q}`,
	'crops/machines.jpg': `https://images.pexels.com/photos/1327838/pexels-photo-1327838.jpeg${q}`,
	// Обяви в каталога
	'crops/sunflower.jpg': `https://images.pexels.com/photos/46216/sunflower-flowers-bright-yellow-46216.jpeg${q}`,
	'crops/corn.jpg': `https://images.pexels.com/photos/547115/pexels-photo-547115.jpeg${q}`,
	'crops/hot-pepper.jpg': `https://images.pexels.com/photos/1656663/pexels-photo-1656663.jpeg${q}`,
	'crops/rapeseed.jpg': `https://images.pexels.com/photos/1131458/pexels-photo-1131458.jpeg${q}`,
	'crops/hay.jpg': `https://images.pexels.com/photos/1148956/pexels-photo-1148956.jpeg${q}`,
	// Зеленчуци категория — сурови чушки
	'crops/pepper.jpg': `https://images.pexels.com/photos/594137/pexels-photo-594137.jpeg${q}`,
};

async function download(url, dest) {
	const res = await fetch(url, { redirect: 'follow' });
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length < 3000) throw new Error(`too small ${buf.length}`);
	fs.writeFileSync(dest, buf);
	return buf.length;
}

for (const [rel, url] of Object.entries(files)) {
	const dest = path.join(root, rel);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	try {
		const n = await download(url, dest);
		console.log('OK', n, rel);
	} catch (e) {
		console.error('FAIL', rel, e.message);
	}
}
