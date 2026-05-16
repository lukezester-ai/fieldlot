/**
 * Fieldlot Guide — клиент с RAG контекст (page, филтри, обява).
 */
(function initFieldlotChat(global) {
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

		function buildContext() {
			const base = { page };
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

		async function checkStatus() {
			try {
				const res = await fetch('/api/fieldlot-chat');
				const data = await res.json();
				if (data.ragEnabled) {
					statusEl.textContent = data.llmConfigured
						? `RAG · ${data.listingCount ?? 0} обяви`
						: 'RAG · без LLM';
				} else {
					statusEl.textContent = data.llmConfigured ? 'онлайн' : 'без LLM';
				}
			} catch {
				statusEl.textContent = 'офлайн';
			}
		}

		async function send() {
			const text = input.value.trim();
			if (!text) return;
			input.value = '';
			messages.push({ role: 'user', content: text });
			addMsg('user', text);
			sendBtn.disabled = true;
			addMsg('assistant', 'Мисля...');
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
				if (!res.ok || !data.reply) throw new Error(data.error || 'Няма отговор.');
				messages.push({ role: 'assistant', content: data.reply });
				waiting.textContent = data.reply;
			} catch (err) {
				waiting.textContent =
					err instanceof Error ? err.message : 'Чатът временно не отговаря.';
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

		addMsg(
			'assistant',
			opts.welcome ||
				'Здравей. Аз съм Fieldlot Guide с RAG — виждам демо каталога и мога да те насоча из целия сайт. Питай за оферти, филтри или ранен достъп.',
		);
		checkStatus();
	}

	global.FieldlotChat = { mount };
})(window);
