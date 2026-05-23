import fs from 'node:fs';
import path from 'node:path';
import { classifyAgroImage } from '../server/fieldlot-vision.js';

async function main() {
	console.log('Starting AI curation of local images...');
	const manifestPath = path.join(process.cwd(), 'public/data/fieldlot-image-manifest.json');
	if (!fs.existsSync(manifestPath)) {
		console.log('No manifest found.');
		return;
	}
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const images = manifest.images || [];

	let processed = 0;
	// Process only a few images to avoid long API waits/costs in demo
	const toProcess = images.filter((img) => !img.category || img.category === 'grain').slice(0, 3);
	if (toProcess.length === 0) {
		console.log('No new images to curate.');
		return;
	}

	for (const img of toProcess) {
		const fullPath = path.join(process.cwd(), 'public/images', img.path);
		if (!fs.existsSync(fullPath)) continue;
		console.log(`\nCurating ${img.path}...`);
		const b64 = fs.readFileSync(fullPath, 'base64');
		const result = await classifyAgroImage({ imageBase64: b64, mimeType: 'image/jpeg', lang: 'bg' });
		if (result.ok) {
			console.log(` ✅ Category: ${result.category}, Crop: ${result.crop || 'none'}`);
			console.log(`    Labels: ${result.labels.join(', ')}`);
		} else {
			console.log(` ❌ Failed: ${result.error}`);
		}
		processed++;
	}
	console.log(`\nDone. Processed ${processed} images.`);
}

main().catch(console.error);
