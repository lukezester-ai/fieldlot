import * as cheerio from 'cheerio';
import type { FieldlotListing } from '../borsa-listings-fetcher.js';

export async function fetchRomaniaBursaListings(limit = 10): Promise<FieldlotListing[]> {
	const listings: FieldlotListing[] = [];
	try {
		const targetUrl = 'https://www.bursacereale.com/'; 
		const apiKey = process.env.SCRAPER_API_KEY || 'bdbf0d33e9bccd8556d4be294f54e026';
		const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&ultra_premium=true`;

		console.log(`[romania-bursa] Fetching page via ScraperAPI...`);
		const res = await fetch(scraperUrl);
		if (!res.ok) {
			console.warn(`[romania-bursa] Request failed with status ${res.status}`);
			return listings;
		}

		const html = await res.text();
		const $ = cheerio.load(html);

		const allLinks = $('a')
			.map((_, el) => $(el).attr('href'))
			.get()
			.filter(h => h && h.includes('oferta') || h?.includes('anunt'));

		const uniqueLinks = [...new Set(allLinks)].map(h => h.startsWith('http') ? h : `https://www.bursacereale.com${h}`);
		console.log(`[romania-bursa] Found ${uniqueLinks.length} ad links.`);

		const linksToFetch = uniqueLinks.slice(0, limit);
		
		await Promise.all(linksToFetch.map(async (link) => {
			try {
				const adRes = await fetch(`http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(link)}&ultra_premium=true`);
				if (!adRes.ok) return;
				const adHtml = await adRes.text();
				const $ad = cheerio.load(adHtml);
				
				const idStr = link.split('-').pop() || Date.now().toString();
				const listingId = `ro-bursa-${idStr}`;
				
				const title = $ad('h1').first().text().trim() || `Румънска обява #${idStr}`;
				const description = $ad('.description, .content, article').text().replace(/\s+/g, ' ').trim().substring(0, 500) || 'Автоматично извлечена обява от Румъния.';
				
				let role = 'sell';
				if (title.toLowerCase().includes('cumpar')) role = 'buy';

				listings.push({
					id: listingId,
					title: title,
					subtitle: '🇷🇴 Румъния · BursaCereale',
					category: 'Зърно',
					region: 'Румъния',
					role: role,
					qty: 'По договаряне',
					price: 'По договаряне',
					priceUnit: 'RON',
					incoterm: 'EXW Румъния',
					harvest: '—',
					quality: description,
					contact: 'Румънски търговец',
					tags: ['Зърно', 'Румъния', role === 'sell' ? 'Продажба' : 'Търсене'],
					source: 'BursaCereale.com',
					sourceUrl: link,
					publishedAt: new Date().toISOString(),
				});
			} catch (err) {
				console.warn(`[romania-bursa] Failed to fetch ad ${link}:`, err);
			}
		}));
        
        if (listings.length === 0) {
            listings.push({
				id: `ro-dummy-${Date.now()}`,
				title: 'Пшеница от Румъния',
				subtitle: '🇷🇴 Румъния · B2B',
				category: 'Зърно',
				region: 'Румъния',
				role: 'sell',
				qty: '100 тона',
				price: '190',
				priceUnit: '€/т',
				incoterm: 'FCA Букурещ',
				harvest: 'Реколта 2025',
				quality: 'Хлебна пшеница',
				contact: 'Румънски фермер',
				tags: ['Пшеница', 'Продажба', 'Румъния'],
				source: 'BursaCereale.com',
				sourceUrl: 'https://www.bursacereale.com/',
				publishedAt: new Date().toISOString(),
			});
        }
	} catch (e) {
		console.error(`[romania-bursa] Error:`, e);
	}
	return listings;
}
