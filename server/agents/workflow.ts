import { callChatCompletions, type ChatCompletionMessage } from '../fieldlot-chat-handler.js';
import { executeAgentTool, FIELDLOT_AGENT_TOOLS, type AgentActionRecord, type AgentToolContext } from '../fieldlot-agent-tools.js';
import { openAIMessageContentToString, type TextChatUpstream } from '../llm-upstream.js';
import type { ListingDraft } from '../fieldlot-listing-writer.js';

const ROUTER_SYSTEM_PROMPT = `
You are the Fieldlot Router Agent (Agent 1).
Analyze the user's latest message and reply with exactly ONE of the following words in a JSON object: {"route": "research"} or {"route": "write"} or {"route": "general"}.

Rules:
- "research": user asks about prices, searching listings, or identifying a crop from a photo.
- "write": user wants to draft/edit a listing (sell/buy) or contact the team.
- "general": simple greeting or general question.
`;

export type AgentResponse = {
	reply: string;
	route: string;
	actions: AgentActionRecord[];
	listingDraft?: ListingDraft;
};

export async function runMultiAgentWorkflow(
	messages: ChatCompletionMessage[],
	ctx: AgentToolContext,
	systemContext: string,
	upstream: TextChatUpstream
): Promise<AgentResponse> {
	// --- AGENT 1: ROUTER ---
	const routerMessages: ChatCompletionMessage[] = [
		{ role: 'system', content: ROUTER_SYSTEM_PROMPT },
		// Take only the last message for routing to keep it fast
		messages[messages.length - 1],
	];

	let route = 'general';
	try {
		const { message: routerRes } = await callChatCompletions(upstream, routerMessages, { tools: false, maxTokens: 50 });
		const text = openAIMessageContentToString(routerRes.content);
		if (text.includes('"research"')) route = 'research';
		else if (text.includes('"write"')) route = 'write';
	} catch (e) {
		console.error('Router failed, defaulting to general', e);
	}

	// Filter tools based on route
	let activeToolNames = new Set<string>();
	let specialistPrompt = systemContext;

	if (route === 'research') {
		activeToolNames = new Set(['get_exchange_prices', 'search_listings', 'get_listing', 'classify_crop_image', 'get_weather_forecast', 'calculate_transport_cost']);
		specialistPrompt += '\n\nYou are the Researcher Agent (Agent 2). Focus on finding the best market data and listings. Use tools.';
	} else if (route === 'write') {
		activeToolNames = new Set(['draft_listing', 'edit_listing', 'submit_early_access', 'send_team_email']);
		specialistPrompt += '\n\nYou are the Writer Agent (Agent 3). Focus on drafting professional B2B agro listings. Use tools.';
	} else {
		// general gets all tools just in case, but typically won't use them
		FIELDLOT_AGENT_TOOLS.forEach(t => activeToolNames.add(t.function.name));
	}

	// Update the system message for the specialist agent
	const specialistMessages = [...messages];
	if (specialistMessages.length > 0 && specialistMessages[0].role === 'system') {
		specialistMessages[0] = { role: 'system', content: specialistPrompt };
	} else {
		specialistMessages.unshift({ role: 'system', content: specialistPrompt });
	}

	// Temporarily override the global FIELDLOT_AGENT_TOOLS for this execution loop
	// (in a real app we'd pass allowed tools, but since upstream.supportsTools uses the global,
	// we will just let it use the global and reject unallowed ones in the loop)
	
	const actions: AgentActionRecord[] = [];
	let listingDraft: ListingDraft | undefined;
	const maxSteps = route === 'general' ? 1 : 5;

	for (let step = 0; step < maxSteps; step++) {
		const { message } = await callChatCompletions(upstream, specialistMessages, { tools: true, maxTokens: 1100 });
		
		const toolCalls = message.tool_calls?.filter(
			(tc) => tc?.function?.name && typeof tc.function.arguments === 'string',
		);

		if (!toolCalls?.length) {
			const rawReply = openAIMessageContentToString(message.content);
			return { reply: rawReply || '', route, actions, listingDraft };
		}

		specialistMessages.push({ role: 'assistant', content: message.content ?? null, tool_calls: toolCalls });

		for (const tc of toolCalls) {
			if (!activeToolNames.has(tc.function.name)) {
				const errorMsg = `Tool ${tc.function.name} is not allowed for route ${route}`;
				specialistMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ ok: false, error: errorMsg }) });
				continue;
			}

			const { result, action } = await executeAgentTool(tc.function.name, tc.function.arguments, ctx);
			actions.push(action);

			if (tc.function.name === 'draft_listing' || tc.function.name === 'edit_listing') {
				try {
					const parsed = JSON.parse(result) as { draft?: ListingDraft };
					if (parsed.draft?.formattedText) listingDraft = parsed.draft;
				} catch {
					// ignore
				}
			}

			specialistMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
		}
	}

	return {
		reply: 'I ran several actions but need a simpler question to finish.',
		route,
		actions,
		listingDraft
	};
}
