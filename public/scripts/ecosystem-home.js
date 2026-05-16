/**
 * Fieldlot home — search, listings, exchange, photography.
 */
(function initEcosystemHome() {
	const IMG = window.FieldlotImages;

	const searchForm = document.getElementById('header-search');
	if (searchForm) {
		searchForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const q = new FormData(searchForm).get('q');
			const params = new URLSearchParams();
			if (q && String(q).trim()) params.set('q', String(q).trim());
			const url = '/catalog.html' + (params.toString() ? '?' + params.toString() : '');
			window.location.href = url;
		});
	}

	function initHero() {
		if (!IMG) return;
		const bg = document.querySelector('.hero-eco-bg');
		if (bg && IMG.hero) bg.style.setProperty('--hero-bg', `url("${IMG.hero}")`);
		const gallery = document.getElementById('hero-gallery');
		if (!gallery || !IMG.heroGallery) return;
		const [main, ...side] = IMG.heroGallery;
		gallery.innerHTML = `
			<div class="hero-gallery-main">${IMG.imgTag(main, 'Свежа продукция', 'fl-photo')}</div>
			<div class="hero-gallery-side">
				<div>${IMG.imgTag(side[0] || main, 'Домати', 'fl-photo')}</div>
				<div>${IMG.imgTag(side[1] || main, 'Стопанство', 'fl-photo')}</div>
			</div>`;
	}

	function initCategories() {
		if (!IMG) return;
		const map = {
			veg: IMG.categories.veg,
			fruit: IMG.categories.fruit,
			grain: IMG.categories.grain,
			oil: IMG.categories.oil,
			canned: IMG.categories.canned,
			fertilizer: IMG.categories.fertilizer,
			machines: IMG.categories.machines,
			feed: IMG.categories.feed,
		};
		document.querySelectorAll('[data-cat]').forEach((el) => {
			const key = el.getAttribute('data-cat');
			const url = map[key];
			if (url) {
				el.classList.add('cat-card--photo');
				el.style.setProperty('--cat-img', `url("${url}")`);
			}
		});
	}

	function initFarmers() {
		if (!IMG) return;
		const avatar = document.getElementById('farmer-avatar-img');
		if (avatar) avatar.src = IMG.farmer;
		const row = document.getElementById('top-farmers');
		if (!row || !IMG.farmers) return;
		row.innerHTML = IMG.farmers
			.map(
				(f) => `
			<a class="farmer-chip" href="/catalog.html">
				<img src="${f.img}" alt="${f.name}" width="72" height="72" loading="lazy" />
				<strong>${f.name}</strong>
				<span>${f.role}</span>
				<em>★ ${f.rating}</em>
			</a>`,
			)
			.join('');
	}

	function initLogistics() {
		if (!IMG) return;
		const keys = ['transport', 'warehouse', 'tracking'];
		document.querySelectorAll('[data-log]').forEach((card) => {
			const k = card.getAttribute('data-log');
			const src = IMG.logistics[k];
			if (!src) return;
			const slot = card.querySelector('.log-card-img');
			if (slot) slot.innerHTML = IMG.imgTag(src, card.querySelector('h3')?.textContent || '', 'fl-photo');
		});
	}

	const EXCHANGE = [
		{ name: 'Пшеница', price: 410, unit: 'лв/тон', chg: 3.0 },
		{ name: 'Слънчоглед', price: 920, unit: 'лв/тон', chg: -1.2 },
		{ name: 'Царевица', price: 380, unit: 'лв/тон', chg: 1.1 },
		{ name: 'Рапица', price: 510, unit: 'лв/тон', chg: -0.5 },
	];

	function fmtChg(n) {
		const sign = n >= 0 ? '+' : '−';
		return sign + Math.abs(n).toFixed(1) + '%';
	}

	function renderExchange(rows) {
		const tbody = document.querySelector('#exchange-table tbody');
		if (!tbody) return;
		tbody.innerHTML = rows
			.map((r) => {
				const cls = r.chg >= 0 ? 'chg-up' : 'chg-down';
				return `<tr>
					<td class="product-name">${r.name}</td>
					<td>${r.price} ${r.unit}</td>
					<td class="${cls}">${fmtChg(r.chg)}</td>
				</tr>`;
			})
			.join('');
	}

	function tickExchange() {
		const jitter = () => (Math.random() - 0.5) * 0.4;
		const next = EXCHANGE.map((r) => ({
			...r,
			price: Math.round(r.price * (1 + jitter() * 0.01)),
			chg: +(r.chg + jitter()).toFixed(1),
		}));
		renderExchange(next);
		const el = document.getElementById('exchange-updated');
		if (el) {
			const now = new Date();
			el.textContent =
				'обновено ' +
				now.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
		}
	}

	renderExchange(EXCHANGE);
	setInterval(tickExchange, 45000);

	function cardHtml(item) {
		const src = IMG ? IMG.forListing(item) : '';
		const roleLabel = item.role === 'buy' ? 'Търсене' : 'Продажба';
		const price =
			item.price && item.price !== 'по дог.' && item.price !== 'заявка'
				? `${item.price} <small>${item.priceUnit || ''}</small>`
				: `${item.price || '—'} <small>${item.priceUnit || ''}</small>`;
		const cta = item.role === 'buy' ? 'Направи оферта' : 'Купи';
		const photo = src
			? `<img src="${src}" alt="${item.title}" loading="lazy" /><span class="product-card-badge">${roleLabel}</span>`
			: `<span class="product-card-badge">${roleLabel}</span>`;
		return `<article class="product-card">
			<div class="product-card-img">${photo}</div>
			<div class="product-card-body">
				<h3>${item.title}</h3>
				<p class="product-meta">${item.subtitle || ''}</p>
				<div class="product-meta-row">
					<span>🚛 ${item.qty || '—'}</span>
					<span class="product-rating">⭐ 4.${7 + (item.id.length % 3)}</span>
				</div>
				<div class="product-price">${price}</div>
				<p class="product-seller">${item.contact || ''}</p>
			</div>
			<div class="product-card-actions">
				<a class="btn btn-secondary" href="/catalog.html?id=${encodeURIComponent(item.id)}">Свържи се</a>
				<a class="btn btn-primary" href="/catalog.html?id=${encodeURIComponent(item.id)}">${cta}</a>
			</div>
		</article>`;
	}

	async function loadListings() {
		const grid = document.getElementById('home-listings');
		if (!grid) return;
		try {
			const res = await fetch('/data/demo-listings.json');
			if (!res.ok) throw new Error('fetch');
			const data = await res.json();
			const slice = Array.isArray(data) ? data.slice(0, 4) : [];
			grid.innerHTML = slice.map(cardHtml).join('');
			window.__fieldlotVisibleIds = slice.map((x) => x.id);
		} catch {
			grid.innerHTML =
				'<p class="demo-strip">Каталогът се зарежда от <a href="/catalog.html">демо страницата</a>.</p>';
		}
	}

	initHero();
	initCategories();
	initFarmers();
	initLogistics();
	loadListings();
})();
