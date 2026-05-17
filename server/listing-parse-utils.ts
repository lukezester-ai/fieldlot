export function stripHtml(s: string): string {
	return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function slugId(prefix: string, url: string): string {
	const tail = url.replace(/[^a-zA-Z0-9]+/g, '-').slice(-48);
	return `${prefix}-${tail}`.slice(0, 64);
}

const CATEGORY_RULES: { re: RegExp; cat: string }[] = [
	{ re: /пшеница|ечемик|царевица|лещ|зърн|овес|пшен|wheat|corn|barley|oves/i, cat: 'grain' },
	{ re: /слънчоглед|рапиц|олио|експелер|соев|sunflower|rapeseed|oil|liucerna|люцерн/i, cat: 'oilseed' },
	{ re: /ябъл|домат|чушк|плод|fruit|apple|тютюн/i, cat: 'fruit' },
	{ re: /крастав|зелен|veg|pepper/i, cat: 'veg' },
	{ re: /сено|фураж|feed|hay|бали/i, cat: 'feed' },
	{ re: /jcb|комбайн|трактор|машин|агрегат|контейнер|plug/i, cat: 'machines' },
	{ re: /бик|теле|овце|животн|саран|риб/i, cat: 'feed' },
];

const REGION_RULES: { re: RegExp; region: string; label: string }[] = [
	{ re: /добрич|тутракан|добруджа/i, region: 'dobrudzha', label: 'Добруджа' },
	{ re: /плевен|русе|шумен|търговище|разград|север|перник/i, region: 'north', label: 'Север' },
	{ re: /пловдив|стара загора|хасково|пазарджик|кърджали|юг/i, region: 'south', label: 'Юг' },
	{ re: /видин|монтана|враца/i, region: 'west', label: 'Североизапад' },
];

const CATEGORY_TAGS: Record<string, string> = {
	grain: 'Зърно',
	oilseed: 'Маслодайни',
	fruit: 'Плодове',
	veg: 'Зеленчуци',
	feed: 'Фураж',
	machines: 'Техника',
};

export function inferCategory(text: string): string {
	for (const { re, cat } of CATEGORY_RULES) {
		if (re.test(text)) return cat;
	}
	return 'grain';
}

export function inferRegion(text: string): { region: string; label: string } {
	for (const r of REGION_RULES) {
		if (r.re.test(text)) return { region: r.region, label: r.label };
	}
	return { region: 'national', label: 'България' };
}

export function categoryTag(cat: string): string {
	return CATEGORY_TAGS[cat] || 'Агро';
}

/** Извлича цена от заглавие/описание (евро, лв, €/кг). */
export function parsePriceFromText(text: string): { price: string; priceUnit: string } | null {
	const t = text.replace(/\s+/g, ' ');
	const m1 = t.match(/(\d+[\d\s,.]*)\s*(€|eur|евро)(?:\s*\/\s*кг)?/i);
	if (m1) return { price: m1[1].trim(), priceUnit: '€' };
	const m2 = t.match(/(\d+[\d\s,.]*)\s*(лв|lv|лева)/i);
	if (m2) return { price: m2[1].trim(), priceUnit: 'лв' };
	const m3 = t.match(/eur\s*(\d+)/i) || t.match(/eur(\d+)/i);
	if (m3) return { price: m3[1], priceUnit: '€' };
	const m4 = t.match(/(\d+[\d,.]*)\s*€\s*\/\s*кг/i);
	if (m4) return { price: m4[1].trim(), priceUnit: '€/кг' };
	return null;
}

export function roleFromUrl(url: string): 'sell' | 'buy' {
	return /\/(kupuv|kupuva|kupuvam|купува|купувам)(\/|$|-|_)/i.test(url) ? 'buy' : 'sell';
}
