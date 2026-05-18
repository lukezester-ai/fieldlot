/**
 * Fieldlot — писане и редакция на B2B агро обяви (шаблони + LLM полиране).
 */
import type { FieldlotListing } from './borsa-listings-fetcher.js';
import {
	CATEGORY_LABELS_BG,
	CATEGORY_LABELS_EN,
	CROP_LABELS_BG,
	enrichListing,
	inferCategory,
	inferCrop,
	normalizeCategory,
	type FieldlotCategoryId,
} from './fieldlot-categories.js';
import {
	openAIMessageContentToString,
	resolveTextChatUpstream,
} from './llm-upstream.js';

export type ListingDraftInput = {
	lang?: 'bg' | 'en';
	role?: 'sell' | 'buy';
	product?: string;
	category?: string;
	crop?: string;
	qty?: string;
	region?: string;
	regionLabel?: string;
	price?: string;
	priceUnit?: string;
	incoterm?: string;
	harvest?: string;
	quality?: string;
	contact?: string;
	notes?: string;
};

export type ListingDraft = {
	title: string;
	subtitle: string;
	category: FieldlotCategoryId;
	crop?: string;
	region: string;
	role: 'sell' | 'buy';
	qty: string;
	price: string;
	priceUnit: string;
	incoterm: string;
	harvest: string;
	quality: string;
	contact: string;
	tags: string[];
	formattedText: string;
	checklist: string[];
};

const REGION_LABELS: Record<string, { bg: string; en: string }> = {
	dobrudzha: { bg: 'Добруджа', en: 'Dobrudzha' },
	north: { bg: 'Север', en: 'North' },
	south: { bg: 'Юг', en: 'South' },
	west: { bg: 'Североизапад', en: 'Northwest' },
	national: { bg: 'България', en: 'Bulgaria' },
};

function clean(s: string | undefined, max = 500): string {
	return String(s ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

function regionLabel(region: string, lang: 'bg' | 'en'): string {
	return REGION_LABELS[region]?.[lang] ?? region;
}

function defaultPriceUnit(role: 'sell' | 'buy', lang: 'bg' | 'en'): string {
	if (role === 'buy') return lang === 'en' ? 'buyer offer' : 'купувач';
	return lang === 'en' ? 'BGN/t' : 'лв/т';
}

function buildChecklist(d: ListingDraft, lang: 'bg' | 'en'): string[] {
	const missing: string[] = [];
	const en = lang === 'en';
	if (!d.qty || d.qty === '—') missing.push(en ? 'Quantity (tons)' : 'Количество (тонове)');
	if (!d.price || d.price === '—' || d.price === 'по дог.')
		missing.push(en ? 'Price or "on request"' : 'Цена или „по договорение“');
	if (!d.contact || d.contact === '—')
		missing.push(en ? 'Contact (phone/email)' : 'Контакт (телефон/имейл)');
	if (!d.quality || d.quality.length < 12)
		missing.push(en ? 'Quality / specification' : 'Качество / спецификация');
	if (d.region === 'national') missing.push(en ? 'Specific region' : 'Конкретен регион');
	return missing;
}

function formatListingText(d: ListingDraft, lang: 'bg' | 'en'): string {
	const en = lang === 'en';
	const catLabel = en ? CATEGORY_LABELS_EN[d.category] : CATEGORY_LABELS_BG[d.category];
	const cropLabel = d.crop ? (CROP_LABELS_BG[d.crop] || d.crop) : '';
	const roleLabel = d.role === 'buy' ? (en ? 'BUY' : 'ТЪРСЕНЕ') : en ? 'SELL' : 'ПРОДАЖБА';
	const lines = [
		`【${roleLabel}】 ${d.title}`,
		`${d.subtitle} · ${catLabel}${cropLabel ? ` · ${cropLabel}` : ''}`,
		'',
		en ? `Quantity: ${d.qty}` : `Количество: ${d.qty}`,
		en ? `Price: ${d.price} ${d.priceUnit}` : `Цена: ${d.price} ${d.priceUnit}`,
		en ? `Terms: ${d.incoterm}` : `Условие: ${d.incoterm}`,
		en ? `Harvest: ${d.harvest}` : `Реколта: ${d.harvest}`,
		'',
		en ? 'Quality / spec:' : 'Качество / спецификация:',
		d.quality,
		'',
		en ? `Contact: ${d.contact}` : `Контакт: ${d.contact}`,
	];
	if (d.checklist.length) {
		lines.push('', en ? 'To complete:' : 'Допълни:', ...d.checklist.map((x) => `• ${x}`));
	}
	lines.push('', en ? '— Draft for Fieldlot (phase 1, direct deal)' : '— Чернова за Fieldlot (фаза 1, директна сделка)');
	return lines.join('\n');
}

export function draftListingFromFacts(input: ListingDraftInput): ListingDraft {
	const lang: 'bg' | 'en' = input.lang === 'en' ? 'en' : 'bg';
	const role: 'sell' | 'buy' = input.role === 'buy' ? 'buy' : 'sell';
	const product = clean(input.product, 120) || (lang === 'en' ? 'Agro product' : 'Агро продукт');
	const hay = [product, input.quality, input.notes].filter(Boolean).join(' ');
	const category = normalizeCategory(input.category || inferCategory(hay));
	const crop = clean(input.crop, 40) || inferCrop(hay);
	const region = clean(input.region, 40) || 'national';
	const regLbl =
		clean(input.regionLabel, 80) ||
		(region !== 'national' ? regionLabel(region, lang) : lang === 'en' ? 'Bulgaria' : 'България');

	const title =
		role === 'buy' && !/търсен|купува|buy/i.test(product)
			? lang === 'en'
				? `${product} — wanted`
				: `${product} — търсене`
			: product;

	const qty = clean(input.qty, 80) || '—';
	const price = clean(input.price, 60) || (lang === 'en' ? 'on request' : 'по дог.');
	const priceUnit = clean(input.priceUnit, 40) || defaultPriceUnit(role, lang);
	const incoterm =
		clean(input.incoterm, 120) ||
		(lang === 'en' ? 'To be agreed (FCA/EXW)' : 'По договаряне (FCA/EXW)');
	const harvest = clean(input.harvest, 80) || (lang === 'en' ? '2025 campaign' : 'Кампания 2025');
	const quality =
		clean(input.quality, 600) ||
		(lang === 'en'
			? 'Specification to be confirmed (moisture, class, documents on request).'
			: 'Спецификация по договаряне (влага, клас, документи при запитване).');
	const contact =
		clean(input.contact, 200) ||
		(lang === 'en' ? 'Contact via Fieldlot early access (#cta)' : 'Контакт чрез Fieldlot ранен достъп (#cta)');

	const roleTag = role === 'buy' ? (lang === 'en' ? 'Wanted' : 'Търсене') : lang === 'en' ? 'Sale' : 'Продажба';
	const tags = [lang === 'en' ? CATEGORY_LABELS_EN[category] : CATEGORY_LABELS_BG[category], roleTag];
	if (crop) tags.push(`crop:${crop}`);

	const draft: ListingDraft = {
		title,
		subtitle: regLbl,
		category,
		crop: crop || undefined,
		region,
		role,
		qty,
		price,
		priceUnit,
		incoterm,
		harvest,
		quality,
		contact,
		tags,
		formattedText: '',
		checklist: [],
	};
	draft.checklist = buildChecklist(draft, lang);
	draft.formattedText = formatListingText(draft, lang);
	return draft;
}

export function listingToDraft(item: FieldlotListing, lang: 'bg' | 'en' = 'bg'): ListingDraft {
	const localized = enrichListing(item);
	const draft = draftListingFromFacts({
		lang,
		role: item.role === 'buy' ? 'buy' : 'sell',
		product: item.title,
		category: localized.category,
		crop: localized.tags?.find((t) => t.startsWith('crop:'))?.replace('crop:', ''),
		qty: item.qty,
		region: item.region,
		regionLabel: item.subtitle?.split('·')[0]?.trim(),
		price: item.price,
		priceUnit: item.priceUnit,
		incoterm: item.incoterm,
		harvest: item.harvest,
		quality: item.quality,
		contact: item.contact,
	});
	return draft;
}

export async function polishListingDraft(
	draft: ListingDraft,
	opts?: { lang?: 'bg' | 'en'; style?: 'professional' | 'short' },
): Promise<ListingDraft> {
	const upstream = resolveTextChatUpstream();
	if (!upstream) return draft;

	const lang = opts?.lang ?? 'bg';
	const style = opts?.style ?? 'professional';
	const en = lang === 'en';

	const system = en
		? `You are a Bulgarian B2B agro copywriter for Fieldlot. Rewrite the listing draft: clear, factual, no hype, no invented prices. Keep JSON structure. Style: ${style}.`
		: `Ти си копирайтър за B2B агро обяви на Fieldlot. Препиши черновата: ясно, фактологично, без измислени цени. Запази JSON структурата. Стил: ${style}.`;

	const user = `${en ? 'Draft JSON' : 'Чернова JSON'}:\n${JSON.stringify(draft, null, 0)}\n\n${en ? 'Return ONLY JSON with keys: title, subtitle, quality, formattedText (full ad text). Do not change category, role, price numbers unless already in draft.' : 'Върни САМО JSON с ключове: title, subtitle, quality, formattedText (пълен текст на обявата). Не променяй category, role, price освен ако вече са в черновата.'}`;

	try {
		const res = await fetch(upstream.completionUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(upstream.bearer ? { Authorization: `Bearer ${upstream.bearer}` } : {}),
			},
			body: JSON.stringify({
				model: upstream.model,
				temperature: 0.35,
				max_tokens: 900,
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user },
				],
			}),
			signal: AbortSignal.timeout(45_000),
		});
		const data = (await res.json()) as {
			choices?: { message?: { content?: unknown } }[];
			error?: { message?: string };
		};
		if (!res.ok) throw new Error(data.error?.message || res.statusText);
		const raw = openAIMessageContentToString(data.choices?.[0]?.message?.content);
		const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}') as Record<string, unknown>;
		if (typeof parsed.title === 'string' && parsed.title.trim()) draft.title = parsed.title.trim().slice(0, 120);
		if (typeof parsed.subtitle === 'string' && parsed.subtitle.trim())
			draft.subtitle = parsed.subtitle.trim().slice(0, 120);
		if (typeof parsed.quality === 'string' && parsed.quality.trim())
			draft.quality = parsed.quality.trim().slice(0, 600);
		if (typeof parsed.formattedText === 'string' && parsed.formattedText.trim())
			draft.formattedText = parsed.formattedText.trim().slice(0, 2500);
		else draft.formattedText = formatListingText(draft, lang);
		draft.checklist = buildChecklist(draft, lang);
	} catch {
		/* keep rule-based draft */
	}
	return draft;
}

export async function editListingDraft(
	base: ListingDraft,
	editInstructions: string,
	opts?: { lang?: 'bg' | 'en'; polish?: boolean },
): Promise<ListingDraft> {
	const lang = opts?.lang ?? 'bg';
	const instr = clean(editInstructions, 1500);
	if (!instr) return base;

	const upstream = resolveTextChatUpstream();
	if (!upstream) {
		const en = lang === 'en';
		return {
			...base,
			quality: `${base.quality}\n${en ? 'Edit note' : 'Бележка'}: ${instr}`.slice(0, 600),
			formattedText: formatListingText(base, lang),
		};
	}

	const en = lang === 'en';
	const system = en
		? 'You edit Bulgarian B2B agro listings for Fieldlot. Apply user instructions. Return full updated JSON for all listing fields. No invented market prices. factual tone.'
		: 'Редактираш B2B агро обяви за Fieldlot. Приложи инструкциите на потребителя. Върни пълен обновен JSON за всички полета. Без измислени пазарни цени.';

	const user = `${en ? 'Current draft' : 'Текуща чернова'}:\n${JSON.stringify(base)}\n\n${en ? 'Instructions' : 'Инструкции'}: ${instr}\n\n${en ? 'Return ONLY JSON: title, subtitle, category, crop, region, role, qty, price, priceUnit, incoterm, harvest, quality, contact, tags, formattedText' : 'Върни САМО JSON: title, subtitle, category, crop, region, role, qty, price, priceUnit, incoterm, harvest, quality, contact, tags, formattedText'}`;

	try {
		const res = await fetch(upstream.completionUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(upstream.bearer ? { Authorization: `Bearer ${upstream.bearer}` } : {}),
			},
			body: JSON.stringify({
				model: upstream.model,
				temperature: 0.4,
				max_tokens: 1100,
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user },
				],
			}),
			signal: AbortSignal.timeout(50_000),
		});
		const data = (await res.json()) as {
			choices?: { message?: { content?: unknown } }[];
		};
		if (!res.ok) return base;
		const raw = openAIMessageContentToString(data.choices?.[0]?.message?.content);
		const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}') as Record<string, unknown>;
		const merged = { ...base } as ListingDraft;
		const str = (k: keyof ListingDraft, max: number) => {
			if (typeof p[k] === 'string' && (p[k] as string).trim()) (merged[k] as string) = (p[k] as string).trim().slice(0, max);
		};
		str('title', 120);
		str('subtitle', 120);
		str('qty', 80);
		str('price', 60);
		str('priceUnit', 40);
		str('incoterm', 120);
		str('harvest', 80);
		str('quality', 600);
		str('contact', 200);
		str('formattedText', 2500);
		if (typeof p.category === 'string') merged.category = normalizeCategory(p.category);
		if (typeof p.crop === 'string' && p.crop) merged.crop = String(p.crop).slice(0, 40);
		if (typeof p.region === 'string') merged.region = String(p.region).slice(0, 40);
		if (p.role === 'buy' || p.role === 'sell') merged.role = p.role;
		if (Array.isArray(p.tags)) merged.tags = p.tags.map((t) => String(t).slice(0, 40)).slice(0, 8);
		if (!merged.formattedText) merged.formattedText = formatListingText(merged, lang);
		merged.checklist = buildChecklist(merged, lang);
		if (opts?.polish !== false) return polishListingDraft(merged, { lang });
		return merged;
	} catch {
		return base;
	}
}

export async function handleDraftListingRequest(body: Record<string, unknown>): Promise<{
	ok: boolean;
	draft?: ListingDraft;
	error?: string;
}> {
	const action = typeof body.action === 'string' ? body.action : 'draft';
	const lang: 'bg' | 'en' = body.lang === 'en' ? 'en' : 'bg';
	const polish = body.polish !== false;

	if (action === 'edit') {
		const instructions = clean(typeof body.instructions === 'string' ? body.instructions : '', 1500);
		if (!instructions) return { ok: false, error: 'Липсват инструкции за редакция' };

		let base: ListingDraft;
		const listingId = typeof body.listing_id === 'string' ? body.listing_id.trim() : '';
		if (listingId) {
			const { getAllListings } = await import('./fieldlot-rag.js');
			const item = getAllListings().find((l) => l.id === listingId);
			if (!item) return { ok: false, error: `Няма обява ${listingId}` };
			base = listingToDraft(item, lang);
		} else if (body.draft && typeof body.draft === 'object') {
			base = draftListingFromFacts({ ...(body.draft as ListingDraftInput), lang });
		} else {
			base = draftListingFromFacts({
				lang,
				role: body.role === 'buy' ? 'buy' : 'sell',
				product: typeof body.product === 'string' ? body.product : undefined,
				qty: typeof body.qty === 'string' ? body.qty : undefined,
				region: typeof body.region === 'string' ? body.region : undefined,
				price: typeof body.price === 'string' ? body.price : undefined,
				quality: typeof body.quality === 'string' ? body.quality : undefined,
			});
		}
		const draft = await editListingDraft(base, instructions, { lang, polish });
		return { ok: true, draft };
	}

	const input: ListingDraftInput = {
		lang,
		role: body.role === 'buy' ? 'buy' : 'sell',
		product: typeof body.product === 'string' ? body.product : undefined,
		category: typeof body.category === 'string' ? body.category : undefined,
		crop: typeof body.crop === 'string' ? body.crop : undefined,
		qty: typeof body.qty === 'string' ? body.qty : undefined,
		region: typeof body.region === 'string' ? body.region : undefined,
		regionLabel: typeof body.region_label === 'string' ? body.region_label : undefined,
		price: typeof body.price === 'string' ? body.price : undefined,
		priceUnit: typeof body.price_unit === 'string' ? body.price_unit : undefined,
		incoterm: typeof body.incoterm === 'string' ? body.incoterm : undefined,
		harvest: typeof body.harvest === 'string' ? body.harvest : undefined,
		quality: typeof body.quality === 'string' ? body.quality : undefined,
		contact: typeof body.contact === 'string' ? body.contact : undefined,
		notes: typeof body.notes === 'string' ? body.notes : undefined,
	};

	let draft = draftListingFromFacts(input);
	if (polish) draft = await polishListingDraft(draft, { lang });
	return { ok: true, draft };
}
