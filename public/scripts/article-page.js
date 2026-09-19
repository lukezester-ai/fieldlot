(function initArticlePage() {
	const root = document.getElementById('article-root');
	if (!root) return;
	const part = Number(new URLSearchParams(location.search).get('part') || '1');

	function pick(obj, lang) {
		if (obj == null) return '';
		if (typeof obj === 'string') return obj;
		return obj[lang] || obj.bg || obj.en || '';
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	fetch('/data/article-series.json', { cache: 'no-store' })
		.then((res) => (res.ok ? res.json() : Promise.reject()))
		.then((data) => {
			const items = Array.isArray(data.items) ? data.items : [];
			const item = items.find((row) => Number(row.part) === part) || items[0];
			if (!item) {
				root.innerHTML = '<p>Статията не е намерена.</p>';
				return;
			}
			const langRaw = window.FieldlotI18n?.getLang?.();
			const lang = langRaw === 'en' ? 'en' : langRaw === 'de' ? 'de' : 'bg';
			const title = pick(item.title, lang);
			const body = pick(item.body, lang) || pick(item.excerpt, lang);
			document.title = `${title} — Fieldlot`;
			const nav = items
				.map((row) => {
					const n = Number(row.part);
					const label = pick(row.title, lang) || `Част ${row.part}`;
					const href = row.href || `/article.html?part=${encodeURIComponent(String(row.part))}`;
					const current = n === Number(item.part);
					return current
						? `<span class="meta">Част ${escapeHtml(String(row.part))}</span>`
						: `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
				})
				.join(' · ');
			root.innerHTML = `
				<p class="eco-eyebrow">Част ${escapeHtml(String(item.part || part))}</p>
				<h1>${escapeHtml(title)}</h1>
				${item.date ? `<p class="meta">${escapeHtml(item.date)}</p>` : ''}
				<div class="article-body">${body
					.split(/\n\n+/)
					.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
					.join('')}</div>
				<p class="meta" style="margin-top:2rem">${nav}</p>
			`;
		})
		.catch(() => {
			root.innerHTML = '<p>Статията не може да се зареди.</p>';
		});
})();
