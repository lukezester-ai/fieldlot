/**
 * Download all Fieldlot JPG assets from manifest (Pexels).
 * Run: npm run sync:images
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public/images');
const q = '?auto=compress&cs=tinysrgb&w=1200';

/** rel path → Pexels CDN URL (agriculture-themed, matched to filename role) */
const files = {
	// Hero
	'hero/background.jpg': `https://images.pexels.com/photos/265216/pexels-photo-265216.jpeg${q}`,
	'hero/farm.jpg': `https://images.pexels.com/photos/2132171/pexels-photo-2132171.jpeg${q}`,
	'hero/tomatoes.jpg': `https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg${q}`,
	'hero/peppers.jpg': `https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg${q}`,
	'hero/cucumbers.jpg': `https://images.pexels.com/photos/3764643/pexels-photo-3764643.jpeg${q}`,
	// Categories & listings
	'crops/pepper.jpg': `https://images.pexels.com/photos/594137/pexels-photo-594137.jpeg${q}`,
	'crops/apple.jpg': `https://images.pexels.com/photos/1456291/pexels-photo-1456291.jpeg${q}`,
	'crops/wheat.jpg': `https://images.pexels.com/photos/265216/pexels-photo-265216.jpeg${q}`,
	'crops/oil.jpg': `https://images.pexels.com/photos/4207699/pexels-photo-4207699.jpeg${q}`,
	'crops/canned.jpg': `https://images.pexels.com/photos/4198479/pexels-photo-4198479.jpeg${q}`,
	'crops/fertilizer.jpg': `https://images.pexels.com/photos/2132227/pexels-photo-2132227.jpeg${q}`,
	'crops/machines.jpg': `https://images.pexels.com/photos/1327838/pexels-photo-1327838.jpeg${q}`,
	'crops/feed.jpg': `https://images.pexels.com/photos/4220967/pexels-photo-4220967.jpeg${q}`,
	'crops/sunflower.jpg': `https://images.pexels.com/photos/46216/sunflower-flowers-bright-yellow-46216.jpeg${q}`,
	'crops/corn.jpg': `https://images.pexels.com/photos/547115/pexels-photo-547115.jpeg${q}`,
	'crops/barley.jpg': `https://images.pexels.com/photos/579471/pexels-photo-579471.jpeg${q}`,
	'crops/hot-pepper.jpg': `https://images.pexels.com/photos/1656663/pexels-photo-1656663.jpeg${q}`,
	'crops/rapeseed.jpg': `https://images.pexels.com/photos/1131458/pexels-photo-1131458.jpeg${q}`,
	'crops/hay.jpg': `https://images.pexels.com/photos/1148956/pexels-photo-1148956.jpeg${q}`,
	// Farmers
	'farmers/spotlight.jpg': `https://images.pexels.com/photos/2255935/pexels-photo-2255935.jpeg${q}`,
	'farmers/ivan.jpg': `https://images.pexels.com/photos/2252584/pexels-photo-2252584.jpeg${q}`,
	'farmers/maria.jpg': `https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg${q}`,
	'farmers/georgi.jpg': `https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg${q}`,
	'farmers/petar.jpg': `https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg${q}`,
	// Logistics
	'logistics/transport.jpg': `https://images.pexels.com/photos/4489720/pexels-photo-4489720.jpeg${q}`,
	'logistics/warehouse.jpg': `https://images.pexels.com/photos/4483618/pexels-photo-4483618.jpeg${q}`,
	'logistics/tracking.jpg': `https://images.pexels.com/photos/4483611/pexels-photo-4483611.jpeg${q}`,
};

async function download(url, dest) {
	const res = await fetch(url, {
		redirect: 'follow',
		headers: { 'User-Agent': 'FieldlotImageSync/1.0' },
	});
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length < 3000) throw new Error(`too small ${buf.length}`);
	fs.writeFileSync(dest, buf);
	return buf.length;
}

let ok = 0;
let fail = 0;
for (const [rel, url] of Object.entries(files)) {
	const dest = path.join(root, rel);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	try {
		const n = await download(url, dest);
		console.log('OK', n, rel);
		ok += 1;
	} catch (e) {
		console.error('FAIL', rel, e.message);
		fail += 1;
	}
}
console.log(`Done: ${ok} ok, ${fail} failed, ${Object.keys(files).length} total`);
process.exit(fail > 0 ? 1 : 0);
