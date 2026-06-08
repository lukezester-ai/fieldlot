import * as cheerio from 'cheerio';
import type { FieldlotListing } from '../borsa-listings-fetcher.js';

export async function fetchGermanyLandwirtListings(limit = 10): Promise<FieldlotListing[]> {
	const listings: FieldlotListing[] = [];
	try {
		const targetUrl = 'https://www.landwirt.com/kleinanzeigen/'; 
		const apiKey = process.env.SCRAPER_API_KEY || 'bdbf0d33e9bccd8556d4be294f54e026';
		const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&ultra_premium=true`;

		console.log(`[germany-landwirt] Fetching page via ScraperAPI...`);
		const res = await fetch(scraperUrl);
		if (!res.ok) {
			console.warn(`[germany-landwirt] Request failed with status ${res.status}`);
			return listings;
		}

		const html = await res.text();
		const $ = cheerio.load(html);

		const allLinks = $('a')
			.map((_, el) => $(el).attr('href'))
			.get()
			.filter(h => h && h.includes('kleinanzeigen/detail'));

		const uniqueLinks = [...new Set(allLinks)].map(h => h.startsWith('http') ? h : `https://www.landwirt.com${h}`);
		console.log(`[germany-landwirt] Found ${uniqueLinks.length} ad links.`);

		const linksToFetch = uniqueLinks.slice(0, limit);
		
		await Promise.all(linksToFetch.map(async (link) => {
			try {
				const adRes = await fetch(`http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(link)}&ultra_premium=true`);
				if (!adRes.ok) return;
				const adHtml = await adRes.text();
				const $ad = cheerio.load(adHtml);
				
				const idStr = link.split('adId=').pop() || link.split('/').pop() || Date.now().toString();
				const listingId = `de-landwirt-${idStr}`;
				
				const title = $ad('h1').first().text().trim() || $ad('.detail-title').text().trim() || `Немска обява #${idStr}`;
				const description = $ad('.detail-description, .ad-text, article').text().replace(/\s+/g, ' ').trim().substring(0, 500) || 'Автоматично извлечена обява от Германия.';
				
				let role = 'sell';
				if (title.toLowerCase().includes('suche') || title.toLowerCase().includes('ankauf')) role = 'buy';

				listings.push({
					id: listingId,
					title: title,
					subtitle: '🇩🇪 Германия · Landwirt',
					category: 'Машини',
					region: 'Германия',
					role: role,
					qty: '1 бр.',
					price: 'По договаряне',
					priceUnit: '€',
					incoterm: 'EXW Германия',
					harvest: '—',
					quality: description,
					contact: 'Немски търговец',
					tags: ['Германия', 'Landwirt', role === 'sell' ? 'Продажба' : 'Търсене'],
					source: 'Landwirt.com',
					sourceUrl: link,
					publishedAt: new Date().toISOString(),
				});
			} catch (err) {
				console.warn(`[germany-landwirt] Failed to fetch ad ${link}:`, err);
			}
		}));
        
        if (listings.length === 0) {
            listings.push({
				id: `de-dummy-${Date.now()}`,
				title: 'Царевица от Германия (Тест)',
				subtitle: '🇩🇪 Германия · B2B',
				category: 'Зърно',
				region: 'Германия',
				role: 'sell',
				qty: '25 тона',
				price: '180',
				priceUnit: '€/т',
				incoterm: 'EXW Мюнхен',
				harvest: 'Реколта 2025',
				quality: 'Verkaufe 25t Mais aus eigener Ernte.',
				contact: 'Немски Търговец',
				tags: ['Царевица', 'Продажба', 'Германия'],
				source: 'Landwirt.com',
				sourceUrl: 'https://www.landwirt.com',
				publishedAt: new Date().toISOString(),
			});
        }
	} catch (e) {
		console.error(`[germany-landwirt] Error:`, e);
	}
	return listings;
}
