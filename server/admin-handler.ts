import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isAdminAuthorized } from './admin-auth.js';
import { getRagIndexStatus } from './fieldlot-semantic-rag.js';
import { loadSourcesConfig } from './listing-sources/index.js';
import { getListingsSnapshot } from './listings-data.js';
import { runListingsSyncPipeline } from './sync-listings-pipeline.js';

/** spawnSync позволява `shell: true`; execSync в @types/node приема `shell` само като string. */
function runInheritShell(command: string, args: readonly string[]): void {
	const r = spawnSync(command, [...args], {
		stdio: 'inherit',
		cwd: process.cwd(),
		shell: true,
	});
	if (r.error) throw r.error;
	if (r.status !== null && r.status !== 0) {
		throw new Error(`Command exited with code ${r.status}`);
	}
}

function unauthorized() {
	return { ok: false as const, status: 401, error: 'Unauthorized' };
}

export async function handleAdminGet(
	action: string,
	authHeader: string | undefined,
): Promise<{ status: number; body: Record<string, unknown> }> {
	if (!isAdminAuthorized(authHeader)) return { status: 401, body: unauthorized() };

	if (action === 'status') {
		const snap = await getListingsSnapshot(false);
		const rag = getRagIndexStatus();
		return {
			status: 200,
			body: {
				ok: true,
				listings: {
					count: snap.count,
					source: snap.source,
					fetchedAt: snap.fetchedAt,
					pruned: snap.pruned,
				},
				rag,
				sources: loadSourcesConfig(),
				adminConfigured: Boolean(process.env.FIELDLOT_ADMIN_SECRET?.trim()),
			},
		};
	}

	return { status: 404, body: { ok: false, error: 'Unknown action' } };
}

export async function handleAdminPost(
	action: string,
	authHeader: string | undefined,
	body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
	if (!isAdminAuthorized(authHeader)) return { status: 401, body: unauthorized() };

	if (action === 'sync-listings') {
		try {
			const result = await runListingsSyncPipeline({ writeToDisk: true });
			return {
				status: 200,
				body: {
					ok: true,
					count: result.snapshot.count,
					source: result.snapshot.source,
					fetchedAt: result.snapshot.fetchedAt,
					rag: result.rag,
					wroteFiles: result.wroteFiles,
					paths: result.paths,
				},
			};
		} catch (err: any) {
			return { status: 500, body: { ok: false, error: err.message || String(err) } };
		}
	}

	if (action === 'curate-photos') {
		try {
			runInheritShell('npx', ['tsx', 'scripts/agent-curate-photos.ts']);
			return { status: 200, body: { ok: true, message: 'Photo curation completed.' } };
		} catch (err: any) {
			return { status: 500, body: { ok: false, error: err.message || String(err) } };
		}
	}

	if (action === 'sync-images') {
		try {
			runInheritShell('node', ['scripts/fix-crop-images.mjs']);
			runInheritShell('node', ['scripts/sync-images-from-manifest.mjs']);
			return { status: 200, body: { ok: true, message: 'Images synced from manifest' } };
		} catch (err: any) {
			return { status: 500, body: { ok: false, error: err.message || String(err) } };
		}
	}

	if (action === 'save-knowledge') {
		if (!body || typeof body !== 'object') {
			return { status: 400, body: { ok: false, error: 'Invalid body' } };
		}
		const chunks = (body as { chunks?: unknown }).chunks;
		if (!Array.isArray(chunks)) {
			return { status: 400, body: { ok: false, error: 'chunks array required' } };
		}
		const p = path.join(process.cwd(), 'data/platform-knowledge.json');
		fs.writeFileSync(p, `${JSON.stringify({ chunks }, null, '\t')}\n`, 'utf8');
		return { status: 200, body: { ok: true, saved: chunks.length } };
	}

	if (action === 'save-sources') {
		if (!body || typeof body !== 'object') {
			return { status: 400, body: { ok: false, error: 'Invalid body' } };
		}
		const sources = (body as { sources?: unknown }).sources;
		if (!Array.isArray(sources)) {
			return { status: 400, body: { ok: false, error: 'sources array required' } };
		}
		const p = path.join(process.cwd(), 'data/listing-sources.json');
		fs.writeFileSync(p, `${JSON.stringify({ sources }, null, '\t')}\n`, 'utf8');
		return { status: 200, body: { ok: true } };
	}

	return { status: 404, body: { ok: false, error: 'Unknown action' } };
}

export async function handleAdminGetKnowledge(
	authHeader: string | undefined,
): Promise<{ status: number; body: Record<string, unknown> }> {
	if (!isAdminAuthorized(authHeader)) return { status: 401, body: unauthorized() };
	const p = path.join(process.cwd(), 'data/platform-knowledge.json');
	const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as { chunks: unknown[] };
	return { status: 200, body: { ok: true, ...raw } };
}
