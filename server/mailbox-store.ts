import { loadNamedJson, persistNamedJson } from './json-blob-store.js';

type MailboxMap = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let cache: MailboxMap | null = null;

function asMap(data: unknown): MailboxMap {
	if (!data || typeof data !== 'object') return {};
	const out: MailboxMap = {};
	for (const [uid, email] of Object.entries(data as Record<string, unknown>)) {
		if (typeof email === 'string' && EMAIL_RE.test(email)) out[uid] = email;
	}
	return out;
}

async function loadMap(): Promise<MailboxMap> {
	if (cache) return cache;
	cache = asMap(await loadNamedJson('mailboxes'));
	return cache;
}

export async function registerMailbox(uid: string, email: string): Promise<void> {
	if (!uid || !EMAIL_RE.test(email)) return;
	const map = await loadMap();
	map[uid] = email.trim().toLowerCase();
	cache = map;
	await persistNamedJson('mailboxes', map);
}

export async function lookupMailbox(uid: string): Promise<string | null> {
	if (!uid) return null;
	const map = await loadMap();
	return map[uid] || null;
}
