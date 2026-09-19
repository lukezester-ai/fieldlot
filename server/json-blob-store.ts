import fs from 'node:fs';
import path from 'node:path';

export type PersistBackend = 'blob' | 'remote' | 'file' | 'memory';

function localPath(name: string): string {
	return path.join(process.cwd(), '.local', `${name}.json`);
}

function blobPath(name: string): string {
	return `fieldlot/${name}.json`;
}

export async function persistNamedJson(name: string, data: unknown): Promise<PersistBackend> {
	const json = JSON.stringify(data);
	const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
	if (token) {
		try {
			const { put } = await import('@vercel/blob');
			await put(blobPath(name), json, {
				access: 'public',
				addRandomSuffix: false,
				allowOverwrite: true,
				token,
			});
			return 'blob';
		} catch (e) {
			console.warn('[json-blob-store] blob put', e instanceof Error ? e.message : e);
		}
	}
	try {
		const dest = localPath(name);
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.writeFileSync(dest, `${json}\n`, 'utf8');
		return 'file';
	} catch (e) {
		console.warn('[json-blob-store] file put', e instanceof Error ? e.message : e);
		return 'memory';
	}
}

export async function loadNamedJson(name: string): Promise<unknown | null> {
	const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
	if (token) {
		try {
			const { list } = await import('@vercel/blob');
			const listed = await list({ prefix: blobPath(name), token, limit: 8 });
			const blob =
				listed.blobs.find((row) => row.pathname === blobPath(name)) || listed.blobs[0];
			if (blob?.url) {
				const res = await fetch(blob.url, {
					headers: { Accept: 'application/json' },
					signal: AbortSignal.timeout(12_000),
				});
				if (res.ok) return await res.json();
			}
		} catch (e) {
			console.warn('[json-blob-store] blob get', e instanceof Error ? e.message : e);
		}
	}
	try {
		const dest = localPath(name);
		if (fs.existsSync(dest)) return JSON.parse(fs.readFileSync(dest, 'utf8')) as unknown;
	} catch {
		/* ignore */
	}
	return null;
}
