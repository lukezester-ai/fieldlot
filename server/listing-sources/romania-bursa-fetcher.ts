import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import type { FieldlotListing } from '../borsa-listings-fetcher.js';

export async function fetchRomaniaBursaListings(limit = 20): Promise<FieldlotListing[]> {
	const listings: FieldlotListing[] = [];
	try {
		const targetUrl = 'https://bursacereale.com/ads';
		const apiKey = process.env.SCRAPER_API_KEY || 'bdbf0d33e9bccd8556d4be294f54e026'; // fallback for now
		const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&ultra_premium=true`;

		console.log(`[romania-bursa] Fetching page 1 via ScraperAPI...`);
		const res = await fetch(scraperUrl);
		if (!res.ok) {
			console.warn(`[romania-bursa] Request failed with status ${res.status}`);
			return listings;
		}

		const html = await res.text();
		const $ = cheerio.load(html);

		// Every ad is usually inside a container, let's just parse all <a> tags that link to an ad
		// Or look for specific ad boxes. Based on our test, links like /ad/19574 exist.
		// A common structure is a list of rows or boxes.
		// Since we didn't see the exact DOM, we will do a best-effort parse of 'a[href^="https://bursacereale.com/ad/"]' or similar.
		
		const adLinks = $('a')
			.map((_, el) => $(el).attr('href'))
			.get()
			.filter(h => h && h.includes('/ad/'));

		const uniqueLinks = [...new Set(adLinks)];
		
		// Let's also look for text blocks that look like listings
		// If we can't find structured data, we'll return an empty array for now until we refine the selector
		console.log(`[romania-bursa] Found ${uniqueLinks.length} ad links.`);

		// Limit the number of ads we fetch to save time
		const linksToFetch = uniqueLinks.slice(0, limit);
		
		await Promise.all(linksToFetch.map(async (link) => {
			try {
				const adRes = await fetch(`http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(link)}&ultra_premium=true`);
				if (!adRes.ok) return;
				const adHtml = await adRes.text();
				const $ad = cheerio.load(adHtml);
				
				const idStr = link.split('/').pop() || '';
				const listingId = `ro-bursa-${idStr}`;
				
				// Extract details from the ad page. We will do a generic extraction for now
				// Title is usually in h1 or h2
				const title = $ad('h1').first().text().trim() || $ad('title').text().replace('BursaCereale', '').replace('|', '').trim() || `Румънска обява #${idStr}`;
				
				// The text body
				const description = $ad('.description, .content, article, main').text().replace(/\s+/g, ' ').trim().substring(0, 500) || 'Автоматично извлечена обява от Румъния. Очаква пълен парсинг.';
				
				// Best guess for crop based on title
				let crop = 'Зърно';
				const titleLower = title.toLowerCase();
				if (titleLower.includes('grau') || titleLower.includes('grâu') || titleLower.includes('wheat')) crop = 'Пшеница';
				if (titleLower.includes('porumb') || titleLower.includes('corn') || titleLower.includes('maize')) crop = 'Царевица';
				if (titleLower.includes('orz') || titleLower.includes('barley')) crop = 'Ечемик';
				if (titleLower.includes('rapita') || titleLower.includes('rapiță') || titleLower.includes('rapeseed')) crop = 'Рапица';
				if (titleLower.includes('floarea') || titleLower.includes('sunflower')) crop = 'Слънчоглед';

				// Best guess for type
				let type: 'buy' | 'sell' = 'sell';
				if (titleLower.includes('cumpar') || titleLower.includes('cumpăr')) type = 'buy';
				if (titleLower.includes('vand') || titleLower.includes('vând')) type = 'sell';

				listings.push({
					id: listingId,
					type,
					title: title,
										qty: '', // Hardcoded for now until we write regex for tons
					price: 'По договаряне',
					currency: 'EUR',
					location: 'Румъния',
					publishedAt: new Date().toISOString(),
					sourceUrl: link,
					contactName: 'Румънски Търговец',
					description: description,
				});
			} catch (err) {
				console.warn(`[romania-bursa] Failed to fetch ad ${link}:`, err);
			}
		}));

	} catch (e) {
		console.error(`[romania-bursa] Error:`, e);
	}
	return listings;
}
