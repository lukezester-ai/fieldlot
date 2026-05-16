import {
	formatExchangeForRag,
	getExchangeSnapshotCached,
} from './exchange-prices.js';
import {
	buildFieldlotRagContext,
	parseFieldlotChatContext,
} from './fieldlot-rag.js';
import {
	chatProviderLabel,
	openAIMessageContentToString,
	resolveTextChatUpstream,
} from './llm-upstream.js';

export type FieldlotChatTurn = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 2800;
const MAX_REPLY_CHARS = 4000;

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max)}\n...`;
}

const FIELDLOT_SYSTEM = `Ти си "Fieldlot Guide" — пълномощен RAG асистент на Fieldlot (български B2B агро пазар).

Имаш ПЪЛЕН достъп до: всички секции на сайта, всички 8 demo обяви, image manifest (кои снимки къде са), борса, логистика, фермери, форма за ранен достъп.

Отговаряй на български, професионално и ясно. Можеш да:
- описваш и сравняваш ВСИЧКИ demo обяви по id;
- обясняваш коя снимка от /images/... отговаря на коя култура/секция;
- насочваш към точни URL и филтри в каталога;
- помагаш с текст на обява и запитване към /#cta;
- отговаряш за борсови цени (пшеница, слънчоглед, царевица, рапица) само от блока „БОРСОВИ ЦЕНИ“ в RAG.

Борса: следи котировките веднъж на ден (източник borsaagro.com / MATIF). Не измисляй цени извън RAG.

LLM backend: предпочитай Mistral (MISTRAL_API_KEY на сървъра). Без markdown code fences.`;

function isTurn(v: unknown): v is FieldlotChatTurn {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return (o.role === 'user' || o.role === 'assistant') && typeof o.content === 'string';
}

export async function handleFieldlotChatPost(
	rawBody: unknown,
): Promise<
	| { ok: true; reply: string; rag?: { listingIds: string[]; knowledgeIds: string[] } }
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

	const sessionContext = parseFieldlotChatContext(body.context);
	const rag = buildFieldlotRagContext(last.content, sessionContext);
	let exchangeBlock = '';
	try {
		const snap = await getExchangeSnapshotCached();
		exchangeBlock = `\n\n${formatExchangeForRag(snap)}`;
	} catch {
		exchangeBlock =
			'\n\n=== RAG: БОРСОВИ ЦЕНИ ===\nВременно недостъпни — кажи на потребителя да провери #exchange на сайта.';
	}
	const systemContent = `${FIELDLOT_SYSTEM}\n\n${rag.systemContext}${exchangeBlock}`;

	const chatMessages = [
		{ role: 'system' as const, content: systemContent },
		...cleaned.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
	];

	const temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.45);
	const safeTemp = Number.isFinite(temperature) ? Math.min(1.1, Math.max(0, temperature)) : 0.45;

	const payload: Record<string, unknown> = {
		model: upstream.model,
		temperature: safeTemp,
		max_tokens: 950,
		messages: chatMessages,
	};

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (upstream.bearer) {
		headers.Authorization = `Bearer ${upstream.bearer}`;
	}

	let res: Response;
	try {
		res = await fetch(upstream.completionUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
		});
	} catch {
		const label = chatProviderLabel(upstream.provider);
		return {
			ok: false,
			status: 502,
			error: `Мрежова грешка към ${label}`,
			hint:
				upstream.provider === 'ollama'
					? 'Пусни Ollama (ollama serve) и провери OLLAMA_BASE_URL.'
					: undefined,
		};
	}

	const raw = await res.text();
	let data: { error?: { message?: string }; choices?: { message?: { content?: unknown } }[] };
	try {
		if (!raw.trim()) {
			return {
				ok: false,
				status: 502,
				error: 'Празен отговор от LLM',
				hint: 'Провери ключа и името на модела.',
			};
		}
		data = JSON.parse(raw) as typeof data;
	} catch {
		return {
			ok: false,
			status: 502,
			error: 'Невалиден JSON от LLM',
			hint: 'Провери доставчика и логовете.',
		};
	}

	if (!res.ok) {
		const detail = data.error?.message || res.statusText || 'Upstream error';
		return {
			ok: false,
			status: res.status >= 400 && res.status < 600 ? res.status : 502,
			error: detail,
		};
	}

	const rawReply = openAIMessageContentToString(data.choices?.[0]?.message?.content);
	if (!rawReply) {
		return { ok: false, status: 502, error: 'Празно съдържание от модела' };
	}

	return {
		ok: true,
		reply: truncate(rawReply.trim(), MAX_REPLY_CHARS),
		rag: { listingIds: rag.listingIds, knowledgeIds: rag.knowledgeIds },
	};
}
