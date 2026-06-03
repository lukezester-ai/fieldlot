/**
 * Fieldlot Guide — agent tools (actions): email, listings, exchange, API fetch.
 */
import {
	FIELDLOT_CATEGORY_IDS,
	FIELDLOT_CROP_IDS,
	matchListingCategory,
	matchListingCrop,
	matchListingRegion,
} from './fieldlot-categories.js';
import { classifyAgroImage, visionResultToListingHint } from './fieldlot-vision.js';
import {
	draftListingFromFacts,
	editListingDraft,
	listingToDraft,
	polishListingDraft,
	type ListingDraft,
} from './fieldlot-listing-writer.js';
import { getExchangeSnapshotCached } from './exchange-prices.js';
import { getAllListings, type FieldlotListing } from './fieldlot-rag.js';
import { getListingsSnapshot, getStaticListingsSnapshot } from './listings-data.js';
import { handleRegisterInterestPost, type LeadHandlerCtx } from './register-interest.js';
import fs from 'node:fs';
import path from 'node:path';
import { runListingsSyncPipeline } from './sync-listings-pipeline.js';

export type AgentActionRecord = {
	tool: string;
	ok: boolean;
	summary: string;
};

export type AgentToolContext = {
	lang: 'bg' | 'en' | 'de' | 'de';
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
	crop?: string;
	region?: string;
	role?: string;
}): FieldlotListing[] {
	const q = (args.query ?? '').toLowerCase().trim();
	const cat = args.category?.trim();
	const crop = args.crop?.trim();
	const reg = args.region?.trim();
	const role = args.role?.trim();

	return getAllListings().filter((item) => {
		if (cat && !matchListingCategory(item, cat)) return false;
		if (crop && !matchListingCrop(item, crop)) return false;
		if (reg && !matchListingRegion(item, reg)) return false;
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
			description:
				'Search live B2B agro listings by text, category (veg/fruit/grain/oil/canned/fertilizer/machines/feed), crop (wheat/barley/corn…), region, or role.',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Free text: crop, region, quality…' },
					category: {
						type: 'string',
						enum: [...FIELDLOT_CATEGORY_IDS],
						description: 'Market section: veg, fruit, grain, oil, canned, fertilizer, machines, feed',
					},
					crop: {
						type: 'string',
						enum: [...FIELDLOT_CROP_IDS],
						description: 'Specific crop/product: wheat, barley, tomato, preserves, tractor…',
					},
					region: {
						type: 'string',
						enum: ['dobrudzha', 'north', 'south', 'west', 'national'],
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
			name: 'classify_crop_image',
			description:
				'Classify an agro product photo (base64) into category and crop (wheat vs barley, veg preserves, machinery, herbs). Use when user sends or describes a photo.',
			parameters: {
				type: 'object',
				properties: {
					image_base64: { type: 'string', description: 'Base64 image data (no data: prefix required)' },
					mime_type: { type: 'string', description: 'image/jpeg, image/png, image/webp' },
				},
				required: ['image_base64'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'draft_listing',
			description:
				'Write a new B2B agro listing draft (title, quality text, qty, price, incoterm). Use when user wants to publish/sell/buy and needs ad copy. Returns formatted text + structured fields.',
			parameters: {
				type: 'object',
				properties: {
					product: { type: 'string', description: 'Crop/product name e.g. Пшеница, домати' },
					role: { type: 'string', enum: ['sell', 'buy'] },
					category: { type: 'string', enum: [...FIELDLOT_CATEGORY_IDS] },
					crop: { type: 'string', enum: [...FIELDLOT_CROP_IDS] },
					qty: { type: 'string', description: 'e.g. 85 т, 200+ т' },
					region: {
						type: 'string',
						enum: ['dobrudzha', 'north', 'south', 'west', 'national'],
					},
					price: { type: 'string' },
					price_unit: { type: 'string' },
					incoterm: { type: 'string', description: 'FCA, EXW…' },
					harvest: { type: 'string' },
					quality: { type: 'string', description: 'Specs: moisture, class, certificates' },
					contact: { type: 'string' },
					notes: { type: 'string', description: 'Extra facts from user' },
					polish: { type: 'boolean', description: 'LLM polish (default true)' },
				},
				required: ['product'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'edit_listing',
			description:
				'Edit an existing listing draft or catalog listing by id. Apply user change requests (shorter text, add price, fix typos, translate).',
			parameters: {
				type: 'object',
				properties: {
					listing_id: { type: 'string', description: 'Catalog id e.g. ba-86 (optional if draft provided)' },
					instructions: {
						type: 'string',
						description: 'What to change: tone, add FCA, shorten, fix grammar…',
					},
					product: { type: 'string' },
					role: { type: 'string', enum: ['sell', 'buy'] },
					qty: { type: 'string' },
					price: { type: 'string' },
					quality: { type: 'string' },
				},
				required: ['instructions'],
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
	{
		type: 'function' as const,
		function: {
			name: 'calculate_transport_cost',
			description: 'Calculate approximate transport cost based on distance and cargo volume/weight. Base rate is around 2.0-2.5 BGN/km.',
			parameters: {
				type: 'object',
				properties: {
					distance_km: { type: 'number' },
					cargo_tons: { type: 'number' },
					truck_type: { type: 'string', enum: ['standard', 'refrigerated', 'tipper'] }
				},
				required: ['distance_km', 'cargo_tons'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'draft_negotiation',
			description: 'Draft a professional B2B email/message for negotiating a listing price or terms.',
			parameters: {
				type: 'object',
				properties: {
					listing_id: { type: 'string', description: 'Listing ID to negotiate for' },
					offer_price: { type: 'string', description: 'Proposed price by the user' },
					tone: { type: 'string', enum: ['polite', 'firm', 'inquiry'], description: 'Tone of the message' }
				},
				required: ['listing_id', 'offer_price'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'clean_stale_listings',
			description: 'Remove all old/stale listings from the catalog based on the freshness policy.',
			parameters: { type: 'object', properties: {}, additionalProperties: false }
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'parse_pdf_document',
			description: 'Parse text from a PDF document to read its content. The input is a base64 encoded string of the PDF.',
			parameters: {
				type: 'object',
				properties: {
					pdf_base64: { type: 'string', description: 'Base64 encoded PDF string' }
				},
				required: ['pdf_base64'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'update_platform_knowledge',
			description: 'Add new documentation text to the platform knowledge base. This allows all agents to answer questions based on this knowledge later.',
			parameters: {
				type: 'object',
				properties: {
					title: { type: 'string', description: 'Title of the document' },
					content: { type: 'string', description: 'The text content to store' }
				},
				required: ['title', 'content'],
				additionalProperties: false
			}
		}
	}
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
					crop: typeof args.crop === 'string' ? args.crop : undefined,
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

			case 'classify_crop_image': {
				const b64 = typeof args.image_base64 === 'string' ? args.image_base64 : '';
				const mime = typeof args.mime_type === 'string' ? args.mime_type : 'image/jpeg';
				const v = await classifyAgroImage({
					imageBase64: b64,
					mimeType: mime,
					lang: ctx.lang,
				});
				const summary =
					ctx.lang === 'en'
						? `Photo: ${v.category}${v.crop ? ` · ${v.crop}` : ''} (${Math.round(v.confidence * 100)}%)`
						: `Снимка: ${v.category}${v.crop ? ` · ${v.crop}` : ''} (${Math.round(v.confidence * 100)}%)`;
				return {
					result: JSON.stringify({
						ok: v.ok,
						classification: v,
						hint: visionResultToListingHint(v),
						suggestSearch: {
							category: v.category,
							crop: v.crop,
						},
					}),
					action: { tool: name, ok: v.ok, summary },
				};
			}

			case 'draft_listing': {
				let draft = draftListingFromFacts({
					lang: ctx.lang,
					role: args.role === 'buy' ? 'buy' : 'sell',
					product: typeof args.product === 'string' ? args.product : undefined,
					category: typeof args.category === 'string' ? args.category : undefined,
					crop: typeof args.crop === 'string' ? args.crop : undefined,
					qty: typeof args.qty === 'string' ? args.qty : undefined,
					region: typeof args.region === 'string' ? args.region : undefined,
					price: typeof args.price === 'string' ? args.price : undefined,
					priceUnit: typeof args.price_unit === 'string' ? args.price_unit : undefined,
					incoterm: typeof args.incoterm === 'string' ? args.incoterm : undefined,
					harvest: typeof args.harvest === 'string' ? args.harvest : undefined,
					quality: typeof args.quality === 'string' ? args.quality : undefined,
					contact: typeof args.contact === 'string' ? args.contact : undefined,
					notes: typeof args.notes === 'string' ? args.notes : undefined,
				});
				if (args.polish !== false) draft = await polishListingDraft(draft, { lang: ctx.lang });
				const summary =
					ctx.lang === 'en'
						? `Listing draft: ${draft.title}`
						: `Чернова обява: ${draft.title}`;
				return {
					result: JSON.stringify({ ok: true, draft }),
					action: { tool: name, ok: true, summary },
				};
			}

			case 'edit_listing': {
				const instructions = typeof args.instructions === 'string' ? args.instructions.trim() : '';
				if (!instructions) {
					const msg = ctx.lang === 'en' ? 'instructions required' : 'нужни са инструкции';
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: msg },
					};
				}
				const listingId = typeof args.listing_id === 'string' ? args.listing_id.trim() : '';
				let base: ListingDraft;
				if (listingId) {
					const item = getAllListings().find((l) => l.id === listingId);
					if (!item) {
						const msg = ctx.lang === 'en' ? `Listing not found: ${listingId}` : `Няма обява: ${listingId}`;
						return {
							result: JSON.stringify({ ok: false, error: msg }),
							action: { tool: name, ok: false, summary: msg },
						};
					}
					base = listingToDraft(item, ctx.lang);
				} else {
					base = draftListingFromFacts({
						lang: ctx.lang,
						role: args.role === 'buy' ? 'buy' : 'sell',
						product: typeof args.product === 'string' ? args.product : undefined,
						qty: typeof args.qty === 'string' ? args.qty : undefined,
						price: typeof args.price === 'string' ? args.price : undefined,
						quality: typeof args.quality === 'string' ? args.quality : undefined,
					});
				}
				const draft = await editListingDraft(base, instructions, { lang: ctx.lang });
				const summary =
					ctx.lang === 'en' ? `Edited listing: ${draft.title}` : `Редакция: ${draft.title}`;
				return {
					result: JSON.stringify({ ok: true, draft }),
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

			case 'calculate_transport_cost': {
				const km = typeof args.distance_km === 'number' ? args.distance_km : 0;
				const tons = typeof args.cargo_tons === 'number' ? args.cargo_tons : 0;
				const type = typeof args.truck_type === 'string' ? args.truck_type : 'standard';
				
				let ratePerKm = 2.0;
				if (type === 'refrigerated') ratePerKm = 2.5;
				if (type === 'tipper') ratePerKm = 2.2;
				
				// Apply a simple minimum distance cost if it's too short
				const effectiveKm = Math.max(km, 50); 
				
				const totalCostBgn = effectiveKm * ratePerKm;
				const costPerTonBgn = tons > 0 ? totalCostBgn / tons : 0;

				const data = {
					distance_km: km,
					cargo_tons: tons,
					truck_type: type,
					total_cost_bgn: Math.round(totalCostBgn),
					cost_per_ton_bgn: Math.round(costPerTonBgn * 100) / 100,
					note: 'Това е индикативна цена на база средни пазарни тарифи.'
				};

				const summary = ctx.lang === 'en' ? 'Calculated transport cost' : 'Калкулирана цена за транспорт';
				return {
					result: JSON.stringify({ ok: true, data }),
					action: { tool: name, ok: true, summary }
				};
			}

			case 'draft_negotiation': {
				const id = typeof args.listing_id === 'string' ? args.listing_id.trim() : '';
				const offer = typeof args.offer_price === 'string' ? args.offer_price.trim() : '';
				const tone = typeof args.tone === 'string' ? args.tone : 'polite';
				
				const item = getAllListings().find((l) => l.id === id);
				if (!item) {
					const msg = ctx.lang === 'en' ? `Listing not found: ${id}` : `Няма обява: ${id}`;
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: msg },
					};
				}

				let draftText = '';
				if (ctx.lang === 'en') {
					draftText = `Hello,\n\nI am contacting you regarding your listing for ${item.title} (ID: ${id}).\n\nI would like to propose a price of ${offer} for the requested quantity. Please let me know if you are open to discussing this.\n\nLooking forward to your reply.\n\nBest regards,`;
				} else if (ctx.lang === 'de') {
					draftText = `Guten Tag,\n\nich kontaktiere Sie bezüglich Ihres Inserats für ${item.title} (ID: ${id}).\n\nIch möchte Ihnen einen Preis von ${offer} für die gewünschte Menge vorschlagen. Bitte lassen Sie mich wissen, ob Sie gesprächsbereit sind.\n\nIch freue mich auf Ihre Antwort.\n\nMit freundlichen Grüßen,`;
				} else {
					if (tone === 'firm') {
						draftText = `Здравейте,\n\nПиша Ви относно обявата Ви за ${item.title} (ID: ${id}). Офертата ми е ${offer}. Ако това Ви устройва, моля свържете се с мен възможно най-скоро, за да придвижим сделката.\n\nПоздрави,`;
					} else {
						draftText = `Здравейте,\n\nСвързвам се с Вас относно обявата за ${item.title} (ID: ${id}).\n\nИмам сериозен интерес и бих искал да предложа цена от ${offer}. Моля, уведомете ме дали бихте обсъдили тази оферта или какви са Вашите условия.\n\nОчаквам Вашия отговор.\n\nПоздрави,`;
					}
				}

				const data = {
					listing: listingSummary(item),
					offer_price: offer,
					draft_message: draftText
				};

				const summary = ctx.lang === 'en' ? 'Drafted negotiation message' : 'Съставено съобщение за преговори';
				return {
					result: JSON.stringify({ ok: true, data }),
					action: { tool: name, ok: true, summary }
				};
			}

			case 'clean_stale_listings': {
				const result = await runListingsSyncPipeline({ writeToDisk: true });
				const data = {
					kept: result.snapshot.count,
					pruned: result.snapshot.pruned
				};
				const summary = ctx.lang === 'en' ? `Cleaned listings (pruned ${data.pruned})` : `Почистени обяви (изтрити ${data.pruned})`;
				return {
					result: JSON.stringify({ ok: true, data }),
					action: { tool: name, ok: true, summary }
				};
			}

			case 'parse_pdf_document': {
				const base64 = typeof args.pdf_base64 === 'string' ? args.pdf_base64 : '';
				if (!base64) {
					return {
						result: JSON.stringify({ ok: false, error: 'No pdf_base64 provided' }),
						action: { tool: name, ok: false, summary: 'PDF Error' }
					};
				}
				
				try {
					// Dinamically import pdf-parse so it doesn't break if not installed
					const pdfParse = (await import('pdf-parse')) as any;
					const buffer = Buffer.from(base64, 'base64');
					const data = await pdfParse(buffer);
					
					return {
						result: JSON.stringify({ ok: true, text: data.text }),
						action: { tool: name, ok: true, summary: 'PDF разчетен успешно' }
					};
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: 'Грешка при четене на PDF' }
					};
				}
			}

			case 'update_platform_knowledge': {
				const title = typeof args.title === 'string' ? args.title.trim() : 'Document';
				const content = typeof args.content === 'string' ? args.content.trim() : '';
				
				if (!content) {
					return {
						result: JSON.stringify({ ok: false, error: 'No content provided' }),
						action: { tool: name, ok: false, summary: 'Грешка: липсва съдържание' }
					};
				}
				
				const p = path.join(process.cwd(), 'data/platform-knowledge.json');
				let chunks: any[] = [];
				try {
					const raw = fs.readFileSync(p, 'utf8');
					const parsed = JSON.parse(raw);
					if (Array.isArray(parsed.chunks)) chunks = parsed.chunks;
				} catch {
					// ignore
				}
				
				chunks.push({
					id: `doc-${Date.now()}`,
					text: `=== ${title} ===\n${content}`
				});
				
				fs.writeFileSync(p, JSON.stringify({ chunks }, null, '\t') + '\n', 'utf8');
				
				return {
					result: JSON.stringify({ ok: true, saved: true, total_chunks: chunks.length }),
					action: { tool: name, ok: true, summary: `Документът '${title}' е запазен в базата` }
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

// Tool groupings for Multi-Agent Architecture
export const MARKET_TOOLS = FIELDLOT_AGENT_TOOLS.filter(t => ['get_exchange_prices', 'search_listings', 'get_listing', 'calculate_transport_cost', 'fetch_fieldlot_api'].includes(t.function.name));
export const COPYWRITER_TOOLS = FIELDLOT_AGENT_TOOLS.filter(t => ['draft_listing', 'edit_listing', 'draft_negotiation'].includes(t.function.name));
export const VISION_TOOLS = FIELDLOT_AGENT_TOOLS.filter(t => ['classify_crop_image'].includes(t.function.name));
export const ADMIN_TOOLS = FIELDLOT_AGENT_TOOLS.filter(t => ['clean_stale_listings', 'parse_pdf_document', 'update_platform_knowledge'].includes(t.function.name));
export const GENERAL_TOOLS = FIELDLOT_AGENT_TOOLS.filter(t => ['submit_early_access', 'send_team_email'].includes(t.function.name));
export const HERMES_TOOLS = FIELDLOT_AGENT_TOOLS.filter(t => ['search_listings', 'get_listing', 'calculate_transport_cost'].includes(t.function.name));