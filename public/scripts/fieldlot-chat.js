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
		const photoInput = document.getElementById('llm-photo');
		const photoBtn = document.getElementById('llm-photo-btn');
		if (!fab || !panel || !msgs || !input || !sendBtn || !statusEl) return;

		const messages = [];
		const page = opts.page || defaultPage();
		let apiOnline = false;
		let welcomeShown = false;
		let pendingImage = null;

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

		const headToggle = document.getElementById('llm-head-toggle');
		const llmBody = document.getElementById('llm-body');

		function setOpen(next) {
			panel.classList.toggle('open', next);
			fab.setAttribute('aria-expanded', String(next));
			headToggle?.setAttribute('aria-expanded', String(next));
			if (next) {
				llmBody?.classList.remove('collapsed');
				setTimeout(() => input.focus(), 80);
			}
		}

		function toggleBodyCollapse() {
			if (!llmBody) return;
			llmBody.classList.toggle('collapsed');
			const expanded = !llmBody.classList.contains('collapsed');
			headToggle?.setAttribute('aria-expanded', String(expanded));
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

		function readFileAsBase64(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					const dataUrl = String(reader.result || '');
					const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
					if (!m) {
						reject(new Error('bad image'));
						return;
					}
					resolve({ mimeType: m[1], base64: m[2] });
				};
				reader.onerror = () => reject(reader.error || new Error('read failed'));
				reader.readAsDataURL(file);
			});
		}

		if (photoBtn && photoInput) {
			photoBtn.addEventListener('click', () => photoInput.click());
			photoInput.addEventListener('change', async () => {
				const file = photoInput.files?.[0];
				photoInput.value = '';
				if (!file || !file.type.startsWith('image/')) return;
				if (file.size > 4_500_000) {
					addMsg('assistant', t('chat.imageTooBig'));
					return;
				}
				try {
					pendingImage = await readFileAsBase64(file);
					const en = global.FieldlotI18n?.getLang?.() === 'en';
					addMsg(
						'user',
						en ? '📷 Photo attached — send a message or press Enter.' : '📷 Снимката е готова — изпрати съобщение.',
					);
				} catch {
					addMsg('assistant', t('chat.imageErr'));
				}
			});
		}

		async function send() {
			if (!apiOnline) {
				addMsg('assistant', t('chat.offlineReply'));
				return;
			}
			const text = input.value.trim();
			if (!text && !pendingImage) return;
			const imagePayload = pendingImage;
			pendingImage = null;
			input.value = '';
			const userLine =
				text ||
				(global.FieldlotI18n?.getLang?.() === 'en'
					? 'Classify this agro product photo and find matching listings.'
					: 'Разпознай снимката и намери подходящи обяви.');
			messages.push({ role: 'user', content: userLine });
			addMsg('user', imagePayload ? `${userLine}\n📷` : userLine);
			sendBtn.disabled = true;
			addMsg('assistant', t('chat.thinking'));
			const waiting = msgs.lastElementChild;
			try {
				const body = {
					messages,
					context: buildContext(),
				};
				if (imagePayload) {
					body.image = { base64: imagePayload.base64, mimeType: imagePayload.mimeType };
				}
				const res = await fetch('/api/fieldlot-chat', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
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
				if (data.listingDraft?.formattedText) {
					appendDraftBox(waiting, data.listingDraft);
				}
				if (data.imageClassification?.ok) {
					const en = global.FieldlotI18n?.getLang?.() === 'en';
					const ic = data.imageClassification;
					const vbox = document.createElement('div');
					vbox.style.marginTop = '8px';
					vbox.style.fontSize = '0.85rem';
					vbox.style.color = '#b8d4c8';
					vbox.textContent = en
						? `📷 ${ic.category}${ic.crop ? ` · ${ic.crop}` : ''} (${Math.round((ic.confidence || 0) * 100)}%)`
						: `📷 ${ic.category}${ic.crop ? ` · ${ic.crop}` : ''} (${Math.round((ic.confidence || 0) * 100)}%)`;
					waiting.appendChild(vbox);
					if (ic.category) {
						const catUrl =
							'/catalog.html?category=' +
							encodeURIComponent(ic.category) +
							(ic.crop ? '&crop=' + encodeURIComponent(ic.crop) : '');
						const link = document.createElement('a');
						link.href = global.FieldlotI18n?.withLangUrl
							? FieldlotI18n.withLangUrl(catUrl)
							: catUrl;
						link.style.display = 'block';
						link.style.marginTop = '6px';
						link.style.color = '#7ccd9c';
						link.textContent = t('chat.viewCatalog');
						waiting.appendChild(link);
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
		if (headToggle) {
			headToggle.addEventListener('click', (e) => {
				if (e.target.closest('.llm-close')) return;
				if (!panel.classList.contains('open')) {
					setOpen(true);
					return;
				}
				toggleBodyCollapse();
			});
			headToggle.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					headToggle.click();
				}
			});
		}
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

		function bindPromptButtons(root) {
			(root || document).querySelectorAll('[data-prompt]').forEach((btn) => {
				if (btn.dataset.promptBound === '1') return;
				btn.dataset.promptBound = '1';
				btn.addEventListener('click', () => {
					const p = btn.getAttribute('data-prompt');
					if (!p) return;
					input.value = p;
					setOpen(true);
					input.focus();
					if (btn.hasAttribute('data-send-now') && apiOnline) send();
				});
			});
		}

		bindPromptButtons(document.getElementById('llm-quick'));
		bindPromptButtons(document.querySelector('.ai-suggestions'));

		function appendDraftBox(parent, draft) {
			if (!draft?.formattedText) return;
			const en = global.FieldlotI18n?.getLang?.() === 'en';
			const wrap = document.createElement('div');
			const pre = document.createElement('pre');
			pre.className = 'llm-draft-box';
			pre.textContent = draft.formattedText;
			wrap.appendChild(pre);
			if (draft.checklist?.length) {
				const note = document.createElement('p');
				note.style.fontSize = '0.75rem';
				note.style.color = '#9bb0a3';
				note.style.marginTop = '6px';
				note.textContent = (en ? 'Missing: ' : 'Допълни: ') + draft.checklist.join(', ');
				wrap.appendChild(note);
			}
			const copyBtn = document.createElement('button');
			copyBtn.type = 'button';
			copyBtn.className = 'llm-draft-copy';
			copyBtn.textContent = en ? 'Copy text' : 'Копирай текста';
			copyBtn.addEventListener('click', () => {
				navigator.clipboard?.writeText(draft.formattedText).catch(() => {});
				copyBtn.textContent = en ? 'Copied ✓' : 'Копирано ✓';
			});
			wrap.appendChild(copyBtn);
			parent.appendChild(wrap);
		}

		showWelcome();
		checkStatus();
	}

	global.FieldlotChat = { mount };
})(window);
