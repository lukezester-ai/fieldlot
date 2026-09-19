import type { ListingsSnapshot } from './borsa-listings-fetcher.js';

function isSnapshot(data: unknown): data is ListingsSnapshot {
	return Boolean(data && typeof data === 'object' && Array.isArray((data as ListingsSnapshot).listings));
}

/** Persist across Vercel instances: PUT JSON to FIELDLOT_SNAPSHOT_PUT_URL (optional Blob/KV gateway). */
export async function persistListingsSnapshot(
	snap: ListingsSnapshot,
): Promise<{ ok: boolean; persisted: 'remote' | 'memory' }> {
	const url = process.env.FIELDLOT_SNAPSHOT_PUT_URL?.trim();
	const token = (
		process.env.FIELDLOT_SNAPSHOT_TOKEN?.trim() ||
		process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
		''
	);
	if (!url) return { ok: true, persisted: 'memory' };
	try {
		const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(url, {
			method: 'PUT',
			headers,
			body: JSON.stringify(snap),
			signal: AbortSignal.timeout(20_000),
		});
		if (!res.ok) {
			console.warn('[listings-snapshot-store] PUT', res.status, await res.text().then((t) => t.slice(0, 180)));
			return { ok: false, persisted: 'memory' };
		}
		return { ok: true, persisted: 'remote' };
	} catch (e) {
		console.warn('[listings-snapshot-store] PUT failed:', e instanceof Error ? e.message : e);
		return { ok: false, persisted: 'memory' };
	}
}

export async function loadPersistedListingsSnapshot(): Promise<ListingsSnapshot | null> {
	const url = process.env.FIELDLOT_SNAPSHOT_URL?.trim();
	if (!url) return null;
	try {
		const res = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(12_000),
		});
		if (!res.ok) return null;
		const data: unknown = await res.json();
		return isSnapshot(data) ? data : null;
	} catch {
		return null;
	}
}
