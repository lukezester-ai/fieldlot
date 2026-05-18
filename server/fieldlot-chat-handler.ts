import {
	executeAgentTool,
	FIELDLOT_AGENT_TOOLS,
	type AgentActionRecord,
} from './fieldlot-agent-tools.js';
import {
	formatExchangeForRag,
	getExchangeSnapshotCached,
} from './exchange-prices.js';
import {
	buildFieldlotRagContext,
	parseFieldlotChatContext,
} from './fieldlot-rag.js';
import { formatCategoriesForRag } from './fieldlot-categories.js';
import {
	formatSemanticHitsForPrompt,
	searchFieldlotSemanticRag,
	type FieldlotRagHit,
} from './fieldlot-semantic-rag.js';
import { classifyAgroImage, visionResultToListingHint } from './fieldlot-vision.js';
import type { ListingDraft } from './fieldlot-listing-writer.js';
import {
	chatProviderLabel,
	openAIMessageContentToString,
	resolveTextChatUpstream,
	type TextChatUpstream,
} from './llm-upstream.js';

export type FieldlotChatTurn = { role: 'user' | 'assistant'; content: string };

type ToolCall = {
	id: string;
	type: string;
	function: { name: string; arguments: string };
};

type ChatCompletionMessage = {
	role: string;
	content?: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
};

const MAX_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 2800;
const MAX_REPLY_CHARS = 4000;
const MAX_AGENT_STEPS = 6;

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max)}\n...`;
}

const FIELDLOT_SYSTEM_BG = `Ти си "Fieldlot Guide" — AI агент с RAG и ИЗПЪЛНЕНИЕ НА ДЕЙСТВИЯ на Fieldlot (български B2B агро пазар).

Имаш инструменти (tools) — използвай ги, когато трябва реално действие, не само текст:
• get_exchange_prices — живи борсови цени
• search_listings / get_listing — живи обяви (филтър: veg, fruit, grain, oil, canned, fertilizer, machines, feed + crop: wheat, barley…)
• classify_crop_image — разпознаване на снимка (пшеница/ечемик, консерви, техника, билки…)
• draft_listing — напиши нова обява (заглавие, качество, количество, цена, Incoterm) като готова чернова
• edit_listing — редактирай обява по id (ba-…) или чернова според инструкции на потребителя
• submit_early_access — регистрация за ранен достъп (имейл до екипа) САМО ако потребителят е дал име и имейл и иска регистрация
• send_team_email — изпрати съобщение до екипа Fieldlot (обобщение, запитване)
• fetch_fieldlot_api — /api/exchange-prices, /api/listings или /data/live-listings.json

Правила:
- Отговаряй на български, ясно и професионално.
- Преди submit_early_access потвърди данните с потребителя.
- Не измисляй цени извън резултат от get_exchange_prices / RAG.
- За „напиши/редактирай обява“ → draft_listing / edit_listing; покажи formattedText на потребителя и какво липсва (checklist).
- След изпълнение на инструмент обобщи какво направи.
- Без markdown code fences.`;

const FIELDLOT_SYSTEM_EN = `You are "Fieldlot Guide" — an AI agent with RAG and ACTION execution for Fieldlot (Bulgarian B2B agro marketplace).

You have tools — use them when a real action is needed, not text only:
• get_exchange_prices — live exchange prices
• search_listings / get_listing — live listings (filter by category + crop)
• classify_crop_image — classify user photo (wheat vs barley, preserves, machinery, herbs)
• draft_listing — write a new listing draft (professional B2B copy)
• edit_listing — edit listing by id or draft per user instructions
• submit_early_access — early access registration (email to team) ONLY when user gave name + email and wants to register
• send_team_email — message Fieldlot team (summary, inquiry)
• fetch_fieldlot_api — /api/exchange-prices, /api/listings or /data/live-listings.json

Rules:
- Reply in English, clear and professional.
- Confirm data before submit_early_access.
- Do not invent prices outside get_exchange_prices / RAG.
- For “write/edit listing” → use draft_listing / edit_listing; show formattedText and checklist.
- After running a tool, summarize what you did.
- No markdown code fences.`;

function isTurn(v: unknown): v is FieldlotChatTurn {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return (o.role === 'user' || o.role === 'assistant') && typeof o.content === 'string';
}

async function callChatCompletions(
	upstream: TextChatUpstream,
	messages: ChatCompletionMessage[],
	opts: { tools?: boolean; maxTokens?: number },
): Promise<{ message: ChatCompletionMessage; raw: unknown }> {
	const temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.45);
	const safeTemp = Number.isFinite(temperature) ? Math.min(1.1, Math.max(0, temperature)) : 0.45;

	const payload: Record<string, unknown> = {
		model: upstream.model,
		temperature: safeTemp,
		max_tokens: opts.maxTokens ?? 950,
		messages,
	};

	if (opts.tools && upstream.supportsTools) {
		payload.tools = FIELDLOT_AGENT_TOOLS;
		payload.tool_choice = 'auto';
	}

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (upstream.bearer) headers.Authorization = `Bearer ${upstream.bearer}`;

	const res = await fetch(upstream.completionUrl, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
	});

	const rawText = await res.text();
	let data: {
		error?: { message?: string };
		choices?: { message?: ChatCompletionMessage }[];
	};
	try {
		data = rawText.trim() ? (JSON.parse(rawText) as typeof data) : {};
	} catch {
		throw new Error('Невалиден JSON от LLM');
	}

	if (!res.ok) {
		throw new Error(data.error?.message || res.statusText || 'Upstream error');
	}

	const message = data.choices?.[0]?.message;
	if (!message) throw new Error('Празно съдържание от модела');
	return { message, raw: data };
}

export async function handleFieldlotChatPost(
	rawBody: unknown,
	opts?: { clientIp?: string | null },
): Promise<
	| {
			ok: true;
			reply: string;
			rag?: { listingIds: string[]; knowledgeIds: string[] };
			semanticHits?: FieldlotRagHit[];
			actions?: AgentActionRecord[];
			agentMode?: boolean;
			imageClassification?: Awaited<ReturnType<typeof classifyAgroImage>>;
			listingDraft?: ListingDraft;
	  }
	| { ok: false; status: number; error: string; hint?: string }
> {
	const upstream = resolveTextChatUpstream();
	if (!upstream) {
		return {
			ok: false,
			status: 503,
			error: 'LLM не е конфигуриран',
			hint: 'За Mistral: задай MISTRAL_API_KEY (и по желание MISTRAL_CHAT_MODEL=mistral-small-latest) в Vercel env и redeploy.',
		};
	}

	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Невалидно JSON тяло' };
	}

	const body = rawBody as Record<string, unknown>;
	const messagesRaw = body.messages;
	if (!Array.isArray(messagesRaw)) {
		return { ok: false, status: 400, error: 'messages трябва да е масив' };
	}

	const cleaned: FieldlotChatTurn[] = [];
	for (const m of messagesRaw.slice(-MAX_MESSAGES)) {
		if (!isTurn(m)) continue;
		const content = truncate(m.content.trim(), MAX_MESSAGE_CHARS);
		if (!content) continue;
		cleaned.push({ role: m.role, content });
	}

	if (cleaned.length === 0) {
		return { ok: false, status: 400, error: 'Няма валидни съобщения' };
	}

	const last = cleaned[cleaned.length - 1];
	if (last.role !== 'user') {
		return { ok: false, status: 400, error: 'Последното съобщение трябва да е от потребителя' };
	}

	let sessionContext = parseFieldlotChatContext(body.context);
	const lang: 'bg' | 'en' = sessionContext?.lang === 'en' ? 'en' : 'bg';

	let imageClassification: Awaited<ReturnType<typeof classifyAgroImage>> | undefined;
	let visionBlock = '';
	const imgRaw = body.image;
	if (imgRaw && typeof imgRaw === 'object') {
		const io = imgRaw as Record<string, unknown>;
		const imageBase64 =
			typeof io.base64 === 'string'
				? io.base64
				: typeof io.imageBase64 === 'string'
					? io.imageBase64
					: '';
		if (imageBase64.trim()) {
			imageClassification = await classifyAgroImage({
				imageBase64,
				mimeType: typeof io.mimeType === 'string' ? io.mimeType : 'image/jpeg',
				lang,
			});
			if (imageClassification.ok) {
				visionBlock = `\n\n=== RAG: СНИМКА ОТ ПОТРЕБИТЕЛЯ ===\n${visionResultToListingHint(imageClassification)}\n${lang === 'en' ? imageClassification.summaryEn : imageClassification.summaryBg}\nПрепоръка: search_listings с category=${imageClassification.category}${imageClassification.crop ? `, crop=${imageClassification.crop}` : ''}.`;
				sessionContext = sessionContext ?? { page: 'landing', lang };
				sessionContext.filters = {
					...sessionContext.filters,
					category: imageClassification.category,
					...(imageClassification.crop ? { crop: imageClassification.crop } : {}),
				};
			}
		}
	}

	const rag = buildFieldlotRagContext(last.content, sessionContext);
	const semanticHits = await searchFieldlotSemanticRag(
		[last.content, imageClassification?.summaryBg, imageClassification?.labels?.join(' ')]
			.filter(Boolean)
			.join(' '),
		8,
	);
	const semanticBlock = formatSemanticHitsForPrompt(semanticHits, lang);
	let exchangeBlock = '';
	try {
		const snap = await getExchangeSnapshotCached();
		exchangeBlock = `\n\n${formatExchangeForRag(snap)}`;
	} catch {
		exchangeBlock =
			'\n\n=== RAG: БОРСОВИ ЦЕНИ ===\nВременно недостъпни — използвай get_exchange_prices.';
	}

	const systemContent = `${lang === 'en' ? FIELDLOT_SYSTEM_EN : FIELDLOT_SYSTEM_BG}\n\n${formatCategoriesForRag(lang)}\n\n${rag.systemContext}${semanticBlock ? `\n\n${semanticBlock}` : ''}${visionBlock}${exchangeBlock}`;
	const agentEnabled = upstream.supportsTools && process.env.FIELDLOT_AGENT_DISABLED !== '1';

	const chatMessages: ChatCompletionMessage[] = [
		{ role: 'system', content: systemContent },
		...cleaned.map((m) => ({ role: m.role, content: m.content })),
	];

	const actions: AgentActionRecord[] = [];
	let listingDraft: ListingDraft | undefined;

	if (!agentEnabled) {
		try {
			const { message } = await callChatCompletions(upstream, chatMessages, { tools: false });
			const rawReply = openAIMessageContentToString(message.content);
			if (!rawReply) return { ok: false, status: 502, error: 'Празно съдържание от модела' };
				return {
					ok: true,
					reply: truncate(rawReply.trim(), MAX_REPLY_CHARS),
					rag: { listingIds: rag.listingIds, knowledgeIds: rag.knowledgeIds },
					semanticHits: semanticHits.length ? semanticHits : undefined,
					imageClassification,
					agentMode: false,
				};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'LLM error';
			return {
				ok: false,
				status: 502,
				error: msg,
				hint:
					upstream.provider === 'ollama'
						? 'Ollama не поддържа agent tools — ползвай Mistral или OpenAI.'
						: undefined,
			};
		}
	}

	const toolCtx = { lang, clientIp: opts?.clientIp ?? null };

	for (let step = 0; step < MAX_AGENT_STEPS; step++) {
		try {
			const { message } = await callChatCompletions(upstream, chatMessages, {
				tools: true,
				maxTokens: 1100,
			});

			const toolCalls = message.tool_calls?.filter(
				(tc) => tc?.function?.name && typeof tc.function.arguments === 'string',
			);

			if (!toolCalls?.length) {
				const rawReply = openAIMessageContentToString(message.content);
				if (!rawReply) {
					return { ok: false, status: 502, error: 'Празно съдържание от модела' };
				}
				return {
					ok: true,
					reply: truncate(rawReply.trim(), MAX_REPLY_CHARS),
					rag: { listingIds: rag.listingIds, knowledgeIds: rag.knowledgeIds },
					semanticHits: semanticHits.length ? semanticHits : undefined,
					actions: actions.length ? actions : undefined,
					imageClassification,
					listingDraft,
					agentMode: true,
				};
			}

			chatMessages.push({
				role: 'assistant',
				content: message.content ?? null,
				tool_calls: toolCalls,
			});

			for (const tc of toolCalls) {
				const { result, action } = await executeAgentTool(
					tc.function.name,
					tc.function.arguments,
					toolCtx,
				);
				actions.push(action);
				if (tc.function.name === 'draft_listing' || tc.function.name === 'edit_listing') {
					try {
						const parsed = JSON.parse(result) as { draft?: ListingDraft };
						if (parsed.draft?.formattedText) listingDraft = parsed.draft;
					} catch {
						/* ignore */
					}
				}
				chatMessages.push({
					role: 'tool',
					tool_call_id: tc.id,
					content: result,
				});
			}
		} catch (e) {
			const label = chatProviderLabel(upstream.provider);
			const msg = e instanceof Error ? e.message : 'LLM error';
			return {
				ok: false,
				status: 502,
				error: `${label}: ${msg}`,
				hint:
					upstream.provider === 'ollama'
						? 'Пусни Ollama (ollama serve) и провери OLLAMA_BASE_URL.'
						: undefined,
			};
		}
	}

	const en = lang === 'en';
	return {
		ok: true,
		reply: truncate(
			en
				? 'I ran several actions but need a simpler question to finish — try again.'
				: 'Изпълних няколко действия, но ми трябва по-прост въпрос — опитай отново.',
			MAX_REPLY_CHARS,
		),
		rag: { listingIds: rag.listingIds, knowledgeIds: rag.knowledgeIds },
		semanticHits: semanticHits.length ? semanticHits : undefined,
		actions,
		imageClassification,
		listingDraft,
		agentMode: true,
	};
}
