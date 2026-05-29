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

		const gal = document.getElementById('hero-gallery');
		if (gal) {
			const d = new Date();
			const dateStr = d.toLocaleDateString(loc(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
			const marketStatus = t('hero.marketOpen', 'Пазарът е отворен');
			const b2bStatus = t('hero.b2bLive', 'B2B Търговия на живо');
			
			const calendarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;
			const globeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
			const chartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;

			gal.innerHTML = `
				<div class="hero-glass-card" style="animation-delay: 0s;">
					<div class="hero-glass-icon" aria-hidden="true">${calendarSvg}</div>
					<div class="hero-glass-text">
						<span class="hero-glass-title">${escapeHtml(t('hero.date', 'Днешна дата'))}</span>
						<span class="hero-glass-value">${escapeHtml(dateStr)}</span>
					</div>
				</div>
				<div class="hero-glass-card" style="animation-delay: 0.15s;">
					<div class="hero-glass-icon" aria-hidden="true">${globeSvg}</div>
					<div class="hero-glass-text">
						<span class="hero-glass-title">${escapeHtml(t('hero.market', 'Европейски пазар'))}</span>
						<span class="hero-glass-value">${escapeHtml(marketStatus)}</span>
					</div>
				</div>
				<div class="hero-glass-card" style="animation-delay: 0.3s;">
					<div class="hero-glass-icon" aria-hidden="true">${chartSvg}</div>
					<div class="hero-glass-text">
						<span class="hero-glass-title">${escapeHtml(t('hero.trade', 'Борса & Обяви'))}</span>
						<span class="hero-glass-value">${escapeHtml(b2bStatus)}</span>
					</div>
				</div>
			`;
			gal.removeAttribute('aria-hidden');
		}
	}

	const CAT_ICONS = {
		veg: '\u{1F345}',
		fruit: '\u{1F34E}',
		grain: '\u{1F33E}',
		oil: '\u{1F6E2}\uFE0F',
		canned: '\u{1F96B}',
		fertilizer: '\u{1F9EA}',
		machines: '\u{1F69C}',
		feed: '\u{1F33F}',
	};

	function initCategoryIcons() {
		document.querySelectorAll('.category-card[data-cat] .category-icon').forEach((icon) => {
			const card = icon.closest('[data-cat]');
			const key = card?.getAttribute('data-cat');
			if (key && CAT_ICONS[key]) icon.textContent = CAT_ICONS[key];
		});
	}

	function initCategories() {
		initCategoryIcons();
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
		const showcase = IMG.farmerShowcase;
		if (showcase?.length) {
			const byId = Object.fromEntries(showcase.map((s) => [s.id, s]));
			document.querySelectorAll('[data-farm-img]').forEach((slot) => {
				const key = slot.getAttribute('data-farm-img');
				const item = key ? byId[key] : null;
				if (!item?.img) return;
				const alt = item.alt || t('farmers.slotFarm');
				slot.innerHTML = IMG.imgTag(item.img, alt, 'fl-photo');
				const img = slot.querySelector('img');
				if (img) {
					img.addEventListener('error', () => {
						slot.style.backgroundImage = `url("${item.img}")`;
					});
				}
			});
		}
		const ctaBase = window.FieldlotI18n?.withLangUrl?.('#cta') || '#cta';
		document.querySelectorAll('.farm-showcase-card[href="#cta"]').forEach((a) => {
			a.setAttribute('href', ctaBase);
		});
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
			slot.style.backgroundImage = `url("${src}")`;
			slot.style.backgroundSize = 'cover';
			slot.style.backgroundPosition = 'center';
			slot.setAttribute('aria-label', title);
			slot.innerHTML = '';
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

	async function loadHeaderTicker() {
		const ticker = document.getElementById('market-ticker');
		const track = document.getElementById('market-ticker-track');
		if (!ticker || !track) return;
		let quotes = [];
		try {
			const res = await fetch('/api/exchange-prices');
			const data = await res.json();
			if (res.ok && data.ok && Array.isArray(data.quotes)) quotes = data.quotes;
		} catch {
			/* fallback */
		}
		if (!quotes.length) {
			try {
				const res2 = await fetch('/data/exchange-prices.json');
				const data2 = await res2.json();
				if (Array.isArray(data2.quotes)) quotes = data2.quotes;
			} catch {
				return;
			}
		}
		const en = FieldlotI18n?.getLang() === 'en';
		const items = quotes.map((q) => {
			const chg = q.chg ?? 0;
			const sign = chg >= 0 ? '+' : '−';
			const chgTxt = `${sign}${Math.abs(chg).toFixed(1)}%`;
			const label = window.FieldlotI18n ? window.FieldlotI18n.t('exchange.quote.' + q.id, q.name) : q.name;
			const unit = window.FieldlotI18n?.getLang() === 'bg' ? 'лв/тон' : (window.FieldlotI18n?.getLang() === 'de' ? 'BGN/Tonne' : 'BGN/ton');
			return `<span>${label} ${q.priceBgn} ${unit} · ${chgTxt}</span>`;
		});
		if (!items.length) return;
		track.innerHTML = items.join('') + items.join('');
		ticker.hidden = false;
	}

	async function loadExchange() {
		const tbody = document.querySelector('#exchange-table tbody');
		if (!tbody) return;
		try {
			const res = await fetch('/api/exchange-prices');
			const data = await res.json();
			if (!res.ok || !data.ok || !Array.isArray(data.quotes)) throw new Error(data.error || 'no data');
			const rows = data.quotes.map((q) => ({
				name: window.FieldlotI18n ? window.FieldlotI18n.t('exchange.quote.' + q.id, q.name) : q.name,
				price: q.priceBgn,
				unit: window.FieldlotI18n?.getLang() === 'bg' ? 'лв/тон' : (window.FieldlotI18n?.getLang() === 'de' ? 'BGN/Tonne' : 'BGN/ton'),
				chg: q.chg ?? 0,
			}));
			renderExchange(rows, { source: data.source, fetchedAt: data.fetchedAt });
		} catch {
			tbody.innerHTML = `<tr><td colspan="3">${t('exchange.fail')}</td></tr>`;
		}
	}

	const CAT_LABELS = {
		veg: 'Зеленчуци',
		fruit: 'Плодове',
		grain: 'Зърно',
		oil: 'Маслодайни',
		feed: 'Фураж',
		canned: 'Консерви',
		fertilizer: 'Торове',
		machines: 'Машини',
	};

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function categoryLabel(item) {
		const FC = window.FieldlotCategories;
		const id = FC?.normCat ? FC.normCat(item.category) : item.category;
		return CAT_LABELS[id] || id || '';
	}

	function cardHtml(item) {
		const row = localize(item);
		const roleClass = row.role === 'buy' ? 'buy' : 'sell';
		const roleLabel = row.role === 'buy' ? t('listing.buy') : t('listing.sell');
		const cat = categoryLabel(row);
		const price =
			row.price && row.price !== 'по дог.' && row.price !== 'заявка'
				? `${escapeHtml(row.price)} <small>${escapeHtml(row.priceUnit || '')}</small>`
				: `${escapeHtml(row.price || '—')} <small>${escapeHtml(row.priceUnit || '')}</small>`;
		const cta = row.role === 'buy' ? t('listing.offer') : t('listing.buyBtn');
		const catUrl =
			(window.FieldlotI18n ? FieldlotI18n.withLangUrl('/catalog.html') : '/catalog.html') +
			`?id=${encodeURIComponent(row.id)}`;
		const contact = row.contact
			? `<p class="yp-entry-line yp-entry-contact">${escapeHtml(row.contact)}</p>`
			: '';
		const tagsArray = (row.tags || []).filter(t => t.toLowerCase() !== (cat || '').toLowerCase());
		const tags = tagsArray
			.slice(0, 2)
			.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
			.join('');
		return `<article class="listing-card" data-id="${row.id}">
			<div class="badge">${escapeHtml(cat || roleLabel)}</div>
			<h3 style="margin: 0; font-size: 1.1rem;">${escapeHtml(row.title)}</h3>
			<p style="color: var(--neutral-600); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(row.qty || '')} · ${escapeHtml(row.incoterm || '')}</p>
			<div class="price">${price}</div>
			<div class="location">📍 ${escapeHtml(row.subtitle || 'България')}</div>
			<a class="btn-contact" href="${catUrl}" style="text-align: center; text-decoration: none; display: block;">📞 ${escapeHtml(cta)}</a>
		</article>`;
	}

	async function loadListings() {
		const grid = document.getElementById('home-listings');
		if (!grid) return;
		let staticData = [];
		try {
			const res = await fetch('/data/live-listings.json');
			if (res.ok) {
				const data = await res.json();
				staticData = Array.isArray(data) ? data : data.listings || [];
			}
		} catch {}

		let fbData = [];
		try {
			// Wait for firebase to be loaded (since it's a bundled module)
			let retries = 20;
			while (!window.fetchFirebaseListings && retries > 0) {
				await new Promise(r => setTimeout(r, 100));
				retries--;
			}
			if (window.fetchFirebaseListings) {
				fbData = await window.fetchFirebaseListings(20);
			}
		} catch (e) {
			console.error("Firebase listings fetch error:", e);
		}

		try {
			const all = [...fbData, ...staticData];
			const sorted = all.sort((a, b) => {
				const ta = Date.parse(a.publishedAt || '') || 0;
				const tb = Date.parse(b.publishedAt || '') || 0;
				return tb - ta;
			}).slice(0, 6);
			grid.innerHTML = sorted.map((item) => cardHtml(item)).join('');
			window.__fieldlotVisibleIds = sorted.map((x) => x.id);
			const statEl = document.getElementById('hero-stat-count');
			if (statEl && all.length) statEl.textContent = String(all.length);
		} catch {
			grid.innerHTML = `<p class="demo-strip">${t('listing.loadFail')}</p>`;
		}
	}

	function refreshDynamic() {
		initHero();
		initCategoryIcons();
		initCategories();
		initFarmers();
		loadHeaderTicker();
		loadExchange();
		loadListings();
	}

	initCategoryIcons();
	initHero();
	initCategories();
	initFarmers();
	initLogistics();
	loadHeaderTicker();
	loadExchange();
	loadListings();
	setInterval(loadExchange, 24 * 60 * 60 * 1000);

	document.addEventListener('fieldlot-lang-change', refreshDynamic);
})();
