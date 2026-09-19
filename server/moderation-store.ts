import { loadNamedJson, persistNamedJson, type PersistBackend } from './json-blob-store.js';

export type ListingReport = {
	id: string;
	listingId: string;
	reason: string;
	reporterId: string;
	createdAt: string;
	status: 'open' | 'hidden' | 'dismissed';
};

export type ModerationState = {
	reports: ListingReport[];
	hiddenIds: string[];
};

const empty: ModerationState = { reports: [], hiddenIds: [] };
let cache: ModerationState | null = null;

function asState(data: unknown): ModerationState {
	if (!data || typeof data !== 'object') return { ...empty, reports: [], hiddenIds: [] };
	const raw = data as { reports?: unknown; hiddenIds?: unknown };
	const reports = Array.isArray(raw.reports)
		? raw.reports.filter((row): row is ListingReport => {
				return Boolean(
					row &&
						typeof row === 'object' &&
						typeof (row as ListingReport).id === 'string' &&
						typeof (row as ListingReport).listingId === 'string' &&
						typeof (row as ListingReport).reason === 'string',
				);
			})
		: [];
	const hiddenIds = Array.isArray(raw.hiddenIds)
		? raw.hiddenIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
		: [];
	return { reports, hiddenIds };
}

async function loadState(): Promise<ModerationState> {
	if (cache) return cache;
	const loaded = asState(await loadNamedJson('moderation'));
	cache = loaded;
	return loaded;
}

async function saveState(next: ModerationState): Promise<PersistBackend> {
	cache = next;
	return persistNamedJson('moderation', next);
}

export async function getModerationState(): Promise<ModerationState> {
	return loadState();
}

export async function addListingReport(input: {
	listingId: string;
	reason: string;
	reporterId: string;
}): Promise<ListingReport> {
	const state = await loadState();
	const report: ListingReport = {
		id: `rep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		listingId: input.listingId.slice(0, 80),
		reason: input.reason.slice(0, 500),
		reporterId: input.reporterId.slice(0, 80),
		createdAt: new Date().toISOString(),
		status: 'open',
	};
	const reports = [report, ...state.reports].slice(0, 500);
	await saveState({ ...state, reports });
	return report;
}

export async function hideListingId(
	listingId: string,
	reportId?: string,
): Promise<ModerationState> {
	const state = await loadState();
	const id = listingId.slice(0, 80);
	const hiddenIds = state.hiddenIds.includes(id) ? state.hiddenIds : [...state.hiddenIds, id];
	const reports = state.reports.map((row) => {
		if (reportId && row.id === reportId) return { ...row, status: 'hidden' as const };
		if (!reportId && row.listingId === id && row.status === 'open') {
			return { ...row, status: 'hidden' as const };
		}
		return row;
	});
	const next = { reports, hiddenIds };
	await saveState(next);
	return next;
}

export async function dismissReport(reportId: string): Promise<ModerationState> {
	const state = await loadState();
	const reports = state.reports.map((row) =>
		row.id === reportId ? { ...row, status: 'dismissed' as const } : row,
	);
	const next = { ...state, reports };
	await saveState(next);
	return next;
}

export async function getHiddenListingIds(): Promise<string[]> {
	return (await loadState()).hiddenIds;
}
