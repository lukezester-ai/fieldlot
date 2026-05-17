/**
 * Fieldlot Guide — agent tools (actions): email, listings, exchange, API fetch.
 */
import { getExchangeSnapshotCached } from './exchange-prices.js';
import { getAllListings, type FieldlotListing } from './fieldlot-rag.js';
import { getListingsSnapshot, getStaticListingsSnapshot } from './listings-data.js';
import { handleRegisterInterestPost, type LeadHandlerCtx } from './register-interest.js';

export type AgentActionRecord = {
	tool: string;
	ok: boolean;
	summary: string;
};

export type AgentToolContext = {
	lang: 'bg' | 'en';
	clientIp?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const agentHits = new Map<string, number[]>();
const AGENT_WINDOW_MS = 15 * 60 * 1000;
const AGENT_MAX_PER_WINDOW = 20;

function rateLimitAgent(ip: string): boolean {
	const now = Date.now();
	const bucket = (agentHits.get(ip) ?? []).filter((t) => now - t < AGENT_WINDOW_MS);
	if (bucket.length >= AGENT_MAX_PER_WINDOW) return false;
	bucket.push(now);
	agentHits.set(ip, bucket);
	return true;
}

function inboxTo(): string {
	return (
		process.env.FIELDLOT_INBOX_EMAIL?.trim() ||
		process.env.MAIL_TO?.trim() ||
		process.env.CONTACT_TO_EMAIL?.trim() ||
		''
	);
}

function fromAddress(): string | null {
	const v =
		process.env.MAIL_FROM?.trim() ||
		process.env.RESEND_FROM?.trim() ||
		process.env.SMTP_FROM?.trim() ||
		'';
	return v || null;
}

async function sendViaResend(opts: {
	to: string;
	from: string;
	subject: string;
	html: string;
	text?: string;
	replyTo?: string;
}): Promise<'sent' | 'skipped' | 'failed'> {
	const key = process.env.RESEND_API_KEY?.trim();
	if (!key) return 'skipped';

	const body: Record<string, unknown> = {
		from: opts.from,
		to: [opts.to],
		subject: opts.subject,
		html: opts.html,
		reply_to: opts.replyTo ? [opts.replyTo] : undefined,
	};
	if (opts.text?.trim()) body.text = opts.text.trim();

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const data = (await res.json().catch(() => ({}))) as { message?: string };
		throw new Error(typeof data.message === 'string' ? data.message : res.statusText);
	}
	return 'sent';
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function listingSummary(l: FieldlotListing): Record<string, unknown> {
	return {
		id: l.id,
		title: l.title,
		subtitle: l.subtitle,
		category: l.category,
		region: l.region,
		role: l.role,
		qty: l.qty,
		price: l.price,
		priceUnit: l.priceUnit,
		incoterm: l.incoterm,
		quality: l.quality,
		contact: l.contact,
		tags: l.tags,
	};
}

function searchListings(args: {
	query?: string;
	category?: string;
	region?: string;
	role?: string;
}): FieldlotListing[] {
	const q = (args.query ?? '').toLowerCase().trim();
	const cat = args.category?.trim();
	const reg = args.region?.trim();
	const role = args.role?.trim();

	return getAllListings().filter((item) => {
		if (cat && item.category !== cat) return false;
		if (reg && item.region !== reg) return false;
		if (role && item.role !== role) return false;
		if (!q) return true;
		const hay = [
			item.id,
			item.title,
			item.subtitle,
			item.quality,
			item.contact,
			...(item.tags ?? []),
		]
			.join(' ')
			.toLowerCase();
		return hay.includes(q);
	});
}

/** OpenAI / Mistral tool definitions */
export const FIELDLOT_AGENT_TOOLS = [
	{
		type: 'function' as const,
		function: {
			name: 'get_exchange_prices',
			description:
				'Fetch live indicative MATIF exchange prices (wheat, sunflower, corn, rapeseed) in BGN/ton from borsaagro.com cache.',
			parameters: { type: 'object', properties: {}, additionalProperties: false },
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'search_listings',
			description: 'Search live B2B agro listings (borsaagro.com) by text, category, region, or role (sell/buy).',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Free text: crop, region, quality…' },
					category: {
						type: 'string',
						enum: ['grain', 'oilseed', 'feed', 'fruit', 'veg'],
					},
					region: {
						type: 'string',
						enum: ['dobrudzha', 'north', 'south', 'west'],
					},
					role: { type: 'string', enum: ['sell', 'buy'] },
				},
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'get_listing',
			description: 'Get one catalog listing by id (e.g. ba-86).',
			parameters: {
				type: 'object',
				properties: {
					listing_id: { type: 'string', description: 'Listing id' },
				},
				required: ['listing_id'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'submit_early_access',
			description:
				'Submit early-access registration: sends notification email to Fieldlot team via Resend. Only call when user explicitly provided name and business email and agreed to be contacted.',
			parameters: {
				type: 'object',
				properties: {
					full_name: { type: 'string' },
					business_email: { type: 'string' },
					company_name: { type: 'string' },
					phone: { type: 'string', description: 'E.164 e.g. +359888123456' },
					market_focus: { type: 'string', description: 'Producer, buyer, logistics…' },
					subscribe_alerts: { type: 'boolean' },
				},
				required: ['full_name', 'business_email'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'send_team_email',
			description:
				'Send an email to the Fieldlot team inbox (e.g. summarize user request, forward inquiry). Use when user asks to contact the team and you have enough context.',
			parameters: {
				type: 'object',
				properties: {
					subject: { type: 'string' },
					message: { type: 'string', description: 'Plain text body' },
					user_email: {
						type: 'string',
						description: 'Optional reply-to address from the user',
					},
				},
				required: ['subject', 'message'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'fetch_fieldlot_api',
			description:
				'Call a Fieldlot read-only API path on this site. Allowed: /api/exchange-prices, /api/listings, /data/live-listings.json',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						enum: ['/api/exchange-prices', '/api/listings', '/data/live-listings.json'],
					},
				},
				required: ['path'],
				additionalProperties: false,
			},
		},
	},
];

const ALLOWED_API_PATHS = new Set([
	'/api/exchange-prices',
	'/api/listings',
	'/data/live-listings.json',
]);

export async function executeAgentTool(
	name: string,
	argsJson: string,
	ctx: AgentToolContext,
): Promise<{ result: string; action: AgentActionRecord }> {
	const ip = (ctx.clientIp && ctx.clientIp.trim()) || 'unknown';
	if (!rateLimitAgent(ip)) {
		const msg =
			ctx.lang === 'en'
				? 'Rate limit: too many agent actions. Try again in a few minutes.'
				: 'Лимит: твърде много действия. Опитай след няколко минути.';
		return { result: JSON.stringify({ ok: false, error: msg }), action: { tool: name, ok: false, summary: msg } };
	}

	let args: Record<string, unknown> = {};
	try {
		args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
	} catch {
		const msg = ctx.lang === 'en' ? 'Invalid tool arguments JSON' : 'Невалидни аргументи към инструмента';
		return { result: JSON.stringify({ ok: false, error: msg }), action: { tool: name, ok: false, summary: msg } };
	}

	try {
		switch (name) {
			case 'get_exchange_prices': {
				const snap = await getExchangeSnapshotCached();
				const summary =
					ctx.lang === 'en'
						? `Exchange prices loaded (${snap.quotes.length} products)`
						: `Борсови цени заредени (${snap.quotes.length} продукта)`;
				return {
					result: JSON.stringify({ ok: true, data: snap }),
					action: { tool: name, ok: true, summary },
				};
			}

			case 'search_listings': {
				const items = searchListings({
					query: typeof args.query === 'string' ? args.query : undefined,
					category: typeof args.category === 'string' ? args.category : undefined,
					region: typeof args.region === 'string' ? args.region : undefined,
					role: typeof args.role === 'string' ? args.role : undefined,
				});
				const summary =
					ctx.lang === 'en'
						? `Found ${items.length} listing(s)`
						: `Намерени ${items.length} обяви`;
				return {
					result: JSON.stringify({
						ok: true,
						count: items.length,
						listings: items.map(listingSummary),
					}),
					action: { tool: name, ok: true, summary },
				};
			}

			case 'get_listing': {
				const id = typeof args.listing_id === 'string' ? args.listing_id.trim() : '';
				const item = getAllListings().find((l) => l.id === id);
				if (!item) {
					const msg = ctx.lang === 'en' ? `Listing not found: ${id}` : `Няма обява: ${id}`;
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: msg },
					};
				}
				const summary = ctx.lang === 'en' ? `Listing ${id}` : `Обява ${id}`;
				return {
					result: JSON.stringify({ ok: true, listing: listingSummary(item) }),
					action: { tool: name, ok: true, summary },
				};
			}

			case 'submit_early_access': {
				const fullName = typeof args.full_name === 'string' ? args.full_name.trim() : '';
				const businessEmail =
					typeof args.business_email === 'string' ? args.business_email.trim() : '';
				const body = {
					fullName,
					businessEmail,
					companyName: typeof args.company_name === 'string' ? args.company_name.trim() : '',
					phone: typeof args.phone === 'string' ? args.phone.trim() : '',
					marketFocus: typeof args.market_focus === 'string' ? args.market_focus.trim() : '',
					subscribeAlerts: Boolean(args.subscribe_alerts),
					hpCompanyWebsite: '',
					formOpenedAt: Date.now() - 5000,
					_agentSource: 'fieldlot-guide',
				};
				const leadCtx: LeadHandlerCtx = { clientIp: ctx.clientIp ?? null };
				const out = await handleRegisterInterestPost(body, leadCtx);
				if (!out.ok) {
					const msg = out.error;
					return {
						result: JSON.stringify({ ok: false, error: msg, hint: out.hint }),
						action: { tool: name, ok: false, summary: msg },
					};
				}
				const summary =
					ctx.lang === 'en'
						? out.mailDelivery === 'sent'
							? `Early access submitted · email sent to team`
							: `Early access saved (email not configured)`
						: out.mailDelivery === 'sent'
							? `Ранен достъп изпратен · имейл до екипа`
							: `Ранен достъп записан (имейл не е конфигуриран)`;
				return {
					result: JSON.stringify({ ok: true, mailDelivery: out.mailDelivery, preview: out.preview }),
					action: { tool: name, ok: true, summary },
				};
			}

			case 'send_team_email': {
				const subject = typeof args.subject === 'string' ? args.subject.trim().slice(0, 200) : '';
				const message = typeof args.message === 'string' ? args.message.trim().slice(0, 4000) : '';
				const userEmail = typeof args.user_email === 'string' ? args.user_email.trim() : '';
				if (!subject || !message) {
					const msg = ctx.lang === 'en' ? 'subject and message required' : 'заглавие и съобщение са задължителни';
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: msg },
					};
				}
				const to = inboxTo();
				const from = fromAddress();
				if (!to || !from) {
					const msg =
						ctx.lang === 'en'
							? 'Email not configured (RESEND_API_KEY, RESEND_FROM, FIELDLOT_INBOX_EMAIL)'
							: 'Имейл не е конфигуриран (RESEND_API_KEY, RESEND_FROM, FIELDLOT_INBOX_EMAIL)';
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: msg },
					};
				}
				const replyTo = userEmail && EMAIL_RE.test(userEmail) ? userEmail : undefined;
				const html = `<h2>Fieldlot Guide — съобщение от чат</h2><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>`;
				const sent = await sendViaResend({
					to,
					from,
					subject: subject.startsWith('[Fieldlot]') ? subject : `[Fieldlot] ${subject}`,
					html,
					text: message,
					replyTo,
				});
				const summary =
					ctx.lang === 'en'
						? sent === 'sent'
							? 'Team email sent'
							: 'Email skipped (no API key)'
						: sent === 'sent'
							? 'Имейл до екипа изпратен'
							: 'Имейл пропуснат (няма API ключ)';
				return {
					result: JSON.stringify({ ok: sent === 'sent', delivery: sent }),
					action: { tool: name, ok: sent === 'sent', summary },
				};
			}

			case 'fetch_fieldlot_api': {
				const path = typeof args.path === 'string' ? args.path.trim() : '';
				if (!ALLOWED_API_PATHS.has(path)) {
					const msg = ctx.lang === 'en' ? 'Path not allowed' : 'Пътят не е позволен';
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: msg },
					};
				}
				let data: unknown;
				if (path === '/api/exchange-prices') {
					const snap = await getExchangeSnapshotCached();
					data = { ok: true, ...snap };
				} else if (path === '/api/listings') {
					data = await getListingsSnapshot();
				} else if (path === '/data/live-listings.json') {
					data = getStaticListingsSnapshot();
				} else {
					data = getAllListings();
				}
				const summary = ctx.lang === 'en' ? `API ${path}` : `API ${path}`;
				return {
					result: JSON.stringify({ ok: true, path, data }),
					action: { tool: name, ok: true, summary },
				};
			}

			default: {
				const msg = ctx.lang === 'en' ? `Unknown tool: ${name}` : `Неизвестен инструмент: ${name}`;
				return {
					result: JSON.stringify({ ok: false, error: msg }),
					action: { tool: name, ok: false, summary: msg },
				};
			}
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Tool execution failed';
		return {
			result: JSON.stringify({ ok: false, error: msg }),
			action: { tool: name, ok: false, summary: msg },
		};
	}
}
