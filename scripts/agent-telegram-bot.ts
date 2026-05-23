import 'dotenv/config';
import { handleFieldlotChatPost } from '../server/fieldlot-chat-handler.js';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!TELEGRAM_TOKEN) {
	console.error('Липсва TELEGRAM_BOT_TOKEN в .env');
	process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Използваме памет в RAM-а за потребителите (chat_id -> messages array)
const userSessions = new Map<number, { role: string; content: string }[]>();

async function getUpdates(offset: number) {
	try {
		const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=10`);
		if (!res.ok) return { ok: false, result: [] };
		return await res.json() as any;
	} catch (e) {
		console.error('Error fetching updates:', e);
		return { ok: false, result: [] };
	}
}

async function sendMessage(chatId: number, text: string) {
	try {
		await fetch(`${TELEGRAM_API}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
		});
	} catch (e) {
		console.error('Error sending message:', e);
	}
}

async function processMessage(chatId: number, text: string) {
	// Вземаме историята на чата за този потребител
	let messages = userSessions.get(chatId) || [];
	messages.push({ role: 'user', content: text });

	// Ограничаваме паметта до последните 10 съобщения
	if (messages.length > 10) messages = messages.slice(messages.length - 10);
	userSessions.set(chatId, messages);

	// Подготвяме заявка към съществуващия Chat Handler
	const requestBody = {
		messages,
		context: { lang: 'bg' }, // По подразбиране български
	};

	try {
		const result = await handleFieldlotChatPost(requestBody);
		if (result.ok && result.reply) {
			let replyText = result.reply;
			
			// Ако агентът е върнал действия (напр. намерени обяви)
			if (result.actions && result.actions.length > 0) {
				replyText += '\n\n*Действия:* ' + result.actions.map(a => a.summary).join(', ');
			}
			
			// Добавяме отговора в паметта
			messages.push({ role: 'assistant', content: result.reply });
			userSessions.set(chatId, messages);

			await sendMessage(chatId, replyText);
		} else {
			await sendMessage(chatId, "Извинете, възникна грешка в AI агента.");
		}
	} catch (error) {
		console.error('Error processing AI chat:', error);
		await sendMessage(chatId, "Грешка при връзката с Агента.");
	}
}

async function main() {
	console.log(`[Telegram Bot] Стартиране на Long-Polling...`);
	let lastUpdateId = 0;

	while (true) {
		const updates = await getUpdates(lastUpdateId + 1);
		if (updates.ok && updates.result.length > 0) {
			for (const update of updates.result) {
				lastUpdateId = update.update_id;
				
				if (update.message && update.message.text) {
					const chatId = update.message.chat.id;
					const text = update.message.text;
					console.log(`[Telegram] Съобщение от ${update.message.chat.first_name || chatId}: ${text}`);
					
					// Изпращаме "пише..." статус (optional)
					fetch(`${TELEGRAM_API}/sendChatAction`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ chat_id: chatId, action: 'typing' })
					}).catch(() => {});

					await processMessage(chatId, text);
				}
			}
		}
		// Кратка пауза, за да не спамим CPU-то
		await new Promise(resolve => setTimeout(resolve, 500));
	}
}

main().catch(console.error);
