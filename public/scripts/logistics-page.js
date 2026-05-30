/**
 * Fieldlot logistics — transport & machinery listings
 */
(function initLogisticsPage(global) {
	const I18n = () => window.FieldlotI18n;
	const t = (k, fb) => (I18n() ? I18n().t(k, fb) : fb || k);

	const grid = document.getElementById('catalog-grid');
	const countEl = document.getElementById('results-count');
	const qEl = document.getElementById('q');
	const catEl = document.getElementById('category');
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
		transport: 'Транспорт',
		machinery: 'Земеделска техника',
	};

	function categoryLabel(item) {
		return CAT_LABELS[item.category] || item.category || 'Услуга';
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
		grid.innerHTML = `<p class="meta yp-loading">Зареждане на обяви…</p>`;
		let fbData = [];
		try {
			let retries = 20;
			while (!window.fetchFirebaseLogistics && retries > 0) {
				await new Promise(r => setTimeout(r, 100));
				retries--;
			}
			if (window.fetchFirebaseLogistics) {
				fbData = await window.fetchFirebaseLogistics(100);
			}
		} catch (e) {
			console.error("Firebase logistics fetch error:", e);
		}
		
		// Demo data if empty
		if (fbData.length === 0) {
			fbData = [
				{ id: 'mock1', title: 'Транспорт със Зърновоз 24т', subtitle: '🇧🇬 Варна', category: 'transport', price: 'По договаряне', priceUnit: '', qty: '24 тона', role: 'offer', publishedAt: new Date().toISOString(), isFirebase: false },
				{ id: 'mock2', title: 'Търся комбайн за жътва на пшеница', subtitle: '🇧🇬 Добрич', category: 'machinery', price: 'По договаряне', priceUnit: '', qty: '500 дка', role: 'seek', publishedAt: new Date(Date.now() - 86400000).toISOString(), isFirebase: false },
				{ id: 'mock3', title: 'Услуги с трактор и пръскачка', subtitle: '🇧🇬 Пловдив', category: 'machinery', price: '12', priceUnit: 'лв/дка', qty: 'До 1000 дка', role: 'offer', publishedAt: new Date(Date.now() - 172800000).toISOString(), isFirebase: false },
				{ id: 'mock4', title: 'Хладилен транспорт за плодове', subtitle: '🇧🇬 Сливен', category: 'transport', price: 'По договаряне', priceUnit: '', qty: '3.5 тона', role: 'offer', publishedAt: new Date(Date.now() - 259200000).toISOString(), isFirebase: false },
				{ id: 'mock5', title: 'Търся транспорт за 100т царевица', subtitle: '🇧🇬 Русе -> Бургас', category: 'transport', price: 'Търси оферти', priceUnit: '', qty: '100 тона', role: 'seek', publishedAt: new Date(Date.now() - 345600000).toISOString(), isFirebase: false },
				{ id: 'mock6', title: 'Международен транспорт на зърно', subtitle: '🇧🇬 България -> 🇬🇷 Гърция', category: 'transport', price: 'По договаряне', priceUnit: '', qty: 'Над 100т', role: 'offer', publishedAt: new Date(Date.now() - 5000000).toISOString(), isFirebase: false },
				{ id: 'mock7', title: 'Търся камиони за износ на слънчоглед', subtitle: '🇧🇬 Силистра -> 🇷🇴 Румъния', category: 'transport', price: 'Отворено', priceUnit: '', qty: '500 тона', role: 'seek', publishedAt: new Date(Date.now() - 12000000).toISOString(), isFirebase: false },
				{ id: 'mock8', title: 'Хладилни групажи до Германия', subtitle: '🇧🇬 София -> 🇩🇪 Мюнхен', category: 'transport', price: 'По договаряне', priceUnit: '', qty: 'От 1 до 10 палета', role: 'offer', publishedAt: new Date(Date.now() - 40000000).toISOString(), isFirebase: false }
			];
		}

		allListings = sortListings(stripMedia(fbData));
	}

	function filterListings() {
		const q = qEl.value.trim().toLowerCase();
		const cat = catEl?.value || '';
		const role = roleEl?.value || '';
		return allListings.filter((raw) => {
			const item = loc(raw);
			if (cat && item.category !== cat) return false;
			if (role && item.role !== role) return false;
			if (!q) return true;
			const hay = [item.title, item.subtitle, item.contact]
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

		const article = document.createElement('a');
		article.className = 'listing-card yp-entry';
		article.href = '#';
		article.dataset.id = item.id;
		article.innerHTML = `
			<div class="yp-entry-main">
				<div class="yp-entry-head">
					<span class="tag ${roleClass}">${escapeHtml(roleLabel)}</span>
					${cat ? `<span class="tag yp-cat">${escapeHtml(cat)}</span>` : ''}
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
			grid.innerHTML = `<div class="empty-state"><p>Няма намерени обяви</p></div>`;
		} else {
			items.forEach((raw, index) => {
				grid.appendChild(renderCard(raw));
				// Вградена реклама след всяка 3-та обява (само ако има повече обяви след нея)
				if ((index + 1) % 3 === 0 && index < items.length - 1) {
					const ad = document.createElement('div');
					ad.className = 'in-feed-ad';
					ad.style = 'grid-column: 1 / -1; background: var(--primary-soft); border: 2px dashed var(--primary-light); padding: 1.5rem; text-align: center; border-radius: var(--radius-md); margin-bottom: 1rem;';
					ad.innerHTML = `
						<span style="font-size: 0.75rem; text-transform: uppercase; font-weight: bold; color: var(--primary);">Реклама</span>
						<h4 style="margin: 0.5rem 0; color: var(--primary-dark);">Търсите сигурни резервни части?</h4>
						<p style="margin: 0 0 1rem; color: var(--text-muted); font-size: 0.9rem;">Вземете 10% отстъпка за всички филтри и масла този месец.</p>
						<button class="btn btn-primary" style="font-size: 0.85rem; padding: 0.4rem 1rem;">Научи повече</button>
					`;
					grid.appendChild(ad);
				}
			});
		}
		countEl.innerHTML = `<strong>${items.length}</strong> обяви`;
	}

	async function openDetail(raw) {
		detailItemRaw = raw;
		const item = loc(raw);
		detailTitle.textContent = item.title;
		const sourceLink = item.sourceUrl
			? `<p class="detail-note"><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(t('catalog.sourceLink'))}</a></p>`
			: '';
		const cat = categoryLabel(item);
		
		let farmerProfileHtml = '';
		if (raw.isFirebase && raw.userId && window.fetchUserProfile) {
			try {
				const profile = await window.fetchUserProfile(raw.userId);
				if (profile && profile.publicConsent) {
					const certsHtml = (profile.certs || []).map(c => `<span class="badge" style="background: var(--neutral-100); color: var(--neutral-700); font-size: 0.75rem;">${escapeHtml(c.toUpperCase())}</span>`).join(' ');
					
					farmerProfileHtml = `
						<div style="margin-top: 1.5rem; padding: 1.5rem; border-radius: var(--radius-lg); background: var(--primary-soft); border: 1px solid var(--primary-dark);">
							<h4 style="margin: 0 0 1rem; color: var(--primary-dark); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
								Профил на фермер с доверие
							</h4>
							<div style="display: flex; gap: 1rem; flex-wrap: wrap;">
								${profile.profileImageUrl ? `<img src="${escapeHtml(profile.profileImageUrl)}" alt="Лого" style="width: 80px; height: 80px; object-fit: cover; border-radius: 50%; border: 2px solid white; box-shadow: var(--shadow-sm);" />` : ''}
								<div style="flex: 1; min-width: 200px;">
									<h5 style="margin: 0 0 0.25rem; font-size: 1.2rem; color: var(--text-main);">${escapeHtml(profile.companyName || 'Стопанство')}</h5>
									<p style="margin: 0 0 0.5rem; color: var(--text-muted); font-size: 0.9rem;">
										${profile.profileType ? `<strong>${escapeHtml(profile.profileType)}</strong>` : ''}
									</p>
									${profile.profileDesc ? `<p style="margin: 0 0 0.5rem; color: var(--neutral-800); font-size: 0.9rem;">${escapeHtml(profile.profileDesc)}</p>` : ''}
									${certsHtml ? `<div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 0.5rem;">${certsHtml}</div>` : ''}
									${profile.profileVideo ? `<a href="${escapeHtml(profile.profileVideo)}" target="_blank" rel="noopener" style="color: #d32f2f; font-weight: 600; text-decoration: none; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 4px;">▶ Видео презентация</a>` : ''}
								</div>
							</div>
						</div>
					`;
				}
			} catch (e) {
				console.error('Failed to load farmer profile', e);
			}
		}

		detailBody.innerHTML = `
			<div class="detail-highlight yp-detail-lead">
				${cat ? `<p class="yp-detail-cat">${escapeHtml(cat)}</p>` : ''}
				<div class="price">${escapeHtml(item.price)} <small>${escapeHtml(item.priceUnit)}</small></div>
				<p class="meta">${escapeHtml(item.qty)} · ${escapeHtml(item.incoterm)}</p>
			</div>
			${farmerProfileHtml}
			<dl class="detail-dl">
				<div><dt>${escapeHtml(t('catalog.loc'))}</dt><dd>${window.FieldlotI18n ? window.FieldlotI18n.renderFlags(escapeHtml(item.subtitle)) : escapeHtml(item.subtitle)}</dd></div>
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

	function applyUrlFilters() {
		const params = new URLSearchParams(window.location.search);
		const cat = params.get('category');
		const crop = params.get('crop');
		const q = params.get('q');
		if (cat && catEl) catEl.value = cat;
		if (crop && cropEl) cropEl.value = crop;
		if (q && qEl) qEl.value = q;
	}

	[qEl, catEl, roleEl].forEach((el) => {
		el?.addEventListener('input', render);
		el?.addEventListener('change', render);
	});
	document.getElementById('reset-filters')?.addEventListener('click', () => {
		qEl.value = '';
		if (catEl) catEl.value = '';
		if (roleEl) roleEl.value = '';
		render();
	});

	document.addEventListener('fieldlot-lang-change', render);

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
