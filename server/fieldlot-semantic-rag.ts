import fs from 'node:fs';
import path from 'node:path';
import platformKnowledge from '../data/platform-knowledge.json' with { type: 'json' };
import type { FieldlotListing } from './borsa-listings-fetcher.js';
import { listingCrop, normalizeCategory } from './fieldlot-categories.js';

const INDEX_PATH = path.join(process.cwd(), 'data/fieldlot-rag-index.json');
const MISTRAL_EMBED_URL = 'https://api.mistral.ai/v1/embeddings';
const TOP_K = 8;

export type FieldlotRagHit = {
	id: string;
	title: string;
	snippet: string;
	similarity: number;
	kind: 'listing' | 'knowledge';
	url?: string;
	listingId?: string;
};

type RagChunk = {
	id: string;
	kind: 'listing' | 'knowledge';
	title: string;
	text: string;
	url?: string;
	listingId?: string;
	embedding?: number[];
};

type RagIndexFile = {
	updatedAt: string;
	model: string;
	chunks: RagChunk[];
};

function readMistralKey(): string {
	return (process.env.MISTRAL_API_KEY ?? '').trim();
}

function cosine(a: number[], b: number[]): number {
	let dot = 0;
	let na = 0;
	let nb = 0;
	const n = Math.min(a.length, b.length);
	for (let i = 0; i < n; i += 1) {
		dot += a[i]! * b[i]!;
		na += a[i]! * a[i]!;
		nb += b[i]! * b[i]!;
	}
	if (!na || !nb) return 0;
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedTexts(texts: string[]): Promise<number[][]> {
	const key = readMistralKey();
	if (!key || texts.length === 0) return [];
	const model = process.env.MISTRAL_EMBED_MODEL?.trim() || 'mistral-embed';
	const res = await fetch(MISTRAL_EMBED_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${key}`,
		},
		body: JSON.stringify({ model, input: texts }),
		signal: AbortSignal.timeout(45_000),
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`Mistral embed ${res.status}: ${t.slice(0, 200)}`);
	}
	const data = (await res.json()) as { data?: { embedding?: number[] }[] };
	return (data.data ?? []).map((d) => d.embedding ?? []).filter((v) => v.length > 0);
}

function listingChunkText(item: FieldlotListing): string {
	const crop = listingCrop(item);
	return [
		item.title,
		item.subtitle,
		normalizeCategory(item.category),
		crop ? `crop:${crop}` : '',
		item.region,
		item.role,
		item.qty,
		item.price,
		item.priceUnit,
		...(item.tags ?? []),
	]
		.filter(Boolean)
		.join(' ');
}

export function buildChunksFromListings(listings: FieldlotListing[]): RagChunk[] {
	const chunks: RagChunk[] = [];
	for (const c of platformKnowledge.chunks) {
		chunks.push({
			id: c.id,
			kind: 'knowledge',
			title: c.id,
			text: c.text,
		});
	}
	for (const item of listings) {
		chunks.push({
			id: `listing:${item.id}`,
			kind: 'listing',
			title: item.title,
			text: listingChunkText(item),
			url: item.sourceUrl,
			listingId: item.id,
		});
	}
	return chunks;
}

export async function rebuildFieldlotRagIndex(listings: FieldlotListing[]): Promise<{
	ok: boolean;
	chunkCount: number;
	embedded: number;
	error?: string;
}> {
	const chunks = buildChunksFromListings(listings);
	const key = readMistralKey();
	let embedded = 0;
	if (key) {
		const batch = 32;
		for (let i = 0; i < chunks.length; i += batch) {
			const slice = chunks.slice(i, i + batch);
			const vectors = await embedTexts(slice.map((c) => c.text.slice(0, 6000)));
			for (let j = 0; j < slice.length; j += 1) {
				if (vectors[j]?.length) {
					slice[j]!.embedding = vectors[j];
					embedded += 1;
				}
			}
		}
	}
	const index: RagIndexFile = {
		updatedAt: new Date().toISOString(),
		model: key ? process.env.MISTRAL_EMBED_MODEL?.trim() || 'mistral-embed' : 'keyword-only',
		chunks,
	};
	try {
		fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
		fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, '\t')}\n`, 'utf8');
	} catch (e) {
		return {
			ok: false,
			chunkCount: chunks.length,
			embedded,
			error: e instanceof Error ? e.message : String(e),
		};
	}
	return { ok: true, chunkCount: chunks.length, embedded };
}

function readIndex(): RagIndexFile | null {
	try {
		return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')) as RagIndexFile;
	} catch {
		return null;
	}
}

function keywordScore(query: string, text: string): number {
	const q = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
	const hay = text.toLowerCase();
	let s = 0;
	for (const t of q) {
		if (hay.includes(t)) s += 1;
	}
	return s / Math.max(q.length, 1);
}

export async function searchFieldlotSemanticRag(
	query: string,
	topK = TOP_K,
): Promise<FieldlotRagHit[]> {
	const q = query.trim();
	if (q.length < 2) return [];
	const index = readIndex();
	if (!index?.chunks?.length) return [];

	const withEmb = index.chunks.filter((c) => c.embedding?.length);
	if (withEmb.length && readMistralKey()) {
		try {
			const [qVec] = await embedTexts([q.slice(0, 6000)]);
			if (qVec?.length) {
				const scored = withEmb
					.map((c) => ({
						chunk: c,
						sim: cosine(qVec, c.embedding!),
					}))
					.sort((a, b) => b.sim - a.sim)
					.slice(0, topK);
				return scored.map(({ chunk, sim }) => ({
					id: chunk.id,
					title: chunk.title,
					snippet: chunk.text.slice(0, 220),
					similarity: sim,
					kind: chunk.kind,
					url: chunk.url,
					listingId: chunk.listingId,
				}));
			}
		} catch {
			/* fallback keyword */
		}
	}

	return index.chunks
		.map((c) => ({ chunk: c, sim: keywordScore(q, c.text) }))
		.filter((x) => x.sim > 0.15)
		.sort((a, b) => b.sim - a.sim)
		.slice(0, topK)
		.map(({ chunk, sim }) => ({
			id: chunk.id,
			title: chunk.title,
			snippet: chunk.text.slice(0, 220),
			similarity: sim,
			kind: chunk.kind,
			url: chunk.url,
			listingId: chunk.listingId,
		}));
}

export function formatSemanticHitsForPrompt(hits: FieldlotRagHit[], locale: 'bg' | 'en'): string {
	if (!hits.length) return '';
	const head =
		locale === 'bg'
			? '=== SEMANTIC RAG (Doc Discovery / индекс обяви + knowledge) ==='
			: '=== SEMANTIC RAG (listings + knowledge index) ===';
	const lines = hits.map(
		(h, i) =>
			`[S${i + 1}] ${h.title} (${(h.similarity * 100).toFixed(0)}%)${h.url ? `\n  URL: ${h.url}` : ''}${h.listingId ? `\n  listingId: ${h.listingId}` : ''}\n  > ${h.snippet}`,
	);
	return `${head}\n${lines.join('\n')}`;
}

export function getRagIndexStatus(): { exists: boolean; updatedAt?: string; chunks: number; embedded: number } {
	const index = readIndex();
	if (!index) return { exists: false, chunks: 0, embedded: 0 };
	const embedded = index.chunks.filter((c) => c.embedding?.length).length;
	return {
		exists: true,
		updatedAt: index.updatedAt,
		chunks: index.chunks.length,
		embedded,
	};
}
