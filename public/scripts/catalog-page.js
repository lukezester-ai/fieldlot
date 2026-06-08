/**
 * Fieldlot catalog — live listings (yellow-pages style, no photos)
 */
(function initCatalogPage(global) {
	const I18n = () => window.FieldlotI18n;
	const t = (k, fb) => (I18n() ? I18n().t(k, fb) : fb || k);

	const grid = document.getElementById('catalog-grid');
	const countEl = document.getElementById('results-count');
	const qEl = document.getElementById('q');
	const catEl = document.getElementById('category');
	const cropEl = document.getElementById('crop');
	const regEl = document.getElementById('region');
	const roleEl = document.getElementById('role');
	const FC = () => global.FieldlotCategories;
	const backdrop = document.getElementById('detail-backdrop');
	const panel = document.getElementById('detail-panel');
	const detailTitle = document.getElementById('detail-title');
	const detailBody = document.getElementById('detail-body');
	const detailCta = document.getElementById('detail-cta');
	const detailPdfBtn = document.getElementById('detail-pdf');
	let detailItemRaw = null;
	let allListings = [];

	if (!grid || !countEl) return;

	function loc(item) {
		return I18n() ? I18n().localizeListing(item) : item;
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
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

	function categoryLabel(item) {
		const id = FC()?.normCat ? FC().normCat(item.category) : item.category;
		return CAT_LABELS[id] || id || '';
	}

	function sortListings(items) {
		return [...items].sort((a, b) => {
			const ta = Date.parse(a.publishedAt || '') || 0;
			const tb = Date.parse(b.publishedAt || '') || 0;
			return tb - ta;
		});
	}

	function stripMedia(listings) {
		return listings.map((row) => {
			const { imageUrl, image, ...rest } = row;
			return rest;
		});
	}

	async function loadListings() {
		grid.innerHTML = `<p class="meta yp-loading">${escapeHtml(t('catalog.loading'))}</p>`;
		let staticData = [];
		try {
			const res = await fetch('/api/listings');
			if (res.ok) {
				const data = await res.json();
				staticData = Array.isArray(data.listings) ? data.listings : [];
			}
		} catch {}

		let fbData = [];
		try {
			let retries = 20;
			while (!window.fetchFirebaseListings && retries > 0) {
				await new Promise(r => setTimeout(r, 100));
				retries--;
			}
			if (window.fetchFirebaseListings) {
				fbData = await window.fetchFirebaseListings(100);
			}
		} catch (e) {
			console.error("Firebase listings fetch error:", e);
		}

		allListings = sortListings(stripMedia([...fbData, ...staticData]));
	}

	function filterListings() {
		const q = qEl.value.trim().toLowerCase();
		const cat = catEl?.value || '';
		const crop = cropEl?.value || '';
		const reg = regEl?.value || '';
		const role = roleEl?.value || '';
		return allListings.filter((raw) => {
			const item = loc(raw);
			if (cat) {
				if (FC()?.matchCategory) {
					if (!FC().matchCategory(item, cat)) return false;
				} else if (item.category !== cat) return false;
			}
			if (crop) {
				if (FC()?.matchCrop) {
					if (!FC().matchCrop(item, crop)) return false;
				}
			}
			if (reg) {
				if (FC()?.matchRegion) {
					if (!FC().matchRegion(item, reg)) return false;
				} else if (item.region !== reg && item.region !== 'national') return false;
			}
			if (role && item.role !== role) return false;
			if (!q) return true;
			const hay = [item.title, item.subtitle, item.quality, item.contact, ...(item.tags || [])]
				.join(' ')
				.toLowerCase();
			return hay.includes(q);
		});
	}

	function renderCard(raw) {
		const item = loc(raw);
		const roleClass = item.role === 'buy' ? 'buy' : 'sell';
		const roleLabel = item.role === 'buy' ? t('listing.buy') : t('listing.sell');
		const cat = categoryLabel(item);
		const sourceTag = item.source
			? `<span class="tag source">${escapeHtml(item.source)}</span>`
			: '';
		const contactLine = item.contact
			? `<p class="yp-entry-line yp-entry-contact">${escapeHtml(item.contact)}</p>`
			: '';

		const article = document.createElement('article');
		article.className = 'listing-card yp-entry';
		article.tabIndex = 0;
		article.dataset.id = item.id;
		article.innerHTML = `
			<div class="yp-entry-main">
				<div class="yp-entry-head">
					<span class="tag ${roleClass}">${escapeHtml(roleLabel)}</span>
					${cat ? `<span class="tag yp-cat">${escapeHtml(cat)}</span>` : ''}
					${(item.tags || []).filter(t => t.toLowerCase() !== (cat || '').toLowerCase()).slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
				</div>
				<h2 class="yp-entry-title">${escapeHtml(item.title)}</h2>
				<p class="yp-entry-line">${window.FieldlotI18n ? window.FieldlotI18n.renderFlags(escapeHtml(item.subtitle)) : escapeHtml(item.subtitle)} · ${escapeHtml(item.qty)}</p>
				<p class="yp-entry-line yp-entry-muted">${escapeHtml(item.incoterm)}${item.quality ? ` · ${escapeHtml(item.quality)}` : ''}</p>
				${contactLine}
			</div>
			<div class="yp-entry-aside">
				<div class="price">${escapeHtml(item.price)} <small>${escapeHtml(item.priceUnit)}</small></div>
				${sourceTag}
			</div>
		`;
		article.addEventListener('click', () => openDetail(raw));
		article.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				openDetail(raw);
			}
		});
		return article;
	}

	function render() {
		const items = filterListings();
		grid.innerHTML = '';
		if (items.length === 0) {
			grid.innerHTML = `<div class="empty-state"><p>${t('catalog.empty')}</p><p>${t('catalog.emptyHint')}</p></div>`;
		} else {
			items.forEach((raw) => grid.appendChild(renderCard(raw)));
		}
		const n = items.length;
		const word = n === 1 ? t('catalog.offerOne') : t('catalog.offers');
		countEl.innerHTML = `<strong>${n}</strong> ${word}`;
	}

	function openDetail(raw) {
		detailItemRaw = raw;
		const item = loc(raw);
		detailTitle.textContent = item.title;
		const sourceLink = item.sourceUrl
			? `<p class="detail-note"><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(t('catalog.sourceLink'))}</a></p>`
			: '';
		const cat = categoryLabel(item);
		detailBody.innerHTML = `
			<div class="detail-highlight yp-detail-lead">
				${cat ? `<p class="yp-detail-cat">${escapeHtml(cat)}</p>` : ''}
				<div class="price">${escapeHtml(item.price)} <small>${escapeHtml(item.priceUnit)}</small></div>
				<p class="meta">${escapeHtml(item.qty)} · ${escapeHtml(item.incoterm)}</p>
			</div>
			<dl class="detail-dl">
				<div><dt>${escapeHtml(t('catalog.loc'))}</dt><dd>${window.FieldlotI18n ? window.FieldlotI18n.renderFlags(escapeHtml(item.subtitle)) : escapeHtml(item.subtitle)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.qty'))}</dt><dd>${escapeHtml(item.qty)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.price'))}</dt><dd>${escapeHtml(item.price)} ${escapeHtml(item.priceUnit)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.term'))}</dt><dd>${escapeHtml(item.incoterm)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.harvest'))}</dt><dd>${escapeHtml(item.harvest)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.quality'))}</dt><dd>${escapeHtml(item.quality)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.contact'))}</dt><dd>${escapeHtml(item.contact)}</dd></div>
			</dl>
			<div class="arbitrage-calc" style="margin: 20px 0; padding: 15px; background: var(--bg-sub); border-radius: 8px; border: 1px solid var(--border-color);">
				<h4 style="margin-bottom: 8px; font-size: 0.95rem;">Калкулатор за доставка (Арбитраж)</h4>
				<div style="display: flex; gap: 8px; align-items: center;">
					<input type="number" id="detail-km-input" placeholder="Разстояние до вас (км)" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-color);" min="1">
					<button type="button" class="btn btn-secondary" id="detail-calc-btn" style="padding: 8px 14px; font-size: 0.85rem;">Пресметни</button>
				</div>
				<p id="detail-calc-result" style="margin-top: 10px; font-size: 0.9rem; display: none; color: var(--text-color);"></p>
			</div>
			<p class="detail-note">${escapeHtml(t('catalog.detailNote'))}</p>
			${sourceLink}
		`;

		// Bind Calculator Logic
		const calcBtn = document.getElementById('detail-calc-btn');
		const kmInput = document.getElementById('detail-km-input');
		const calcResult = document.getElementById('detail-calc-result');
		if (calcBtn && kmInput && calcResult) {
			calcBtn.addEventListener('click', () => {
				const km = parseFloat(kmInput.value) || 0;
				if (km <= 0) return;
				const basePriceMatch = item.price.toString().match(/[\d.]+/);
				const basePrice = basePriceMatch ? parseFloat(basePriceMatch[0]) : 0;
				
				// Same formula: 2.5 BGN/km. Assume 24 tons per truck.
				// Cost per ton = (2.5 * km) / 24
				const transportPerTon = (2.5 * km) / 24;
				const deliveredPrice = basePrice + transportPerTon;

				calcResult.innerHTML = `Транспорт: <strong>~${transportPerTon.toFixed(2)} лв/тон</strong><br>Доставена цена при вас: <strong style="color:var(--primary-color); font-size: 1.1rem;">~${deliveredPrice.toFixed(2)} ${item.priceUnit}</strong>`;
				calcResult.style.display = 'block';
			});
		}

		const ctaBase = I18n() ? I18n().withLangUrl('/#cta') : '/#cta';
		detailCta.href = `${ctaBase}?listing=${encodeURIComponent(item.id)}`;
		detailCta.textContent = t('catalog.detailCta');
		backdrop.hidden = false;
		panel.setAttribute('aria-hidden', 'false');
		requestAnimationFrame(() => {
			backdrop.classList.add('open');
			panel.classList.add('open');
		});
		document.body.style.overflow = 'hidden';
	}

	function closeDetail() {
		detailItemRaw = null;
		backdrop.classList.remove('open');
		panel.classList.remove('open');
		panel.setAttribute('aria-hidden', 'true');
		document.body.style.overflow = '';
		setTimeout(() => {
			backdrop.hidden = true;
		}, 280);
	}

	document.getElementById('detail-close')?.addEventListener('click', closeDetail);
	document.getElementById('detail-close-2')?.addEventListener('click', closeDetail);

	detailPdfBtn?.addEventListener('click', async () => {
		if (!detailItemRaw || !global.FieldlotPdf?.downloadListing) {
			alert(t('catalog.pdfUnavailable'));
			return;
		}
		const prev = detailPdfBtn.textContent;
		detailPdfBtn.disabled = true;
		detailPdfBtn.textContent = t('catalog.pdfLoading');
		try {
			const item = loc(detailItemRaw);
			await global.FieldlotPdf.downloadListing(item);
		} catch {
			alert(t('catalog.pdfErr'));
		} finally {
			detailPdfBtn.disabled = false;
			detailPdfBtn.textContent = prev;
		}
	});
	backdrop?.addEventListener('click', closeDetail);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closeDetail();
	});

	function applyUrlFilters() {
		const params = new URLSearchParams(window.location.search);
		const cat = params.get('category');
		const crop = params.get('crop');
		const q = params.get('q');
		if (cat && catEl) catEl.value = cat;
		if (crop && cropEl) cropEl.value = crop;
		if (q && qEl) qEl.value = q;
	}

	[qEl, catEl, cropEl, regEl, roleEl].forEach((el) => {
		el?.addEventListener('input', render);
		el?.addEventListener('change', render);
	});
	document.getElementById('reset-filters')?.addEventListener('click', () => {
		qEl.value = '';
		if (catEl) catEl.value = '';
		if (cropEl) cropEl.value = '';
		regEl.value = '';
		roleEl.value = '';
		render();
	});

	document.addEventListener('fieldlot-lang-change', render);

	// Terminal Mode Toggle Logic
	const viewCardsBtn = document.getElementById('view-cards');
	const viewTerminalBtn = document.getElementById('view-terminal');
	
	function setViewMode(mode) {
		if (!viewCardsBtn || !viewTerminalBtn) return;
		if (mode === 'terminal') {
			grid.classList.add('terminal-mode');
			viewTerminalBtn.classList.add('active');
			viewCardsBtn.classList.remove('active');
			localStorage.setItem('fieldlot-catalog-view', 'terminal');
		} else {
			grid.classList.remove('terminal-mode');
			viewCardsBtn.classList.add('active');
			viewTerminalBtn.classList.remove('active');
			localStorage.setItem('fieldlot-catalog-view', 'cards');
		}
	}

	if (viewCardsBtn && viewTerminalBtn) {
		viewCardsBtn.addEventListener('click', () => setViewMode('cards'));
		viewTerminalBtn.addEventListener('click', () => setViewMode('terminal'));
		
		// Restore preference
		const savedView = localStorage.getItem('fieldlot-catalog-view');
		if (savedView === 'terminal') {
			setViewMode('terminal');
		}
	}

	loadListings()
		.then(() => {
			applyUrlFilters();
			render();
			const openId = new URLSearchParams(window.location.search).get('id');
			if (openId) {
				const found = allListings.find((x) => x.id === openId);
				if (found) openDetail(found);
			}
		})
		.catch(() => {
			grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(t('listing.loadFail'))}</p></div>`;
		});
})(window);
