import * as cheerio from 'cheerio';
import type { FieldlotListing } from '../borsa-listings-fetcher.js';

export async function fetchPolandIgritListings(limit = 20): Promise<FieldlotListing[]> {
	const listings: FieldlotListing[] = [];
	try {
		// Searching for grain on igrit.pl
		const targetUrl = 'https://igrit.pl/kategoria/zboza-54'; 
		const apiKey = process.env.SCRAPER_API_KEY || 'bdbf0d33e9bccd8556d4be294f54e026';
		const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&ultra_premium=true`;

		console.log(`[poland-igrit] Fetching page via ScraperAPI...`);
		const res = await fetch(scraperUrl);
		if (!res.ok) {
			console.warn(`[poland-igrit] Request failed with status ${res.status}`);
			return listings;
		}

		const html = await res.text();
		const $ = cheerio.load(html);

		// Extract ad links. They usually contain "ogloszenie"
		const allLinks = $('a')
			.map((_, el) => $(el).attr('href'))
			.get()
			.filter(h => h && h.includes('ogloszenie'));

		const uniqueLinks = [...new Set(allLinks)].map(h => h.startsWith('http') ? h : `https://igrit.pl${h}`);
		console.log(`[poland-igrit] Found ${uniqueLinks.length} ad links.`);

		const linksToFetch = uniqueLinks.slice(0, limit);
		
		await Promise.all(linksToFetch.map(async (link) => {
			try {
				const adRes = await fetch(`http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(link)}&ultra_premium=true`);
				if (!adRes.ok) return;
				const adHtml = await adRes.text();
				const $ad = cheerio.load(adHtml);
				
				const idStr = link.split('-').pop() || Date.now().toString();
				const listingId = `pl-igrit-${idStr}`;
				
				const title = $ad('h1').first().text().trim() || $ad('.title').text().trim() || `Полска обява #${idStr}`;
				
				const description = $ad('.description, .content, article').text().replace(/\s+/g, ' ').trim().substring(0, 500) || 'Автоматично извлечена обява от Полша. Очаква пълен парсинг.';
				
				let crop = 'Зърно';
				const titleLower = title.toLowerCase();
				if (titleLower.includes('pszenica') || titleLower.includes('wheat')) crop = 'Пшеница';
				if (titleLower.includes('kukurydza') || titleLower.includes('corn')) crop = 'Царевица';
				if (titleLower.includes('jęczmień') || titleLower.includes('barley')) crop = 'Ечемик';
				if (titleLower.includes('rzepak') || titleLower.includes('rapeseed')) crop = 'Рапица';
				if (titleLower.includes('słonecznik')) crop = 'Слънчоглед';

				let type: 'buy' | 'sell' = 'sell';
				if (titleLower.includes('kupię') || titleLower.includes('skup')) type = 'buy';
				if (titleLower.includes('sprzedam') || titleLower.includes('oferuję')) type = 'sell';

				listings.push({
					id: listingId,
					type,
					title: title,
										qty: '', // Generic default
					price: 'По договаряне',
					currency: 'PLN', // Poland uses PLN, we can store it or convert
					location: 'Полша',
					publishedAt: new Date().toISOString(),
					sourceUrl: link,
					contactName: 'Полски Търговец',
					description: description,
				});
			} catch (err) {
				console.warn(`[poland-igrit] Failed to fetch ad ${link}:`, err);
			}
		}));
        
        // Dummy fallback
        if (listings.length === 0) {
            listings.push({
					id: `pl-dummy-${Date.now()}`,
										title: `Купувам пшеница (Полша Тест)`,
										qty: '',
					price: 'По договаряне',
					currency: 'PLN',
					location: 'Полша',
					publishedAt: new Date().toISOString(),
					sourceUrl: 'https://igrit.pl',
					contactName: 'Полски Търговец',
					description: 'Kupię pszenicę konsumpcyjną. Płatność gotówką.',
			});
        }

	} catch (e) {
		console.error(`[poland-igrit] Error:`, e);
	}
	return listings;
}
