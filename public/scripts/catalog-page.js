/**
 * Fieldlot catalog — live listings from borsaagro.com (sorted newest first)
 */
(function initCatalogPage(global) {
	const I18n = () => window.FieldlotI18n;
	const t = (k, fb) => (I18n() ? I18n().t(k, fb) : fb || k);

	const grid = document.getElementById('catalog-grid');
	const countEl = document.getElementById('results-count');
	const qEl = document.getElementById('q');
	const catEl = document.getElementById('category');
	const regEl = document.getElementById('region');
	const roleEl = document.getElementById('role');
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

	function sortListings(items) {
		return [...items].sort((a, b) => {
			const ta = Date.parse(a.publishedAt || '') || 0;
			const tb = Date.parse(b.publishedAt || '') || 0;
			return tb - ta;
		});
	}

	async function loadListings() {
		grid.innerHTML = `<p class="meta" style="padding:24px">${escapeHtml(t('catalog.loading'))}</p>`;
		try {
			const res = await fetch('/api/listings', { headers: { Accept: 'application/json' } });
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data.listings) && data.listings.length) {
					allListings = sortListings(data.listings);
					return;
				}
			}
		} catch {
			/* static fallback */
		}
		const res2 = await fetch('/data/live-listings.json');
		if (!res2.ok) throw new Error('listings unavailable');
		const data2 = await res2.json();
		allListings = sortListings(data2.listings || []);
	}

	function filterListings() {
		const q = qEl.value.trim().toLowerCase();
		const cat = catEl.value;
		const reg = regEl.value;
		const role = roleEl.value;
		return allListings.filter((raw) => {
			const item = loc(raw);
			if (cat && item.category !== cat) return false;
			if (reg && item.region !== reg) return false;
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
		const photoSrc =
			raw.imageUrl ||
			item.imageUrl ||
			(window.FieldlotImages ? FieldlotImages.forListing(item) : '');
		const photoHtml = photoSrc
			? `<div class="listing-photo"><img src="${photoSrc}" alt="${escapeHtml(item.title)}" loading="lazy" /></div>`
			: '';
		const sourceTag = item.source
			? `<span class="tag source">${escapeHtml(item.source)}</span>`
			: '';
		const article = document.createElement('article');
		article.className = 'listing-card';
		article.tabIndex = 0;
		article.dataset.id = item.id;
		article.innerHTML = `
			${photoHtml}
			<div class="listing-card-top">
				<span class="tag ${roleClass}">${escapeHtml(roleLabel)}</span>
				${(item.tags || []).slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
			</div>
			<div class="listing-card-body">
				<h2>${escapeHtml(item.title)}</h2>
				<p class="meta">${escapeHtml(item.subtitle)} · ${escapeHtml(item.qty)}</p>
				<p class="meta">${escapeHtml(item.incoterm)}</p>
			</div>
			<div class="listing-card-foot">
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
		const photoSrc =
			raw.imageUrl ||
			item.imageUrl ||
			(window.FieldlotImages ? FieldlotImages.forListing(item) : '');
		const heroPhoto = photoSrc
			? `<div class="detail-photo"><img src="${photoSrc}" alt="${escapeHtml(item.title)}" /></div>`
			: '';
		const sourceLink = item.sourceUrl
			? `<p class="detail-note"><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(t('catalog.sourceLink'))}</a></p>`
			: '';
		detailBody.innerHTML = `
			${heroPhoto}
			<div class="detail-highlight">
				<div class="price">${escapeHtml(item.price)} <small>${escapeHtml(item.priceUnit)}</small></div>
				<p class="meta" style="margin:6px 0 0;font-size:13px;color:var(--yp-muted)">${escapeHtml(item.qty)} · ${escapeHtml(item.incoterm)}</p>
			</div>
			<dl class="detail-dl">
				<div><dt>${escapeHtml(t('catalog.loc'))}</dt><dd>${escapeHtml(item.subtitle)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.qty'))}</dt><dd>${escapeHtml(item.qty)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.price'))}</dt><dd>${escapeHtml(item.price)} ${escapeHtml(item.priceUnit)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.term'))}</dt><dd>${escapeHtml(item.incoterm)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.harvest'))}</dt><dd>${escapeHtml(item.harvest)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.quality'))}</dt><dd>${escapeHtml(item.quality)}</dd></div>
				<div><dt>${escapeHtml(t('catalog.contact'))}</dt><dd>${escapeHtml(item.contact)}</dd></div>
			</dl>
			<p class="detail-note">${escapeHtml(t('catalog.detailNote'))}</p>
			${sourceLink}
		`;
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

	[qEl, catEl, regEl, roleEl].forEach((el) => {
		el?.addEventListener('input', render);
		el?.addEventListener('change', render);
	});
	document.getElementById('reset-filters')?.addEventListener('click', () => {
		qEl.value = '';
		catEl.value = '';
		regEl.value = '';
		roleEl.value = '';
		render();
	});

	document.addEventListener('fieldlot-lang-change', render);

	loadListings()
		.then(() => {
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
