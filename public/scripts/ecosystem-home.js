/**
 * Fieldlot home — search, listings, exchange, photography.
 */
(function initEcosystemHome() {
	const IMG = window.FieldlotImages;
	const t = (k, fb) => (window.FieldlotI18n ? FieldlotI18n.t(k, fb) : fb || k);
	const loc = () => (window.FieldlotI18n ? FieldlotI18n.localeTag() : 'bg-BG');
	const localize = (item) => (window.FieldlotI18n ? FieldlotI18n.localizeListing(item) : item);

	const searchForm = document.getElementById('header-search');
	if (searchForm) {
		searchForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const q = new FormData(searchForm).get('q');
			const params = new URLSearchParams();
			if (q && String(q).trim()) params.set('q', String(q).trim());
			if (window.FieldlotI18n?.getLang() === 'en') params.set('lang', 'en');
			const url = '/catalog.html' + (params.toString() ? '?' + params.toString() : '');
			window.location.href = url;
		});
	}

	function initHero() {
		if (!IMG) return;
		const bg = document.querySelector('.hero-eco-bg');
		if (bg && IMG.hero) {
			bg.style.setProperty('--hero-bg', `url("${IMG.hero}")`);
			bg.style.backgroundImage = `linear-gradient(105deg, rgba(15, 51, 38, 0.52) 0%, rgba(26, 77, 58, 0.38) 45%, rgba(15, 26, 20, 0.35) 100%), url("${IMG.hero}")`;
		}
		const gallery = document.getElementById('hero-gallery');
		const g = IMG.heroGallery;
		if (!gallery || !g?.tomatoes) return;
		const altTom = FieldlotI18n?.getLang() === 'en' ? 'Tomatoes' : 'Домати';
		const altPep = FieldlotI18n?.getLang() === 'en' ? 'Peppers' : 'Чушки сурови';
		const altCuc = FieldlotI18n?.getLang() === 'en' ? 'Cucumbers' : 'Краставици';
		gallery.innerHTML = `
			<div class="hero-gallery-main hero-gallery-slot--tomatoes">${IMG.imgTag(g.tomatoes, altTom, 'fl-photo')}</div>
			<div class="hero-gallery-side">
				<div class="hero-gallery-slot hero-gallery-slot--peppers">${IMG.imgTag(g.peppers, altPep, 'fl-photo')}</div>
				<div class="hero-gallery-slot hero-gallery-slot--cucumbers">${IMG.imgTag(g.cucumbers, altCuc, 'fl-photo')}</div>
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
		if (avatar) {
			avatar.src = IMG.farmer;
			avatar.alt = t('listing.farmerAlt');
		}
		const row = document.getElementById('top-farmers');
		if (!row || !IMG.farmers) return;
		row.innerHTML = IMG.farmers
			.map(
				(f) => `
			<a class="farmer-chip" href="${window.FieldlotI18n ? FieldlotI18n.withLangUrl('/catalog.html') : '/catalog.html'}">
				<img src="${f.img}" alt="${f.name}" width="72" height="72" loading="lazy" referrerpolicy="no-referrer" />
				<strong>${f.name}</strong>
				<span>${f.role}</span>
				<em>★ ${f.rating}</em>
			</a>`,
			)
			.join('');
	}

	function initLogistics() {
		if (!IMG?.logistics) return;
		document.querySelectorAll('[data-log]').forEach((card) => {
			const k = card.getAttribute('data-log');
			const src = IMG.logistics[k];
			if (!src) return;
			const slot = card.querySelector('.log-card-img');
			const title = card.querySelector('h3')?.textContent || k;
			if (!slot) return;
			slot.innerHTML = IMG.imgTag(src, title, 'fl-photo');
			const img = slot.querySelector('img');
			if (img) {
				img.addEventListener('error', () => {
					slot.style.backgroundImage = `url("${src}")`;
				});
			}
		});
	}

	function fmtChg(n) {
		const sign = n >= 0 ? '+' : '−';
		return sign + Math.abs(n).toFixed(1) + '%';
	}

	function renderExchange(rows, meta) {
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
		const bar = document.querySelector('.exchange-live-bar strong');
		if (bar && meta?.source) {
			bar.innerHTML =
				'<span class="live-dot" aria-hidden="true"></span> LIVE · ' +
				meta.source.replace(' · MATIF/EUR', '');
		}
		const el = document.getElementById('exchange-updated');
		if (el && meta?.fetchedAt) {
			const d = new Date(meta.fetchedAt);
			el.textContent =
				t('exchange.updated') +
				' ' +
				d.toLocaleString(loc(), {
					day: '2-digit',
					month: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
				});
		}
	}

	async function loadExchange() {
		const tbody = document.querySelector('#exchange-table tbody');
		if (!tbody) return;
		try {
			const res = await fetch('/api/exchange-prices');
			const data = await res.json();
			if (!res.ok || !data.ok || !Array.isArray(data.quotes)) throw new Error(data.error || 'no data');
			const rows = data.quotes.map((q) => ({
				name: q.name,
				price: q.priceBgn,
				unit: q.unit || (FieldlotI18n?.getLang() === 'en' ? 'BGN/ton' : 'лв/тон'),
				chg: q.chg ?? 0,
			}));
			renderExchange(rows, { source: data.source, fetchedAt: data.fetchedAt });
		} catch {
			tbody.innerHTML = `<tr><td colspan="3">${t('exchange.fail')}</td></tr>`;
		}
	}

	function cardHtml(item) {
		const row = localize(item);
		const src = IMG ? IMG.forListing(row) : '';
		const roleLabel = row.role === 'buy' ? t('listing.buy') : t('listing.sell');
		const price =
			row.price && row.price !== 'по дог.' && row.price !== 'заявка' && row.price !== 'по дог.' 
				? `${row.price} <small>${row.priceUnit || ''}</small>`
				: `${row.price || '—'} <small>${row.priceUnit || ''}</small>`;
		const cta = row.role === 'buy' ? t('listing.offer') : t('listing.buyBtn');
		const photo = src
			? `<img src="${src}" alt="${row.title}" loading="lazy" referrerpolicy="no-referrer" /><span class="product-card-badge">${roleLabel}</span>`
			: `<span class="product-card-badge">${roleLabel}</span>`;
		const catUrl =
			(window.FieldlotI18n ? FieldlotI18n.withLangUrl('/catalog.html') : '/catalog.html') +
			`?id=${encodeURIComponent(row.id)}`;
		return `<article class="product-card">
			<div class="product-card-img">${photo}</div>
			<div class="product-card-body">
				<h3>${row.title}</h3>
				<p class="product-meta">${row.subtitle || ''}</p>
				<div class="product-meta-row">
					<span>🚛 ${row.qty || '—'}</span>
					<span class="product-rating">⭐ 4.${7 + (row.id.length % 3)}</span>
				</div>
				<div class="product-price">${price}</div>
				<p class="product-seller">${row.contact || ''}</p>
			</div>
			<div class="product-card-actions">
				<a class="btn btn-secondary" href="${catUrl}">${t('listing.connect')}</a>
				<a class="btn btn-primary" href="${catUrl}">${cta}</a>
			</div>
		</article>`;
	}

	async function loadListings() {
		const grid = document.getElementById('home-listings');
		if (!grid) return;
		try {
			const res = await fetch('/data/live-listings.json');
			if (!res.ok) throw new Error('fetch');
			const data = await res.json();
			const all = Array.isArray(data) ? data : data.listings || [];
			const borsa = all.filter((item) => item.source === 'borsaagro.com');
			const sorted = [...borsa].sort((a, b) => {
				const ta = Date.parse(a.publishedAt || '') || 0;
				const tb = Date.parse(b.publishedAt || '') || 0;
				return tb - ta;
			});
			const slice = (sorted.length ? sorted : all).slice(0, 4);
			grid.innerHTML = slice.map((item) => cardHtml(item)).join('');
			window.__fieldlotVisibleIds = slice.map((x) => x.id);
		} catch {
			grid.innerHTML = `<p class="demo-strip">${t('listing.loadFail')}</p>`;
		}
	}

	function refreshDynamic() {
		initHero();
		initFarmers();
		loadExchange();
		loadListings();
	}

	initHero();
	initCategories();
	initFarmers();
	initLogistics();
	loadExchange();
	loadListings();
	setInterval(loadExchange, 24 * 60 * 60 * 1000);

	document.addEventListener('fieldlot-lang-change', refreshDynamic);
})();
