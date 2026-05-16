import demoListings from '../data/demo-listings.json' with { type: 'json' };
import platformKnowledge from '../data/platform-knowledge.json' with { type: 'json' };

export type FieldlotListing = {
	id: string;
	title: string;
	subtitle: string;
	category: string;
	region: string;
	role: 'sell' | 'buy' | string;
	qty: string;
	price: string;
	priceUnit: string;
	incoterm: string;
	harvest: string;
	quality: string;
	contact: string;
	tags: string[];
};

export type FieldlotChatFilters = {
	q?: string;
	category?: string;
	region?: string;
	role?: string;
};

export type FieldlotChatContext = {
	page?: 'landing' | 'catalog' | string;
	listingId?: string;
	filters?: FieldlotChatFilters;
	visibleListingIds?: string[];
};

export type FieldlotRagResult = {
	systemContext: string;
	listingIds: string[];
	knowledgeIds: string[];
};

const LISTINGS = demoListings as FieldlotListing[];
const KNOWLEDGE = platformKnowledge.chunks;

const BG_STOP = new Set([
	'и',
	'в',
	'на',
	'за',
	'с',
	'от',
	'до',
	'по',
	'да',
	'ли',
	'как',
	'какво',
	'има',
	'мога',
	'може',
	'ще',
	'е',
	'си',
	'аз',
	'ти',
	'ни',
	'ми',
	'го',
	'я',
	'the',
	'a',
	'an',
]);

const CATEGORY_LABELS: Record<string, string> = {
	grain: 'зърно',
	oilseed: 'маслодайни',
	feed: 'фураж',
	fruit: 'плодове',
	veg: 'зеленчуци',
};

const REGION_LABELS: Record<string, string> = {
	dobrudzha: 'добруджа',
	north: 'север',
	south: 'юг',
	west: 'запад',
};

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.split(/[^\p{L}\p{N}+]+/u)
		.filter((t) => t.length >= 2 && !BG_STOP.has(t));
}

function listingSearchText(item: FieldlotListing): string {
	return [
		item.id,
		item.title,
		item.subtitle,
		item.category,
		CATEGORY_LABELS[item.category] ?? '',
		item.region,
		REGION_LABELS[item.region] ?? '',
		item.role === 'buy' ? 'търсене купувач' : 'продажба',
		item.qty,
		item.price,
		item.priceUnit,
		item.incoterm,
		item.harvest,
		item.quality,
		item.contact,
		...(item.tags ?? []),
	]
		.join(' ')
		.toLowerCase();
}

function scoreListing(
	item: FieldlotListing,
	queryTokens: string[],
	ctx: FieldlotChatContext | undefined,
): number {
	let score = 0;
	if (ctx?.listingId && item.id === ctx.listingId) score += 2000;
	if (ctx?.visibleListingIds?.includes(item.id)) score += 120;
	const f = ctx?.filters;
	if (f?.category && item.category === f.category) score += 80;
	if (f?.region && item.region === f.region) score += 80;
	if (f?.role && item.role === f.role) score += 80;
	if (f?.q) {
		for (const t of tokenize(f.q)) {
			if (listingSearchText(item).includes(t)) score += 25;
		}
	}
	const hay = listingSearchText(item);
	for (const t of queryTokens) {
		if (hay.includes(t)) score += 18;
	}
	return score;
}

function scoreKnowledge(
	chunk: (typeof KNOWLEDGE)[number],
	queryTokens: string[],
): number {
	const hay = `${chunk.id} ${chunk.topics.join(' ')} ${chunk.text}`.toLowerCase();
	let score = 0;
	for (const t of queryTokens) {
		if (hay.includes(t)) score += 12;
	}
	for (const topic of chunk.topics) {
		for (const t of queryTokens) {
			if (topic.includes(t) || t.includes(topic)) score += 8;
		}
	}
	return score;
}

function formatListing(item: FieldlotListing): string {
	const roleLabel = item.role === 'buy' ? 'търсене' : 'продажба';
	return [
		`[id:${item.id}]`,
		`${item.title} (${roleLabel})`,
		`Локация: ${item.subtitle}`,
		`Количество: ${item.qty}`,
		`Цена: ${item.price} ${item.priceUnit}`,
		`Условие: ${item.incoterm}`,
		`Реколта: ${item.harvest}`,
		`Качество: ${item.quality}`,
		`Контакт: ${item.contact}`,
	].join(' | ');
}

function sessionContextBlock(ctx: FieldlotChatContext | undefined): string {
	if (!ctx) return 'Страница: неизвестна.';
	const lines = [`Страница: ${ctx.page ?? 'landing'}`];
	if (ctx.listingId) lines.push(`Отворена обява: ${ctx.listingId}`);
	if (ctx.filters) {
		const f = ctx.filters;
		const parts = [
			f.q ? `търсене="${f.q}"` : '',
			f.category ? `категория=${f.category}` : '',
			f.region ? `регион=${f.region}` : '',
			f.role ? `тип=${f.role}` : '',
		].filter(Boolean);
		if (parts.length) lines.push(`Активни филтри: ${parts.join(', ')}`);
	}
	if (ctx.visibleListingIds?.length) {
		lines.push(`Видими в момента (id): ${ctx.visibleListingIds.slice(0, 12).join(', ')}`);
	}
	return lines.join('\n');
}

export function getAllListings(): FieldlotListing[] {
	return LISTINGS;
}

export function buildFieldlotRagContext(
	userQuery: string,
	ctx?: FieldlotChatContext,
): FieldlotRagResult {
	const queryTokens = tokenize(userQuery);
	const alwaysKnowledge = ['platform-overview', 'pages-nav', 'assistant-capabilities', 'demo-disclaimer'];

	const rankedListings = LISTINGS.map((item) => ({
		item,
		score: scoreListing(item, queryTokens, ctx),
	}))
		.filter((r) => r.score > 0 || queryTokens.length === 0)
		.sort((a, b) => b.score - a.score);

	let topListings = rankedListings.slice(0, 5).map((r) => r.item);
	if (topListings.length === 0) {
		topListings = LISTINGS.slice(0, 4);
	}
	if (ctx?.listingId) {
		const pinned = LISTINGS.find((l) => l.id === ctx.listingId);
		if (pinned && !topListings.some((l) => l.id === pinned.id)) {
			topListings = [pinned, ...topListings].slice(0, 6);
		}
	}

	const rankedKnowledge = KNOWLEDGE.map((chunk) => ({
		chunk,
		score: scoreKnowledge(chunk, queryTokens),
	}))
		.sort((a, b) => b.score - a.score);

	const knowledgeIds = new Set<string>(alwaysKnowledge);
	for (const { chunk, score } of rankedKnowledge) {
		if (score > 0 || knowledgeIds.size < 6) knowledgeIds.add(chunk.id);
		if (knowledgeIds.size >= 7) break;
	}

	const knowledgeBlocks = KNOWLEDGE.filter((c) => knowledgeIds.has(c.id)).map(
		(c) => `• [${c.id}] ${c.text}`,
	);

	const listingBlocks = topListings.map((l) => `• ${formatListing(l)}`);

	const systemContext = [
		'=== RAG: ПЛАТФОРМЕНИ ЗНАНИЯ (източник на истина) ===',
		knowledgeBlocks.join('\n'),
		'',
		'=== RAG: СЕСИЯ ===',
		sessionContextBlock(ctx),
		'',
		'=== RAG: РЕЛЕВАНТНИ ДЕМО ОФЕРТИ (само тези — не измисляй други) ===',
		listingBlocks.join('\n'),
		'',
		'Правила: При въпрос за оферти използвай само редовете по-горе. Ако няма съвпадение — кажи и предложи /catalog.html или филтри. За регистрация: /#cta. Цитирай id при конкретна обява.',
	].join('\n');

	return {
		systemContext,
		listingIds: topListings.map((l) => l.id),
		knowledgeIds: [...knowledgeIds],
	};
}

export function parseFieldlotChatContext(raw: unknown): FieldlotChatContext | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	const ctx: FieldlotChatContext = {};
	if (typeof o.page === 'string' && o.page.trim()) ctx.page = o.page.trim();
	if (typeof o.listingId === 'string' && o.listingId.trim()) ctx.listingId = o.listingId.trim();
	if (Array.isArray(o.visibleListingIds)) {
		ctx.visibleListingIds = o.visibleListingIds
			.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
			.map((id) => id.trim())
			.slice(0, 24);
	}
	if (o.filters && typeof o.filters === 'object') {
		const f = o.filters as Record<string, unknown>;
		ctx.filters = {};
		if (typeof f.q === 'string') ctx.filters.q = f.q.slice(0, 200);
		if (typeof f.category === 'string') ctx.filters.category = f.category.slice(0, 40);
		if (typeof f.region === 'string') ctx.filters.region = f.region.slice(0, 40);
		if (typeof f.role === 'string') ctx.filters.role = f.role.slice(0, 20);
	}
	return ctx;
}
