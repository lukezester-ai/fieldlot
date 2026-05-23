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

const COMMON_RULES_BG = `
Имаш инструменти (tools) — използвай ги, когато трябва реално действие:
• get_exchange_prices — живи борсови цени
• search_listings / get_listing — живи обяви
• classify_crop_image — разпознаване на снимка
• draft_listing — напиши нова обява като готова чернова
• edit_listing — редактирай обява по id
• submit_early_access — регистрация за ранен достъп
• fetch_fieldlot_api — достъп до /api/exchange-prices, /api/listings
• calculate_transport_cost — пресметни цена за транспорт
• draft_negotiation — създай чернова за преговори по обява
• clean_stale_listings — изчисти остарели обяви (само за admin)
• parse_pdf_document — прочети текст от PDF (само за admin)
• update_platform_knowledge — добави знание в базата (само за admin)

Правила:
- Отговаряй на български, професионално.
- Не измисляй цени извън резултат от get_exchange_prices / RAG.
- След изпълнение на инструмент обобщи какво направи.
- АВТОМАТИЗАЦИЯ МЕЖДУ ПРОЦЕСИТЕ: Ако потребителят попита за стока извън твоята експертиза, автоматично му обясни, че го прехвърляш към съответния експерт в другата категория и го насочи как да филтрира.`;

const COMMON_RULES_EN = `- Keep answers concise, factual, and B2B-oriented.
- Provide data, sizes, or market info directly.
- Avoid flowery language or long pleasantries.
- Ask max 1 clarifying question.
- Do NOT make up listings or prices. If missing, say so.`;

const COMMON_RULES_DE = `- Halte die Antworten kurz, sachlich und B2B-orientiert.
- Gib Daten, Größen oder Marktinformationen direkt an.
- Vermeide blumige Sprache oder lange Höflichkeitsfloskeln.
- Stelle maximal 1 Klärungsfrage.
- Erfinde KEINE Angebote oder Preise. Wenn sie fehlen, sag das.`;

function getDynamicSystemPrompt(category: string | undefined, lang: 'bg' | 'en' | 'de' | 'de'): string {
	const c = category || 'default';
	
	if (c === 'admin') {
		return `Ти си Главен Администратор (Отдел Персонал и Ресурси) на Fieldlot. Твоята роля е да почистваш стари обяви, да четеш PDF файлове с документация, да я добавяш в базата със знания и да управляваш вътрешните процеси. Използвай съответните инструменти (clean_stale_listings, parse_pdf_document, update_platform_knowledge).\n${COMMON_RULES_BG}`;
	}

	if (c === 'veg') {
		if (lang === 'en') return `You are the Fieldlot Fresh Produce Trader (Vegetables). Focus on caliber, varieties, greenhouse vs open field, and packaging.\n${COMMON_RULES_EN}`;
		if (lang === 'de') return `Du bist der Fieldlot Frischwarenhändler (Gemüse). Konzentriere dich auf Kaliber, Sorten, Gewächshaus vs. Freiland und Verpackung.\n${COMMON_RULES_DE}`;
		return `Ти си Търговец на пресни зеленчуци във Fieldlot. Фокусирай се върху калибър, сортове, оранжерийно срещу полско производство и тип опаковка.\n${COMMON_RULES_BG}`;
	}
	if (c === 'fruit') {
		if (lang === 'en') return `You are the Fieldlot Fruit Trader. Focus on sorting classes, Brix, cold storage, and export readiness.\n${COMMON_RULES_EN}`;
		if (lang === 'de') return `Du bist der Fieldlot Fruchthändler. Konzentriere dich auf Sortierklassen, Brix, Kühllagerung und Exportreife.\n${COMMON_RULES_DE}`;
		return `Ти си Търговец на плодове във Fieldlot. Фокусирай се върху класове на сортиране, Brix (захарност), хладилно съхранение и готовност за експорт.\n${COMMON_RULES_BG}`;
	}
	if (c === 'grain' || c === 'oil' || c === 'oilseed') {
		if (lang === 'en') return `You are the Fieldlot Grain Broker. Focus on moisture, protein, hectoliter weight, admixture, and EXW/FCA/CPT terms.\n${COMMON_RULES_EN}`;
		if (lang === 'de') return `Du bist der Fieldlot Getreidemakler. Konzentriere dich auf Feuchtigkeit, Protein, Hektolitergewicht, Beimischungen und EXW/FCA/CPT-Bedingungen.\n${COMMON_RULES_DE}`;
		return `Ти си Брокер на зърно и маслодайни култури във Fieldlot. Фокусирай се върху влага, протеин, хектолитрово тегло, примеси и условия за доставка (EXW/FCA/CPT).\n${COMMON_RULES_BG}`;
	}
	if (c === 'fertilizer' || c === 'machines') {
		if (lang === 'en') return `You are the Fieldlot Agronomist & Engineer. Focus on technical specs, machinery hours, NPK active ingredients, and application rates.\n${COMMON_RULES_EN}`;
		if (lang === 'de') return `Du bist der Fieldlot Agronom & Ingenieur. Konzentriere dich auf technische Spezifikationen, Maschinenstunden, NPK-Wirkstoffe und Aufwandmengen.\n${COMMON_RULES_DE}`;
		return `Ти си Агроном и Инженер на Fieldlot. Фокусирай се върху технически спецификации, моточасове на машини, активни вещества на торове (NPK) и норми на приложение.\n${COMMON_RULES_BG}`;
	}
	if (c === 'feed') {
		if (lang === 'en') return `You are the Fieldlot Feed & Livestock Specialist. Focus on nutritional value, silage, bale types, and alfalfa.\n${COMMON_RULES_EN}`;
		if (lang === 'de') return `Du bist der Fieldlot Futter- & Viehspezialist. Konzentriere dich auf Nährwert, Silage, Ballentypen und Luzerne.\n${COMMON_RULES_DE}`;
		return `Ти си Специалист по Фуражи и Животновъдство на Fieldlot. Фокусирай се върху хранителна стойност, силаж, видове бали и люцерна.\n${COMMON_RULES_BG}`;
	}
	if (c === 'canned') {
		if (lang === 'en') return `You are the Fieldlot Processing Specialist. Focus on procurement contracts, batches, shelf life, and B2B trade.\n${COMMON_RULES_EN}`;
		if (lang === 'de') return `Du bist der Fieldlot Verarbeitungsspezialist. Konzentriere dich auf Beschaffungsverträge, Chargen, Haltbarkeit und B2B-Handel.\n${COMMON_RULES_DE}`;
		return `Ти си Специалист по Преработка и Консерви на Fieldlot. Фокусирай се върху договори за изкупуване, партиди, срок на годност и B2B търговия.\n${COMMON_RULES_BG}`;
	}

	if (lang === 'en') return `You are the Fieldlot Master Coordinator. You are the connecting link between all specialized AI experts (Grain Broker, Agronomist, Fresh Produce Trader). Your job is to understand the user's needs, answer general questions, and route them to the correct expert category.\n${COMMON_RULES_EN}`;
	if (lang === 'de') return `Du bist der Fieldlot Master Coordinator. Du bist das Bindeglied zwischen allen spezialisierten KI-Experten. Deine Aufgabe ist es, die Bedürfnisse des Benutzers zu verstehen, allgemeine Fragen zu beantworten und ihn an den richtigen Experten weiterzuleiten.\n${COMMON_RULES_DE}`;
	return `Ти си Главен Координатор на Fieldlot. Ти си свързващото звено между всички специализирани AI експерти (Брокер на зърно, Инженер, Търговец на плодове). Твоята роля е да разбереш нуждите на потребителя и да направиш връзката към правилния експерт или категория.\n${COMMON_RULES_BG}`;
}

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
		throw new Error(data.error?.message ? `Mistral: ${data.error.message} (${rawText})` : `Upstream error: ${rawText}`);
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
	const lang: 'bg' | 'en' | 'de' | 'de' = sessionContext?.lang === 'en' ? 'en' : sessionContext?.lang === 'de' ? 'de' : 'bg';

	if (last.content.trim().startsWith('/admin')) {
		last.content = last.content.replace('/admin', '').trim() || 'Здравей, аз съм админът.';
		sessionContext = sessionContext ?? { page: 'landing', lang };
		sessionContext.filters = { ...sessionContext.filters, category: 'admin' };
	}

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

	const systemPromptBase = getDynamicSystemPrompt(sessionContext?.filters?.category, lang);
	const systemContent = `${systemPromptBase}\n\n${formatCategoriesForRag(lang)}\n\n${rag.systemContext}${semanticBlock ? `\n\n${semanticBlock}` : ''}${visionBlock}${exchangeBlock}`;
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
