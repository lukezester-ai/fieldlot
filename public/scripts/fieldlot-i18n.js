/**
 * Fieldlot — BG / EN UI i18n
 */
(function initFieldlotI18n(global) {
	const { MESSAGES, LISTING_EN } = global.__fieldlotI18nCatalog || { MESSAGES: { bg: {}, en: {} }, LISTING_EN: {} };
	const STORAGE_KEY = 'fieldlot-lang';
	const SUPPORTED = new Set(['bg', 'en', 'de']);

	let currentLang = 'bg';

	function readUrlLang() {
		try {
			const p = new URLSearchParams(global.location.search).get('lang');
			if (p && SUPPORTED.has(p)) return p;
		} catch {
			/* ignore */
		}
		return null;
	}

	function readStoredLang() {
		try {
			const s = global.localStorage.getItem(STORAGE_KEY);
			if (s && SUPPORTED.has(s)) return s;
		} catch {
			/* ignore */
		}
		return null;
	}

	function detectLang() {
		return readUrlLang() || readStoredLang() || 'bg';
	}

	function getLang() {
		return currentLang;
	}

	function localeTag() {
		if (currentLang === 'en') return 'en-GB';
		if (currentLang === 'de') return 'de-DE';
		return 'bg-BG';
	}

	function t(key, fallback) {
		const bag = MESSAGES[currentLang] || MESSAGES.bg;
		if (bag && bag[key] != null) return bag[key];
		const bg = MESSAGES.bg;
		if (bg && bg[key] != null) return bg[key];
		return fallback != null ? fallback : key;
	}

	function withLangUrl(href) {
		if (!href || href.startsWith('#') || href.startsWith('mailto:')) return href;
		try {
			const u = new URL(href, global.location.origin);
			if (u.origin !== global.location.origin) return href;
			if (currentLang === 'bg') u.searchParams.delete('lang');
			else u.searchParams.set('lang', currentLang);
			const q = u.searchParams.toString();
			return u.pathname + (q ? `?${q}` : '') + u.hash;
		} catch {
			return href;
		}
	}

	function applyI18n(root) {
		const scope = root || document;
		scope.querySelectorAll('[data-i18n]').forEach((el) => {
			const key = el.getAttribute('data-i18n');
			if (!key) return;
			const val = t(key);
			if (val.includes('<')) el.innerHTML = val;
			else el.textContent = val;
		});
		scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
			const key = el.getAttribute('data-i18n-placeholder');
			if (key) el.setAttribute('placeholder', t(key));
		});
		scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
			const key = el.getAttribute('data-i18n-aria');
			if (key) el.setAttribute('aria-label', t(key));
		});
		scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
			const key = el.getAttribute('data-i18n-title');
			if (key) el.setAttribute('title', t(key));
		});
		scope.querySelectorAll('option[data-i18n]').forEach((el) => {
			const key = el.getAttribute('data-i18n');
			if (key) el.textContent = t(key);
		});
		scope.querySelectorAll('a[href]').forEach((a) => {
			if (a.hasAttribute('data-i18n-skip-href')) return;
			const href = a.getAttribute('href');
			if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
			try {
				const u = new URL(href, global.location.origin);
				if (u.origin !== global.location.origin) return;
				if (currentLang === 'bg') u.searchParams.delete('lang');
				else u.searchParams.set('lang', currentLang);
				const q = u.searchParams.toString();
				a.setAttribute('href', u.pathname + (q ? `?${q}` : '') + u.hash);
			} catch {
				/* ignore */
			}
		});
		const titleKey = document.documentElement.getAttribute('data-i18n-title-key');
		if (titleKey) document.title = t(titleKey);
		const metaDesc = document.querySelector('meta[name="description"][data-i18n]');
		if (metaDesc) {
			const k = metaDesc.getAttribute('data-i18n');
			if (k) metaDesc.setAttribute('content', t(k));
		}
		document.documentElement.lang = currentLang;
		updateLangButtons();
	}

	function updateLangButtons() {
		document.querySelectorAll('[data-lang]').forEach((btn) => {
			const on = btn.getAttribute('data-lang') === currentLang;
			btn.setAttribute('aria-pressed', on ? 'true' : 'false');
			btn.classList.toggle('is-active', on);
		});
	}

	function setLang(lang, opts) {
		const next = SUPPORTED.has(lang) ? lang : 'bg';
		if (next === currentLang && !opts?.force) return;
		currentLang = next;
		try {
			global.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			/* ignore */
		}
		applyI18n();
		global.dispatchEvent(new CustomEvent('fieldlot-lang-change', { detail: { lang: next } }));
		if (opts?.reload) {
			const u = new URL(global.location.href);
			if (next === 'bg') u.searchParams.delete('lang');
			else u.searchParams.set('lang', next);
			global.location.replace(u.toString());
		}
	}

	function localizeListing(item) {
		if (!item || currentLang === 'bg') return item;
		const en = LISTING_EN[item.id];
		if (!en) return item;
		return {
			...item,
			title: en.title || item.title,
			subtitle: en.subtitle || item.subtitle,
			incoterm: en.incoterm || item.incoterm,
			harvest: en.harvest || item.harvest,
			quality: en.quality || item.quality,
			contact: en.contact || item.contact,
			tags: en.tags || item.tags,
		};
	}

	function bindLangSwitch() {
		document.querySelectorAll('[data-lang]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const lang = btn.getAttribute('data-lang');
				if (lang) setLang(lang);
			});
		});
	}

	function renderFlags(str) {
		if (!str) return '';
		return String(str).replace(/([\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF])/g, (match) => {
			const c1 = match.charCodeAt(1) - 0xDDE6 + 97;
			const c2 = match.charCodeAt(3) - 0xDDE6 + 97;
			const cc = String.fromCharCode(c1) + String.fromCharCode(c2);
			return `<img src="https://flagcdn.com/w20/${cc}.png" alt="${match}" style="height:14px;vertical-align:text-bottom;margin-right:2px;display:inline-block;border-radius:2px;" class="flag-icon" />`;
		});
	}

	currentLang = detectLang();
	try {
		global.localStorage.setItem(STORAGE_KEY, currentLang);
	} catch {
		/* ignore */
	}

	global.FieldlotI18n = {
		getLang,
		setLang,
		t,
		localeTag,
		applyI18n,
		localizeListing,
		withLangUrl,
		renderFlags,
	};

	function boot() {
		applyI18n();
		bindLangSwitch();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})(window);
