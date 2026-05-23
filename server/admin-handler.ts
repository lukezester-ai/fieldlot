import fs from 'node:fs';
import path from 'node:path';
import { isAdminAuthorized } from './admin-auth.js';
import { getRagIndexStatus } from './fieldlot-semantic-rag.js';
import { loadSourcesConfig } from './listing-sources/index.js';
import { getListingsSnapshot } from './listings-data.js';
import { runListingsSyncPipeline } from './sync-listings-pipeline.js';

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
	}

	if (action === 'sync-images') {
		const { execSync } = await import('node:child_process');
		execSync('node scripts/fix-crop-images.mjs', { stdio: 'inherit', cwd: process.cwd() });
		execSync('node scripts/sync-images-from-manifest.mjs', { stdio: 'inherit', cwd: process.cwd() });
		return { status: 200, body: { ok: true, message: 'Images synced from manifest' } };
	}

	if (action === 'curate-images') {
		const { exec } = await import('node:child_process');
		const util = await import('node:util');
		const execAsync = util.promisify(exec);
		try {
			const { stdout, stderr } = await execAsync('npx tsx scripts/curate-ai-images.ts', { cwd: process.cwd() });
			return { status: 200, body: { ok: true, message: 'AI curation completed\n' + stdout } };
		} catch (e) {
			const err = e instanceof Error ? e.message : String(e);
			return { status: 500, body: { ok: false, error: err } };
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
