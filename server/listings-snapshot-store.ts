import type { ListingsSnapshot } from './borsa-listings-fetcher.js';
import { loadNamedJson, persistNamedJson, type PersistBackend } from './json-blob-store.js';

function isSnapshot(data: unknown): data is ListingsSnapshot {
	return Boolean(data && typeof data === 'object' && Array.isArray((data as ListingsSnapshot).listings));
}

async function persistViaGateway(snap: ListingsSnapshot): Promise<boolean> {
	const url = process.env.FIELDLOT_SNAPSHOT_PUT_URL?.trim();
	if (!url) return false;
	const token = (
		process.env.FIELDLOT_SNAPSHOT_TOKEN?.trim() ||
		process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
		''
	);
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
			return false;
		}
		return true;
	} catch (e) {
		console.warn('[listings-snapshot-store] PUT failed:', e instanceof Error ? e.message : e);
		return false;
	}
}

/** Persist across Vercel instances: Blob token, optional PUT gateway, then local `.local/`. */
export async function persistListingsSnapshot(
	snap: ListingsSnapshot,
): Promise<{ ok: boolean; persisted: PersistBackend }> {
	const gatewayOk = await persistViaGateway(snap);
	const named = await persistNamedJson('live-listings', snap);
	if (gatewayOk) return { ok: true, persisted: named === 'blob' ? 'blob' : 'remote' };
	return { ok: named !== 'memory', persisted: named };
}

export async function loadPersistedListingsSnapshot(): Promise<ListingsSnapshot | null> {
	const named = await loadNamedJson('live-listings');
	if (isSnapshot(named) && named.listings.length > 0) return named;

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

export function snapshotPersistConfigured(): {
	blob: boolean;
	gateway: boolean;
	publicUrl: boolean;
} {
	return {
		blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
		gateway: Boolean(process.env.FIELDLOT_SNAPSHOT_PUT_URL?.trim()),
		publicUrl: Boolean(process.env.FIELDLOT_SNAPSHOT_URL?.trim()),
	};
}
