const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function clip(value: unknown, max: number): string {
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

async function sendResend(opts: {
	from: string;
	to: string[];
	subject: string;
	html: string;
	replyTo?: string;
	key: string;
}): Promise<boolean> {
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${opts.key}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: opts.from,
			to: opts.to,
			subject: opts.subject,
			html: opts.html,
			reply_to: opts.replyTo ? [opts.replyTo] : undefined,
		}),
	});
	return res.ok;
}

export async function handleNotifyInquiryPost(raw: Record<string, unknown>): Promise<{
	ok: boolean;
	status: number;
	mailDelivery?: 'sent' | 'skipped' | 'failed';
	sellerNotified?: boolean;
	error?: string;
}> {
	const listingTitle = clip(raw.listingTitle, 200);
	const listingId = clip(raw.listingId, 80);
	const listingOwnerId = clip(raw.listingOwnerId, 80);
	const buyerName = clip(raw.buyerName, 100);
	const message = clip(raw.message, 1500);
	const requestQty = clip(raw.requestQty, 40);
	const requestPrice = clip(raw.requestPrice, 40);
	if (!listingTitle || buyerName.length < 1 || message.length < 10) {
		return { ok: false, status: 400, error: 'Непълно запитване' };
	}

	const toInbox = inboxTo();
	const from = fromAddress();
	const key = process.env.RESEND_API_KEY?.trim();
	if (!toInbox || !from || !key) {
		return { ok: true, status: 200, mailDelivery: 'skipped', sellerNotified: false };
	}

	const replyTo = typeof raw.buyerEmail === 'string' && EMAIL_RE.test(raw.buyerEmail.trim())
		? raw.buyerEmail.trim()
		: undefined;

	const { lookupMailbox } = await import('./mailbox-store.js');
	const sellerEmail = listingOwnerId ? await lookupMailbox(listingOwnerId) : null;

	const html = `
		<h2>Fieldlot — ново запитване</h2>
		<p><strong>Обява:</strong> ${escapeHtml(listingTitle)} (${escapeHtml(listingId || '-')})</p>
		<p><strong>От:</strong> ${escapeHtml(buyerName)}</p>
		<p><strong>Кол.:</strong> ${escapeHtml(requestQty || '-')}</p>
		<p><strong>Цена:</strong> ${escapeHtml(requestPrice || '-')}</p>
		<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
		<p><a href="https://fieldlot-two.vercel.app/dashboard.html">Отвори таблото Fieldlot</a></p>
	`;

	try {
		const inboxOk = await sendResend({
			from,
			to: [toInbox],
			subject: `Запитване: ${listingTitle}`,
			html,
			replyTo,
			key,
		});
		let sellerNotified = false;
		if (sellerEmail && sellerEmail !== toInbox.trim().toLowerCase()) {
			sellerNotified = await sendResend({
				from,
				to: [sellerEmail],
				subject: `Fieldlot: запитване за „${listingTitle}“`,
				html,
				replyTo,
				key,
			});
		} else if (sellerEmail && sellerEmail === toInbox.toLowerCase()) {
			sellerNotified = inboxOk;
		}
		if (!inboxOk) return { ok: true, status: 200, mailDelivery: 'failed', sellerNotified };
		return { ok: true, status: 200, mailDelivery: 'sent', sellerNotified };
	} catch {
		return { ok: true, status: 200, mailDelivery: 'failed', sellerNotified: false };
	}
}
