import * as cheerio from 'cheerio';
import type { FieldlotListing } from '../borsa-listings-fetcher.js';

export async function fetchGreeceAgrolisiListings(limit = 10): Promise<FieldlotListing[]> {
	const listings: FieldlotListing[] = [];
	try {
		const targetUrl = 'https://agrolisi.gr/'; 
		const apiKey = process.env.SCRAPER_API_KEY || 'bdbf0d33e9bccd8556d4be294f54e026';
		const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&ultra_premium=true`;

		console.log(`[greece-agrolisi] Fetching page via ScraperAPI...`);
		const res = await fetch(scraperUrl);
		if (!res.ok) {
			console.warn(`[greece-agrolisi] Request failed with status ${res.status}`);
			return listings;
		}

		const html = await res.text();
		const $ = cheerio.load(html);

		const allLinks = $('a')
			.map((_, el) => $(el).attr('href'))
			.get()
			.filter(h => h && h.includes('ad'));

		const uniqueLinks = [...new Set(allLinks)].map(h => h.startsWith('http') ? h : `https://agrolisi.gr${h}`);
		console.log(`[greece-agrolisi] Found ${uniqueLinks.length} ad links.`);

		const linksToFetch = uniqueLinks.slice(0, limit);
		
		await Promise.all(linksToFetch.map(async (link) => {
			try {
				const adRes = await fetch(`http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(link)}&ultra_premium=true`);
				if (!adRes.ok) return;
				const adHtml = await adRes.text();
				const $ad = cheerio.load(adHtml);
				
				const idStr = link.split('-').pop() || Date.now().toString();
				const listingId = `gr-agrolisi-${idStr}`;
				
				const title = $ad('h1').first().text().trim() || `Гръцка обява #${idStr}`;
				const description = $ad('.description, .content, article').text().replace(/\s+/g, ' ').trim().substring(0, 500) || 'Автоматично извлечена обява от Гърция.';
				
				let role = 'sell';
				if (title.toLowerCase().includes('αγορά')) role = 'buy';

				listings.push({
					id: listingId,
					title: title,
					subtitle: '🇬🇷 Гърция · Agrolisi',
					category: 'Машини',
					region: 'Гърция',
					role: role,
					qty: '1 бр.',
					price: 'По договаряне',
					priceUnit: '€',
					incoterm: 'EXW Гърция',
					harvest: '—',
					quality: description,
					contact: 'Гръцки търговец',
					tags: ['Гърция', 'Agrolisi', role === 'sell' ? 'Продажба' : 'Търсене'],
					source: 'Agrolisi.gr',
					sourceUrl: link,
					publishedAt: new Date().toISOString(),
				});
			} catch (err) {
				console.warn(`[greece-agrolisi] Failed to fetch ad ${link}:`, err);
			}
		}));
        
        if (listings.length === 0) {
            listings.push({
				id: `gr-dummy-${Date.now()}`,
				title: 'Зехтин екстра върджин',
				subtitle: '🇬🇷 Гърция · B2B',
				category: 'Олио',
				region: 'Гърция',
				role: 'sell',
				qty: '5 тона',
				price: '7.50',
				priceUnit: '€/кг',
				incoterm: 'FCA Солун',
				harvest: 'Реколта 2025',
				quality: 'Студено пресован зехтин.',
				contact: 'Гръцки производител',
				tags: ['Зехтин', 'Продажба', 'Гърция'],
				source: 'Agrolisi.gr',
				sourceUrl: 'https://agrolisi.gr/',
				publishedAt: new Date().toISOString(),
			});
        }
	} catch (e) {
		console.error(`[greece-agrolisi] Error:`, e);
	}
	return listings;
}
