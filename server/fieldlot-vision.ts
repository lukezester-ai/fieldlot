/**
 * Fieldlot — разпознаване на агро снимки (Mistral vision / OpenAI).
 */
import {
	CATEGORY_LABELS_BG,
	enrichListing,
	FIELDLOT_CATEGORY_IDS,
	FIELDLOT_CROP_IDS,
	normalizeCategory,
	type FieldlotCategoryId,
	type FieldlotCropId,
} from './fieldlot-categories.js';

export type AgroImageClassification = {
	ok: boolean;
	category: FieldlotCategoryId;
	crop?: FieldlotCropId;
	confidence: number;
	labels: string[];
	summaryBg: string;
	summaryEn: string;
	provider?: string;
	error?: string;
};

const VISION_PROMPT = `You classify agricultural product photos for a Bulgarian B2B marketplace (Fieldlot).
Return ONLY valid JSON (no markdown):
{
  "category": one of ${JSON.stringify(FIELDLOT_CATEGORY_IDS)},
  "crop": optional one of ${JSON.stringify(FIELDLOT_CROP_IDS)} or null,
  "confidence": 0.0-1.0,
  "labels": ["short", "bulgarian-friendly", "tags"],
  "summary_bg": "1 sentence in Bulgarian what you see",
  "summary_en": "1 sentence in English"
}
Rules:
- grain: wheat, barley, corn, oats, lentils in bulk/field/silo
- veg: tomatoes, peppers, cucumbers, onions, herbs (fresh)
- fruit: apples, pears, grapes, fresh fruit
- oil: sunflower seeds, rapeseed, bottled oil
- canned: jars, pickles, preserves, lyutenitsa, frozen veg packs
- fertilizer: bags, NPK, agrochemicals
- machines: tractors, combines, sprayers, JCB
- feed: hay bales, silage, animal feed bags
- For wheat vs barley: look at head shape and color (barley often has long awns)
- If unsure, lower confidence and pick best category`;

function readMistralKey(): string {
	return (process.env.MISTRAL_API_KEY ?? '').replace(/^\uFEFF/, '').trim();
}

function visionModel(): string {
	return (
		process.env.MISTRAL_VISION_MODEL?.trim() ||
		process.env.MISTRAL_CHAT_MODEL?.trim() ||
		'pixtral-12b-2409'
	);
}

function parseVisionJson(text: string): Partial<AgroImageClassification> & Record<string, unknown> {
	const trimmed = text.trim();
	const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
	const raw = jsonMatch ? jsonMatch[0] : trimmed;
	return JSON.parse(raw) as Record<string, unknown>;
}

export async function classifyAgroImage(opts: {
	imageBase64: string;
	mimeType?: string;
	lang?: 'bg' | 'en' | 'de';
}): Promise<AgroImageClassification> {
	const key = readMistralKey();
	const openaiKey = (process.env.OPENAI_API_KEY ?? '').trim();
	const b64 = opts.imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
	if (!b64 || b64.length < 100) {
		return {
			ok: false,
			category: 'grain',
			confidence: 0,
			labels: [],
			summaryBg: 'Невалидна снимка.',
			summaryEn: 'Invalid image.',
			error: 'empty_image',
		};
	}
	const mime = opts.mimeType?.trim() || 'image/jpeg';
	const dataUrl = `data:${mime};base64,${b64}`;

	if (key) {
		try {
			const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${key}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: visionModel(),
					temperature: 0.1,
					max_tokens: 400,
					messages: [
						{ role: 'system', content: VISION_PROMPT },
						{
							role: 'user',
							content: [
								{ type: 'text', text: 'Classify this agro product photo.' },
								{ type: 'image_url', image_url: dataUrl },
							],
						},
					],
				}),
				signal: AbortSignal.timeout(55_000),
			});
			const data = (await res.json()) as {
				choices?: { message?: { content?: string } }[];
				error?: { message?: string };
			};
			if (!res.ok) {
				throw new Error(data.error?.message || res.statusText);
			}
			const content = data.choices?.[0]?.message?.content ?? '';
			return mapVisionResult(parseVisionJson(content), 'mistral');
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'vision_error';
			return {
				ok: false,
				category: 'grain',
				confidence: 0,
				labels: [],
				summaryBg: `Неуспешно разпознаване: ${msg}`,
				summaryEn: `Vision failed: ${msg}`,
				error: msg,
				provider: 'mistral',
			};
		}
	}

	if (openaiKey) {
		try {
			const model = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini';
			const res = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${openaiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model,
					temperature: 0.1,
					max_tokens: 400,
					messages: [
						{ role: 'system', content: VISION_PROMPT },
						{
							role: 'user',
							content: [
								{ type: 'text', text: 'Classify this agro product photo.' },
								{ type: 'image_url', image_url: { url: dataUrl } },
							],
						},
					],
				}),
				signal: AbortSignal.timeout(55_000),
			});
			const data = (await res.json()) as {
				choices?: { message?: { content?: string } }[];
				error?: { message?: string };
			};
			if (!res.ok) throw new Error(data.error?.message || res.statusText);
			const content = data.choices?.[0]?.message?.content ?? '';
			return mapVisionResult(parseVisionJson(content), 'openai');
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'vision_error';
			return {
				ok: false,
				category: 'grain',
				confidence: 0,
				labels: [],
				summaryBg: `Неуспешно разпознаване: ${msg}`,
				summaryEn: `Vision failed: ${msg}`,
				error: msg,
				provider: 'openai',
			};
		}
	}

	return {
		ok: false,
		category: 'grain',
		confidence: 0,
		labels: [],
		summaryBg: 'Vision не е конфигуриран (MISTRAL_API_KEY или OPENAI_API_KEY).',
		summaryEn: 'Vision not configured.',
		error: 'no_vision_key',
	};
}

function mapVisionResult(
	raw: Record<string, unknown>,
	provider: string,
): AgroImageClassification {
	const category = normalizeCategory(String(raw.category ?? 'grain'));
	let crop: FieldlotCropId | undefined;
	const cropRaw = raw.crop;
	if (typeof cropRaw === 'string' && cropRaw && cropRaw !== 'null') {
		const c = cropRaw.trim().toLowerCase();
		if ((FIELDLOT_CROP_IDS as readonly string[]).includes(c)) crop = c as FieldlotCropId;
	}
	const confidence =
		typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.7;
	const labels = Array.isArray(raw.labels)
		? raw.labels.map((x) => String(x).slice(0, 80)).slice(0, 12)
		: [];
	const summaryBg =
		typeof raw.summary_bg === 'string'
			? raw.summary_bg.slice(0, 500)
			: typeof raw.summaryBg === 'string'
				? raw.summaryBg.slice(0, 500)
				: `Категория: ${CATEGORY_LABELS_BG[category]}`;
	const summaryEn =
		typeof raw.summary_en === 'string'
			? raw.summary_en.slice(0, 500)
			: typeof raw.summaryEn === 'string'
				? raw.summaryEn.slice(0, 500)
				: `Category: ${category}`;

	return {
		ok: true,
		category,
		crop,
		confidence,
		labels,
		summaryBg,
		summaryEn,
		provider,
	};
}

/** Demo listing stub from vision (for agent context only). */
export function visionResultToListingHint(v: AgroImageClassification): string {
	const fake = enrichListing({
		id: 'vision-hint',
		title: v.summaryBg,
		subtitle: v.labels.join(', '),
		category: v.category,
		region: 'national',
		role: 'sell',
		qty: '—',
		price: '—',
		priceUnit: '',
		incoterm: '—',
		harvest: '—',
		quality: v.summaryBg,
		contact: '',
		tags: v.crop ? [`crop:${v.crop}`, ...v.labels] : v.labels,
	});
	return `Категория=${fake.category}${v.crop ? `, култура=${v.crop}` : ''}, етикети=${v.labels.join(', ')}`;
}
