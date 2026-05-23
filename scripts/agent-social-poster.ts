import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { callChatCompletions } from '../server/fieldlot-chat-handler.js';
import { resolveTextChatUpstream, openAIMessageContentToString } from '../server/llm-upstream.js';
import { getListingsSnapshot } from '../server/listings-data.js';
import { listingCrop } from '../server/fieldlot-categories.js';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();
const postedListingsPath = path.resolve('data/posted-listings.json');

async function sendTelegramMessage(text: string) {
	if (!TELEGRAM_TOKEN || !TELEGRAM_CHANNEL_ID) {
		console.error('[SocialPoster] Липсва TELEGRAM_BOT_TOKEN или TELEGRAM_CHANNEL_ID');
		return false;
	}
	
	const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: TELEGRAM_CHANNEL_ID,
				text,
				parse_mode: 'Markdown',
				disable_web_page_preview: false
			})
		});
		
		if (!res.ok) {
			console.error('[SocialPoster] Грешка при публикуване:', await res.text());
			return false;
		}
		return true;
	} catch (e) {
		console.error('[SocialPoster] Мрежова грешка:', e);
		return false;
	}
}

async function main() {
	console.log('[SocialPoster] Стартиране...');
	
	let postedIds: string[] = [];
	if (fs.existsSync(postedListingsPath)) {
		try {
			postedIds = JSON.parse(fs.readFileSync(postedListingsPath, 'utf8'));
		} catch (e) {
			console.error('[SocialPoster] Грешка при четене на posted-listings.json', e);
		}
	}

	const snapshot = await getListingsSnapshot(false);
	
	// Намираме първата обява, която не е публикувана
	const newListing = snapshot.listings.find(l => !postedIds.includes(l.id));
	
	if (!newListing) {
		console.log('[SocialPoster] Няма нови обяви за публикуване.');
		return;
	}

	console.log(`[SocialPoster] Намерена нова обява: ${newListing.title}`);

	const upstream = resolveTextChatUpstream();
	if (!upstream) {
		console.error('[SocialPoster] LLM не е конфигуриран!');
		return;
	}

	const crop = listingCrop(newListing);
	const priceLine =
		newListing.price?.trim() ?
			`${newListing.price.trim()}${newListing.priceUnit ? ` ${newListing.priceUnit}` : ''}`
		:	'По договаряне';

	const prompt = `Ти си маркетинг агент за B2B агро платформата Fieldlot.
Трябва да напишеш много кратък, грабващ и професионален пост за Telegram канал, представящ следната нова обява:

Заглавие: ${newListing.title}
Категория: ${newListing.category}${crop ? ` (${crop})` : ''}
Роля: ${newListing.role === 'sell' ? 'Продава' : 'Купува'}
Цена: ${priceLine}
Локация: ${newListing.region}

Правила:
- Ползвай няколко подходящи емоджита (напр. 🌾, 🚜, 💰).
- Текстът трябва да е на български, стегнат и директен (макс 3-4 изречения).
- ЗАДЪЛЖИТЕЛНО завърши поста с този линк: https://fieldlot.com/catalog.html
- Не пиши "Ето поста:" или подобни въведения, върни само самия пост.`;

	try {
		console.log('[SocialPoster] Генериране на текст с LLM...');
		const { message } = await callChatCompletions(upstream, [{ role: 'user', content: prompt }], { tools: false, maxTokens: 300 });
		const postText = openAIMessageContentToString(message.content);
		
		if (!postText) {
			console.error('[SocialPoster] LLM върна празен текст.');
			return;
		}

		console.log('[SocialPoster] Опит за публикуване в Telegram...');
		const success = await sendTelegramMessage(postText);

		if (success) {
			postedIds.push(newListing.id);
			fs.writeFileSync(postedListingsPath, JSON.stringify(postedIds, null, 2));
			console.log(`[SocialPoster] Успешно публикувано и запазено! ID: ${newListing.id}`);
		}
	} catch (e) {
		console.error('[SocialPoster] Грешка по време на процеса:', e);
	}
}

main();
