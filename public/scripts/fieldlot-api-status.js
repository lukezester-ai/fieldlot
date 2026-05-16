/**
 * Проверка дали Node API (/api/*) е достъпен (локално / Vercel).
 * В Lovable preview статичният сайт няма backend — chat и форма са offline.
 */
(function initFieldlotApiStatus(global) {
	const state = { chat: false, leads: false, checked: false };

	function injectPreviewBanner() {
		if (document.getElementById('fieldlot-preview-banner')) return;
		const bar = document.createElement('div');
		bar.id = 'fieldlot-preview-banner';
		bar.className = 'fieldlot-preview-banner';
		bar.setAttribute('role', 'status');
		bar.innerHTML =
			'<strong>Преглед без backend</strong> · Каталогът работи на <a href="/catalog.html">/catalog.html</a>. ' +
			'Формата и AI чатът са <em>offline</em>, докато не вдигнем API (Vercel / локално).';
		document.body.prepend(bar);
	}

	function removePreviewBanner() {
		document.getElementById('fieldlot-preview-banner')?.remove();
	}

	async function probe() {
		try {
			const res = await fetch('/api/fieldlot-chat', {
				method: 'GET',
				headers: { Accept: 'application/json' },
			});
			const ok = res.ok;
			state.chat = ok;
			state.leads = ok;
		} catch {
			state.chat = false;
			state.leads = false;
		}
		state.checked = true;
		global.__fieldlotApi = { ...state };
		if (!state.chat) injectPreviewBanner();
		else removePreviewBanner();
		document.dispatchEvent(new CustomEvent('fieldlot-api-status', { detail: { ...state } }));
		return { ...state };
	}

	global.FieldlotApiStatus = {
		probe,
		get: () => ({ ...state }),
		isOnline: () => state.chat && state.leads,
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => probe());
	} else {
		probe();
	}
})(window);
