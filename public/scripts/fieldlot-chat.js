/**
 * Fieldlot Guide — клиент с RAG контекст (page, филтри, обява).
 */
(function initFieldlotChat(global) {
	const t = (k, fb) => (global.FieldlotI18n ? FieldlotI18n.t(k, fb) : fb || k);

	function defaultPage() {
		if (global.location.pathname.includes('catalog')) return 'catalog';
		return 'landing';
	}

	/**
	 * @param {{ page?: string, getContext?: () => Record<string, unknown>, welcome?: string, openTriggers?: string[] }} opts
	 */
	function mount(opts) {
		const fab = document.getElementById('llm-fab');
		const panel = document.getElementById('llm-panel');
		const closeBtn = document.getElementById('llm-close');
		const msgs = document.getElementById('llm-msgs');
		const input = document.getElementById('llm-input');
		const sendBtn = document.getElementById('llm-send');
		const statusEl = document.getElementById('llm-status');
		if (!fab || !panel || !msgs || !input || !sendBtn || !statusEl) return;

		const messages = [];
		const page = opts.page || defaultPage();
		let apiOnline = false;
		let welcomeShown = false;

		function buildContext() {
			const base = {
				page,
				lang: global.FieldlotI18n?.getLang?.() || 'bg',
			};
			if (typeof opts.getContext === 'function') {
				try {
					return { ...base, ...opts.getContext() };
				} catch {
					return base;
				}
			}
			return base;
		}

		function setOpen(next) {
			panel.classList.toggle('open', next);
			fab.setAttribute('aria-expanded', String(next));
			if (next) setTimeout(() => input.focus(), 80);
		}

		function addMsg(role, content) {
			const node = document.createElement('div');
			node.className = `msg ${role}`;
			node.textContent = content;
			msgs.appendChild(node);
			msgs.scrollTop = msgs.scrollHeight;
		}

		function applyOfflineUi() {
			apiOnline = false;
			statusEl.textContent = 'offline';
			statusEl.classList.add('is-offline');
			panel.classList.add('llm-panel--offline');
			input.disabled = true;
			sendBtn.disabled = true;
			input.placeholder = t('chat.offlinePh');
		}

		function applyOnlineUi(data) {
			apiOnline = true;
			statusEl.classList.remove('is-offline');
			panel.classList.remove('llm-panel--offline');
			input.disabled = false;
			sendBtn.disabled = false;
			input.placeholder = t('chat.placeholder');
			const en = global.FieldlotI18n?.getLang?.() === 'en';
			if (data?.agentEnabled) {
				statusEl.textContent = en ? 'Agent · actions on' : 'Агент · действия';
			} else if (data?.ragEnabled) {
				statusEl.textContent = data.llmConfigured
					? `RAG · ${data.listingCount ?? 0} ${en ? 'listings' : 'обяви'}`
					: en ? 'RAG · no LLM' : 'RAG · без LLM';
			} else {
				statusEl.textContent = data?.llmConfigured ? (en ? 'online' : 'онлайн') : en ? 'no LLM' : 'без LLM';
			}
		}

		function formatActions(actions) {
			if (!Array.isArray(actions) || !actions.length) return '';
			const en = global.FieldlotI18n?.getLang?.() === 'en';
			const head = en ? 'Actions taken:' : 'Изпълнени действия:';
			const lines = actions.map((a) => {
				const mark = a.ok ? '✓' : '✗';
				return `${mark} ${a.summary || a.tool}`;
			});
			return `${head}\n${lines.join('\n')}`;
		}

		async function checkStatus() {
			try {
				const res = await fetch('/api/fieldlot-chat');
				if (!res.ok) throw new Error('bad status');
				const data = await res.json();
				applyOnlineUi(data);
			} catch {
				applyOfflineUi();
			}
		}

		document.addEventListener('fieldlot-api-status', (e) => {
			const d = e.detail;
			if (d?.chat) checkStatus();
			else applyOfflineUi();
		});

		document.addEventListener('fieldlot-lang-change', () => {
			if (apiOnline) checkStatus();
			else applyOfflineUi();
			if (global.FieldlotI18n) global.FieldlotI18n.applyI18n(panel);
		});

		async function send() {
			if (!apiOnline) {
				addMsg('assistant', t('chat.offlineReply'));
				return;
			}
			const text = input.value.trim();
			if (!text) return;
			input.value = '';
			messages.push({ role: 'user', content: text });
			addMsg('user', text);
			sendBtn.disabled = true;
			addMsg('assistant', t('chat.thinking'));
			const waiting = msgs.lastElementChild;
			try {
				const res = await fetch('/api/fieldlot-chat', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						messages,
						context: buildContext(),
					}),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok || !data.reply) throw new Error(data.error || t('chat.noReply'));
				const actionBlock = formatActions(data.actions);
				const fullReply = actionBlock ? `${data.reply}\n\n${actionBlock}` : data.reply;
				messages.push({ role: 'assistant', content: fullReply });
				waiting.replaceChildren();
				waiting.appendChild(document.createTextNode(data.reply));
				if (data.semanticHits?.length) {
					const en = global.FieldlotI18n?.getLang?.() === 'en';
					const box = document.createElement('div');
					box.style.marginTop = '8px';
					box.style.fontSize = '0.82rem';
					box.style.color = '#9bb0a3';
					box.textContent = en ? 'Doc Discovery:' : 'Doc Discovery:';
					waiting.appendChild(box);
					for (const h of data.semanticHits.slice(0, 5)) {
						const a = document.createElement('a');
						a.href = h.url || '#';
						a.target = '_blank';
						a.rel = 'noopener noreferrer';
						a.style.display = 'block';
						a.style.color = '#7ccd9c';
						a.style.marginTop = '4px';
						a.textContent = `${h.title} (${Math.round((h.similarity || 0) * 100)}%)`;
						waiting.appendChild(a);
					}
				}
				if (actionBlock) {
					const ab = document.createElement('div');
					ab.style.marginTop = '8px';
					ab.style.fontSize = '0.85rem';
					ab.textContent = actionBlock;
					waiting.appendChild(ab);
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : t('chat.busy');
				waiting.textContent =
					msg === 'Failed to fetch' || msg.includes('NetworkError') ? t('chat.network') : msg;
			} finally {
				sendBtn.disabled = false;
			}
		}

		fab.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
		if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));
		sendBtn.addEventListener('click', send);
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				send();
			}
		});

		for (const id of opts.openTriggers || []) {
			const el = document.getElementById(id);
			if (el) el.addEventListener('click', () => setOpen(true));
		}

		function showWelcome() {
			if (welcomeShown) return;
			welcomeShown = true;
			addMsg('assistant', opts.welcome || t('chat.welcome'));
		}

		showWelcome();
		checkStatus();
	}

	global.FieldlotChat = { mount };
})(window);
