import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { callChatCompletions, type ChatCompletionMessage } from '../server/fieldlot-chat-handler.js';
import { resolveTextChatUpstream, openAIMessageContentToString } from '../server/llm-upstream.js';
import { getListingsSnapshot } from '../server/listings-data.js';
import { listingCrop } from '../server/fieldlot-categories.js';
import sharp from 'sharp';

const manifestPath = path.resolve('data/fieldlot-image-manifest.json');
const imagesRoot = path.resolve('public/images/crops');

async function downloadPexelsImage(query: string, destFileName: string): Promise<string | null> {
	const key = process.env.PEXELS_API_KEY?.trim();
	if (!key) {
		console.log(`[Pexels] Пропускане на търсене за "${query}", няма PEXELS_API_KEY в .env`);
		return null;
	}

	try {
		console.log(`[Pexels] Търсене за "${query}"...`);
		const searchRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
			headers: { Authorization: key }
		});
		
		if (!searchRes.ok) {
			console.error(`[Pexels] Грешка при търсене: ${searchRes.statusText}`);
			return null;
		}

		const data = await searchRes.json();
		if (!data.photos || data.photos.length === 0) {
			console.log(`[Pexels] Няма намерени снимки за "${query}"`);
			return null;
		}

		const photoUrl = data.photos[0].src.large;
		const destPath = path.join(imagesRoot, destFileName);
		
		console.log(`[Pexels] Сваляне и оразмеряване на снимка: ${photoUrl}`);
		const imgRes = await fetch(photoUrl);
		if (!imgRes.ok) throw new Error(`[Pexels] Грешка при сваляне: ${imgRes.statusText}`);
		
		const buf = Buffer.from(await imgRes.arrayBuffer());
		fs.mkdirSync(imagesRoot, { recursive: true });
		
		// Оразмеряване със sharp (width: 800px, quality: 80%)
		await sharp(buf)
			.resize({ width: 800, withoutEnlargement: true })
			.jpeg({ quality: 80 })
			.toFile(destPath);
		
		return `/images/crops/${destFileName}`;
	} catch (err) {
		console.error('[Pexels] Изключение:', err);
		return null;
	}
}

export async function curatePhotos() {
	console.log('--- Стартиране на Photo Curator Agent ---');
	
	const upstream = resolveTextChatUpstream();
	if (!upstream) {
		console.error('Грешка: Не е конфигуриран LLM (напр. MISTRAL_API_KEY).');
		return;
	}

	const snapshot = await getListingsSnapshot(true);
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	
	if (!manifest.listings) manifest.listings = {};
	if (!manifest.listingLabels) manifest.listingLabels = {};

	// Get all available distinct images
	const availableImages = Array.from(new Set([
		...Object.values(manifest.categories),
		...Object.values(manifest.listings)
	])) as string[];

	const missing = snapshot.listings.filter(l => !manifest.listings[l.id]);

	console.log(`Намерени ${snapshot.listings.length} обяви, от които ${missing.length} нямат зададена снимка.`);

	for (const listing of missing) {
		console.log(`\nОбработка на: [${listing.id}] ${listing.title} (${listing.category})`);

		const prompt = `
You are the Fieldlot Photo Curator Agent.
Your job is to pick the best image for a listing.
Listing Title: "${listing.title}"
Category: "${listing.category}"
Crop/Product: "${listingCrop(listing) ?? 'Unknown'}"

Available images paths:
${availableImages.map(img => `- ${img}`).join('\n')}

Rules:
1. If an exact or very close image exists in the available list (e.g. for wheat, corn, tractor, fertilizer), reply with:
{"action": "use_existing", "imagePath": "/images/crops/..."}
2. If NO relevant image exists (e.g. it is herbs, lavender, a specialized machine we don't have, etc.), reply with:
{"action": "download_new", "pexelsSearchQuery": "english search term", "newFileName": "descriptive-name.jpg"}

Reply strictly with valid JSON only, no markdown formatting.
`;

		try {
			const messages: ChatCompletionMessage[] = [{ role: 'user', content: prompt }];
			const { message } = await callChatCompletions(upstream, messages, { tools: false, maxTokens: 150 });
			const rawText = openAIMessageContentToString(message.content);
			
			const jsonMatch = rawText.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error('No JSON found in response: ' + rawText);
			
			const decision = JSON.parse(jsonMatch[0]);

			if (decision.action === 'use_existing' && decision.imagePath) {
				console.log(`> Агентът избра съществуваща снимка: ${decision.imagePath}`);
				manifest.listings[listing.id] = decision.imagePath;
				manifest.listingLabels[listing.id] = listing.title;
			} else if (decision.action === 'download_new' && decision.pexelsSearchQuery) {
				console.log(`> Агентът поиска нова снимка от Pexels: "${decision.pexelsSearchQuery}" -> ${decision.newFileName}`);
				const newPath = await downloadPexelsImage(decision.pexelsSearchQuery, decision.newFileName);
				if (newPath) {
					manifest.listings[listing.id] = newPath;
					manifest.listingLabels[listing.id] = listing.title;
					availableImages.push(newPath); // make it available for next listings
				} else {
					console.log('> Неуспешно сваляне, ще ползваме резервна (fall back).');
					manifest.listings[listing.id] = manifest.categories.grain; // fallback
				}
			}
		} catch (err) {
			console.error(`> Грешка при обработката на ${listing.id}:`, err);
		}
	}

	console.log('\nЗапазване на fieldlot-image-manifest.json...');
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'));

	console.log('Синхронизиране на клиентските скриптове...');
	const { execSync } = await import('node:child_process');
	execSync('node scripts/sync-images-from-manifest.mjs', { stdio: 'inherit', cwd: process.cwd() });

	console.log('Готово!');
}

import { fileURLToPath } from 'node:url';

// Allow running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	curatePhotos().catch(console.error);
}
