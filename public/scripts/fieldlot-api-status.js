/**
 * Проверка дали Node API (/api/*) е достъпен (локално / Vercel).
 */
(function initFieldlotApiStatus(global) {
	const state = { chat: false, leads: false, checked: false };
	const t = (k) => (global.FieldlotI18n ? FieldlotI18n.t(k) : k);

	function injectPreviewBanner() {
		if (document.getElementById('fieldlot-preview-banner')) return;
		const bar = document.createElement('div');
		bar.id = 'fieldlot-preview-banner';
		bar.className = 'fieldlot-preview-banner';
		bar.setAttribute('role', 'status');
		bar.innerHTML = t('api.banner');
		document.body.prepend(bar);
	}

	function removePreviewBanner() {
		document.getElementById('fieldlot-preview-banner')?.remove();
	}

	async function probe() {
		try {
			const [chatRes, leadRes] = await Promise.all([
				fetch('/api/fieldlot-chat', { method: 'GET', headers: { Accept: 'application/json' } }),
				fetch('/api/register-interest', { method: 'OPTIONS' }),
			]);
			state.chat = chatRes.ok;
			state.leads = leadRes.status === 204 || leadRes.ok;
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

	document.addEventListener('fieldlot-lang-change', () => {
		const bar = document.getElementById('fieldlot-preview-banner');
		if (bar) bar.innerHTML = t('api.banner');
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => probe());
	} else {
		probe();
	}
})(window);
