import {
	clearAdminSessionCookie,
	adminSessionCookie,
	createAdminSessionToken,
	isAdminAuthorized,
	isAdminSecretMatch,
	readAdminSecret,
} from './admin-auth.js';
import { assertIpRateLimit } from './api-rate-limit.js';
import { getRagIndexStatus } from './fieldlot-semantic-rag.js';
import { loadSourcesConfig } from './listing-sources/index.js';
import { getListingsSnapshot } from './listings-data.js';
import { snapshotPersistConfigured } from './listings-snapshot-store.js';
import {
	dismissReport,
	getModerationState,
	hideListingId,
} from './moderation-store.js';
import { runListingsSyncPipeline } from './sync-listings-pipeline.js';

export type AdminAuthInput = {
	authorization?: string;
	cookie?: string;
};

type AdminResult = {
	status: number;
	body: Record<string, unknown>;
	setCookie?: string;
};

function unauthorized(): AdminResult {
	return { status: 401, body: { ok: false, error: 'Unauthorized' } };
}

function authorized(auth: AdminAuthInput): boolean {
	return isAdminAuthorized(auth.authorization, auth.cookie);
}

export async function handleAdminLogin(
	auth: AdminAuthInput,
	body: unknown,
	opts: { clientIp: string | null },
): Promise<AdminResult> {
	const limited = assertIpRateLimit({
		clientIp: opts.clientIp,
		bucket: 'admin-login',
		max: 10,
		windowMs: 15 * 60 * 1000,
		error: 'Твърде много опити за вход',
	});
	if (!limited.ok) {
		return { status: limited.status, body: { ok: false, error: limited.error, hint: limited.hint } };
	}

	const fromBody =
		body && typeof body === 'object' && typeof (body as { token?: unknown }).token === 'string'
			? (body as { token: string }).token
			: undefined;
	const fromBearer = auth.authorization?.startsWith('Bearer ')
		? auth.authorization.slice(7)
		: undefined;
	const token = (fromBody ?? fromBearer ?? '').trim();
	if (!isAdminSecretMatch(token) || !readAdminSecret()) return unauthorized();

	const session = createAdminSessionToken();
	if (!session) return unauthorized();
	return {
		status: 200,
		body: { ok: true },
		setCookie: adminSessionCookie(session),
	};
}

export function handleAdminLogout(): AdminResult {
	return {
		status: 200,
		body: { ok: true },
		setCookie: clearAdminSessionCookie(),
	};
}

export async function handleAdminGet(
	action: string,
	auth: AdminAuthInput,
): Promise<AdminResult> {
	if (!authorized(auth)) return unauthorized();

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
				adminConfigured: Boolean(readAdminSecret()),
				persist: snapshotPersistConfigured(),
			},
		};
	}

	if (action === 'reports') {
		const moderation = await getModerationState();
		return { status: 200, body: { ok: true, ...moderation } };
	}

	return { status: 404, body: { ok: false, error: 'Unknown action' } };
}

export async function handleAdminPost(
	action: string,
	auth: AdminAuthInput,
	body: unknown,
): Promise<AdminResult> {
	if (!authorized(auth)) return unauthorized();

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
				persisted: result.persisted,
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
			const { stdout } = await execAsync('npx tsx scripts/curate-ai-images.ts', { cwd: process.cwd() });
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
		const fs = await import('node:fs');
		const path = await import('node:path');
		const p = path.join(process.cwd(), 'data/platform-knowledge.json');
		fs.writeFileSync(p, `${JSON.stringify({ chunks }, null, '\t')}\n`, 'utf8');
		return { status: 200, body: { ok: true, saved: chunks.length } };
	}

	if (action === 'hide-listing') {
		const rec = body && typeof body === 'object' ? (body as { listingId?: unknown; reportId?: unknown }) : {};
		const listingId = typeof rec.listingId === 'string' ? rec.listingId.trim() : '';
		const reportId = typeof rec.reportId === 'string' ? rec.reportId.trim() : '';
		if (listingId.length < 4) {
			return { status: 400, body: { ok: false, error: 'listingId required' } };
		}
		const moderation = await hideListingId(listingId, reportId || undefined);
		return { status: 200, body: { ok: true, ...moderation } };
	}

	if (action === 'dismiss-report') {
		const rec = body && typeof body === 'object' ? (body as { reportId?: unknown }) : {};
		const reportId = typeof rec.reportId === 'string' ? rec.reportId.trim() : '';
		if (!reportId) return { status: 400, body: { ok: false, error: 'reportId required' } };
		const moderation = await dismissReport(reportId);
		return { status: 200, body: { ok: true, ...moderation } };
	}

	if (action === 'save-sources') {
		if (!body || typeof body !== 'object') {
			return { status: 400, body: { ok: false, error: 'Invalid body' } };
		}
		const sources = (body as { sources?: unknown }).sources;
		if (!Array.isArray(sources)) {
			return { status: 400, body: { ok: false, error: 'sources array required' } };
		}
		const fs = await import('node:fs');
		const path = await import('node:path');
		const p = path.join(process.cwd(), 'data/listing-sources.json');
		fs.writeFileSync(p, `${JSON.stringify({ sources }, null, '\t')}\n`, 'utf8');
		return { status: 200, body: { ok: true } };
	}

	return { status: 404, body: { ok: false, error: 'Unknown action' } };
}

export async function handleAdminGetKnowledge(auth: AdminAuthInput): Promise<AdminResult> {
	if (!authorized(auth)) return unauthorized();
	const fs = await import('node:fs');
	const path = await import('node:path');
	const p = path.join(process.cwd(), 'data/platform-knowledge.json');
	const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as { chunks: unknown[] };
	return { status: 200, body: { ok: true, ...raw } };
}
