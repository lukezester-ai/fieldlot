import imageManifest from '../data/fieldlot-image-manifest.json' with { type: 'json' };
import platformKnowledge from '../data/platform-knowledge.json' with { type: 'json' };
import {
	CATEGORY_LABELS_BG,
	formatCategoriesForRag,
	listingCrop,
	matchListingCategory,
	normalizeCategory,
} from './fieldlot-categories.js';
import { listingImageRagLine, resolveListingImage } from './listing-image-resolve.js';
import { getAllListingsSync, type FieldlotListing } from './listings-data.js';

export type { FieldlotListing };

export type FieldlotChatFilters = {
	q?: string;
	category?: string;
	crop?: string;
	region?: string;
	role?: string;
};

export type FieldlotChatContext = {
	page?: 'landing' | 'catalog' | string;
	lang?: 'bg' | 'en' | 'de' | string;
	listingId?: string;
	filters?: FieldlotChatFilters;
	visibleListingIds?: string[];
};

export type FieldlotRagResult = {
	systemContext: string;
	listingIds: string[];
	knowledgeIds: string[];
};

const LISTINGS = getAllListingsSync();
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

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
	Object.entries(CATEGORY_LABELS_BG).map(([k, v]) => [k, v.toLowerCase()]),
);

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
	if (f?.category && matchListingCategory(item, f.category)) score += 80;
	if (f?.crop && listingCrop(item) === f.crop.trim().toLowerCase()) score += 60;
	if (f?.region && (item.region === f.region || item.region === 'national')) score += 80;
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

function formatListing(item: FieldlotListing): string {
	const roleLabel = item.role === 'buy' ? 'търсене' : 'продажба';
	const manifestMap = imageManifest.listings as Record<string, string>;
	const meta = resolveListingImage(item, manifestMap);
	const crop = listingCrop(item);
	return [
		`[id:${item.id}]`,
		`${item.title} (${roleLabel})`,
		`Категория: ${normalizeCategory(item.category)}${crop ? ` · култура: ${crop}` : ''}`,
		listingImageRagLine(item, manifestMap),
		`alt: ${meta.altBg}`,
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
			f.crop ? `култура=${f.crop}` : '',
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

	/** Пълен RAG: knowledge + каталог обяви (borsaagro) + image manifest */
	const knowledgeIds = KNOWLEDGE.map((c) => c.id);
	const knowledgeBlocks = KNOWLEDGE.map((c) => `• [${c.id}] ${c.text}`);

	const rankedListings = LISTINGS.map((item) => ({
		item,
		score: scoreListing(item, queryTokens, ctx),
	})).sort((a, b) => b.score - a.score);

	const listingBlocks = LISTINGS.map((l) => `• ${formatListing(l)}`);

	const manifestJson = JSON.stringify(imageManifest, null, 0).slice(0, 12000);

	const systemContext = [
		'=== RAG: ПЪЛНО ЗНАНИЕ ЗА САЙТА (единствен източник на истина) ===',
		knowledgeBlocks.join('\n'),
		'',
		'=== RAG: IMAGE MANIFEST (JSON) ===',
		manifestJson,
		'',
		formatCategoriesForRag(ctx?.lang === 'en' ? 'en' : 'bg'),
		'',
		'=== RAG: СЕСИЯ ===',
		sessionContextBlock(ctx),
		'',
		`=== RAG: КАТАЛОГ ОФЕРТИ (${LISTINGS.length} бр., borsaagro.com) ===`,
		listingBlocks.join('\n'),
		'',
		'=== RAG: ПРАВИЛА ===',
		'1) Отговаряй САМО от блоковете по-горе — не измисляй оферти, URL, цени или функции.',
		'2) За снимки: всяка обява има РАЗЛИЧНА снимка по култура (пшеница≠ечемик≠царевица≠слънчоглед≠олио). Ползвай реда „Снимка в UI“ от каталога — НЕ описвай царевица при пшеница/ечемик.',
		'3) Навигация: / , /catalog.html , /#cta , /#categories , /#listings , /#exchange , /#logistics , /#farmers , /#ai',
		'4) Регистрация: /#cta · форма POST /api/register-interest',
		'5) Чат backend: Mistral (MISTRAL_API_KEY) → Ollama → OpenAI',
		'6) Обявите са от публичен източник (borsaagro.com) — насочи към sourceUrl за оригинал. Без escrow през Fieldlot.',
	].join('\n');

	const topForMeta = rankedListings.slice(0, 5).map((r) => r.item);

	return {
		systemContext,
		listingIds: topForMeta.map((l) => l.id),
		knowledgeIds,
	};
}

export function parseFieldlotChatContext(raw: unknown): FieldlotChatContext | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	const ctx: FieldlotChatContext = {};
	if (typeof o.page === 'string' && o.page.trim()) ctx.page = o.page.trim();
	if (typeof o.lang === 'string') {
		const lang = o.lang.trim().toLowerCase();
		if (lang === 'en' || lang === 'bg') ctx.lang = lang;
	}
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
		if (typeof f.crop === 'string') ctx.filters.crop = f.crop.slice(0, 40);
		if (typeof f.region === 'string') ctx.filters.region = f.region.slice(0, 40);
		if (typeof f.role === 'string') ctx.filters.role = f.role.slice(0, 20);
	}
	return ctx;
}
