import 'dotenv/config';
import { getListingsSnapshot } from '../server/listings-data.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM = process.env.RESEND_FROM?.trim() || 'Fieldlot <onboarding@resend.dev>';
const SUBSCRIBERS = [process.env.MAIL_TO?.trim() || 'info@agrinexus.eu'];

async function sendNewsletter(html: string) {
	if (!RESEND_API_KEY) {
		console.error('[Newsletter] Липсва RESEND_API_KEY в .env файла. Не мога да изпратя имейл.');
		return false;
	}

	console.log(`[Newsletter] Изпращане на имейл до ${SUBSCRIBERS.join(', ')}...`);
	
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${RESEND_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: RESEND_FROM,
				to: SUBSCRIBERS,
				subject: '🌿 Fieldlot Седмичен Дайджест: Нови Обяви',
				html
			}),
		});

		if (!res.ok) {
			console.error('[Newsletter] Грешка от Resend:', await res.text());
			return false;
		}
		return true;
	} catch (e) {
		console.error('[Newsletter] Мрежова грешка:', e);
		return false;
	}
}

async function main() {
	console.log('[Newsletter] Генериране на дайджест...');
	
	const snapshot = await getListingsSnapshot(false);
	
	// Вземаме последните 5 обяви (най-новите са първи в масива обикновено, но може да са разбъркани)
	// За примера просто вземаме първите 5 обяви, които имат заглавие.
	const topListings = snapshot.listings.filter(l => l.title).slice(0, 5);
	
	if (topListings.length === 0) {
		console.log('[Newsletter] Няма обяви за дайджеста.');
		return;
	}

	// Генерираме красив HTML
	let html = `
	<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
		<div style="background-color: #1a5632; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
			<h1 style="color: white; margin: 0;">🌾 Fieldlot Дайджест</h1>
		</div>
		<div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
			<p style="font-size: 16px;">Здравейте,</p>
			<p style="font-size: 16px;">Ето най-новите обяви в нашата B2B агро екосистема от тази седмица:</p>
			<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
	`;

	for (const l of topListings) {
		const typeStr = l.role === 'sell' ? 'Продава' : 'Купува';
		const priceStr =
			l.price?.trim() ?
				`<strong>${l.price.trim()}${l.priceUnit ? ` ${l.priceUnit}` : ''}</strong>`
			:	'По договаряне';
		const location = l.region || 'Не е посочено';
		
		html += `
			<div style="margin-bottom: 20px;">
				<h3 style="margin: 0 0 5px 0; color: #1a5632;">${l.title}</h3>
				<p style="margin: 0 0 5px 0; font-size: 14px;">
					<span style="background-color: #e6f4ea; color: #1a5632; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${typeStr}</span>
					&nbsp;|&nbsp; 📍 ${location}
				</p>
				<p style="margin: 0; font-size: 14px;">Цена: ${priceStr}</p>
			</div>
		`;
	}

	html += `
			<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
			<div style="text-align: center; margin-top: 20px;">
				<a href="https://fieldlot.com/catalog.html" style="background-color: #f7a01d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Виж всички обяви</a>
			</div>
			<p style="text-align: center; font-size: 12px; color: #999; margin-top: 30px;">
				© ${new Date().getFullYear()} Fieldlot Agro Ecosystem. Всички права запазени.<br>
				Това е автоматично съобщение.
			</p>
		</div>
	</div>
	`;

	const success = await sendNewsletter(html);
	if (success) {
		console.log('[Newsletter] Дайджестът е изпратен успешно!');
	}
}

main().catch(console.error);
