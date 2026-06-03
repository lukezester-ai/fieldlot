// logistics-page.js
const DUMMY_LOGISTICS = [
	{ id: 'log-1', title: 'Транспорт със зърновоз (Гондола 24т)', category: 'transport', qty: '24', unit: 'тона', price: 'По договаряне', region: 'Варна', role: 'sell', sourceName: 'AgroTrans BG', publishedAt: new Date().toISOString(), img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=400&q=80', desc: 'Свободен зърновоз за курсове от Добруджа към Пристанище Варна. Възможност за дългосрочен договор.' },
	{ id: 'log-2', title: 'Хладилен транспорт до Европа', category: 'transport', qty: '20', unit: 'палета', price: 'По договаряне', region: 'Пловдив', role: 'sell', sourceName: 'CoolLogistics', publishedAt: new Date(Date.now() - 86400000).toISOString(), img: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=400&q=80', desc: 'Транспорт на пресни плодове и зеленчуци (режим) за Германия, Австрия и Румъния.' },
	{ id: 'log-3', title: 'Складова база - Силози', category: 'warehouse', qty: '5000', unit: 'тона', price: '6 лв/тон на месец', region: 'Плевен', role: 'sell', sourceName: 'Pleven Agro', publishedAt: new Date(Date.now() - 172800000).toISOString(), img: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=400&q=80', desc: 'Свободен капацитет в стоманобетонни силози за съхранение на пшеница или царевица. Активна вентилация.' },
	{ id: 'log-4', title: 'Търся зърновоз за Слънчоглед', category: 'transport', qty: '120', unit: 'тона', price: 'По договаряне', region: 'Ямбол', role: 'buy', sourceName: 'FarmTrade Ltd.', publishedAt: new Date(Date.now() - 3600000).toISOString(), img: null, desc: 'Нужни са 5 камиона за извозване на слънчоглед от база в Ямбол до фабрика в Бургас.' },
	{ id: 'log-5', title: 'Бордово ремарке 13.6м (Ченгели)', category: 'transport', qty: '22', unit: 'тона', price: '1.80 лв/км', region: 'Русе', role: 'sell', sourceName: 'TransExpress', publishedAt: new Date(Date.now() - 4200000).toISOString(), img: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=400&q=80', desc: 'Свободен камион за транспорт на палетизирани торове или семена от Русе до вътрешността на страната.' },
	{ id: 'log-6', title: 'Търся плосък склад под наем', category: 'warehouse', qty: '2000', unit: 'кв.м', price: 'По договаряне', region: 'Силистра', role: 'buy', sourceName: 'AgroSilistra', publishedAt: new Date(Date.now() - 7200000).toISOString(), img: null, desc: 'Търсим плосък склад за временно съхранение на рапица по време на жътвената кампания. Задължително асфалтиран.' },
	{ id: 'log-7', title: 'Хладилна база / Камера за плодове', category: 'warehouse', qty: '300', unit: 'палета', price: 'От 2 лв/палет на ден', region: 'Сливен', role: 'sell', sourceName: 'Sliven ColdStore', publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(), img: 'https://images.unsplash.com/photo-1555529902-5261145633bf?auto=format&fit=crop&w=400&q=80', desc: 'Модерна хладилна камера поддържаща до 2 градуса. Идеална за съхранение на праскови и череши.' },
	{ id: 'log-8', title: 'Пристанищна логистика (Спедиция)', category: 'tracking', qty: '1', unit: 'услуга', price: 'Оферта при запитване', region: 'Бургас', role: 'sell', sourceName: 'Port Forwarding', publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(), img: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=400&q=80', desc: 'Пълно логистично обслужване на Пристанище Бургас - митническо оформяне, сюрвей, товаро-разтоварни операции.' },
	{ id: 'log-9', title: 'Търся транспорт на животни (Прасета)', category: 'transport', qty: '100', unit: 'глави', price: 'Спешно', region: 'Стара Загора', role: 'buy', sourceName: 'Svinekompleks BG', publishedAt: new Date(Date.now() - 1000000).toISOString(), img: null, desc: 'Нужда от специализиран транспорт за живи животни от Стара Загора до кланица в Пловдив.' },
	{ id: 'log-10', title: 'Самодъмпер / Зърновоз 26т', category: 'transport', qty: '26', unit: 'тона', price: '2.50 лв/км', region: 'Монтана', role: 'sell', sourceName: 'Монтана Агро', publishedAt: new Date(Date.now() - 2500000).toISOString(), img: 'https://images.unsplash.com/photo-1519003300449-424ad0405076?auto=format&fit=crop&w=400&q=80', desc: 'Нов зърновоз с алуминиево корито. Наличен за курсове в Северозападна България и Румъния.' },
	{ id: 'log-11', title: 'Склад наземен тип', category: 'warehouse', qty: '1500', unit: 'тона', price: 'По договаряне', region: 'Добрич', role: 'sell', sourceName: 'Dobrich Invest', publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(), img: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=400&q=80', desc: 'Давам под наем плосък склад с автокантар и охрана.' },
	{ id: 'log-12', title: 'Експортна логистика (Tracking & Survey)', category: 'tracking', qty: '1', unit: 'проект', price: 'Според обема', region: 'Варна', role: 'sell', sourceName: 'SGS Bulgaria', publishedAt: new Date(Date.now() - 86400000 * 7).toISOString(), img: null, desc: 'Контрол на качеството, проследяване на партиди и издаване на сертификати за износ.' },
	{ id: 'log-13', title: 'Търся хладилни бусове за Малини', category: 'transport', qty: '3', unit: 'тона', price: 'По договаряне', region: 'Ловеч', role: 'buy', sourceName: 'Berry Farm', publishedAt: new Date(Date.now() - 1800000).toISOString(), img: null, desc: 'Регулярен курс: всяка сряда от Ловеч до София (борса Слатина). Търсим надежден превозвач.' }
];

const ADS = [
	{
		id: 'ad-1',
		title: 'Специализиран агро транспорт',
		desc: 'Фирма X Транс ООД. Сигурност и точност за вашата продукция. 10% отстъпка за нови клиенти.',
		img: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=400&q=80',
		link: '#ad-1'
	},
	{
		id: 'ad-2',
		title: 'Резервни части за камиони',
		desc: 'Оригинални и алтернативни части. Склад в София. Доставка до 24 часа в цялата страна.',
		img: 'https://images.unsplash.com/photo-1620619864227-2c942db4d3fa?auto=format&fit=crop&w=400&q=80',
		link: '#ad-2'
	}
];

function renderLogistics() {
	const grid = document.getElementById('logistics-grid');
	if (!grid) return;

	grid.innerHTML = '';
	
	const q = document.getElementById('q')?.value.toLowerCase() || '';
	const serviceType = document.getElementById('service-type')?.value || '';

	const filtered = DUMMY_LOGISTICS.filter(item => {
		if (q && !item.title.toLowerCase().includes(q) && !item.desc.toLowerCase().includes(q)) return false;
		if (serviceType && item.category !== serviceType) return false;
		return true;
	});

	document.getElementById('results-count').innerHTML = `<strong>${filtered.length}</strong> <span>обяви</span>`;

	if (filtered.length === 0) {
		grid.innerHTML = '<div class="empty-state">Няма намерени логистични обяви по тези критерии.</div>';
		return;
	}

	filtered.forEach(item => {
		const card = document.createElement('div');
		card.className = 'listing-card reveal';
		card.style.opacity = 1;
		card.style.transform = 'translateY(0)';
		
		const roleBadge = item.role === 'buy' ? '<span class="listing-role buy">Търси транспорт</span>' : '<span class="listing-role sell">Предлага транспорт</span>';
		
		card.innerHTML = `
			${item.img ? `<div class="listing-img" style="background-image:url(${item.img})"></div>` : `<div class="listing-img no-img"><span>Няма снимка</span></div>`}
			<div class="listing-content">
				${roleBadge}
				<h3 class="listing-title">${item.title}</h3>
				<p class="listing-meta">${item.region} • ${new Date(item.publishedAt).toLocaleDateString()}</p>
				<p class="listing-price">${item.qty} ${item.unit} • <strong>${item.price}</strong></p>
				<p style="font-size:0.9rem; color:var(--text-muted); margin-top:0.5rem; line-height:1.4;">${item.desc}</p>
			</div>
			<div class="listing-footer">
				<a href="#cta" class="btn btn-primary" style="width:100%; text-align:center;">Свържи се</a>
			</div>
		`;
		grid.appendChild(card);
	});
}

function renderAds() {
	const adsContainer = document.getElementById('logistics-ads');
	if (!adsContainer) return;

	adsContainer.innerHTML = '';
	ADS.forEach(ad => {
		adsContainer.innerHTML += `
			<a href="${ad.link}" class="logistics-ad-card">
				<span class="ad-badge">Реклама</span>
				<div class="ad-image" style="background-image:url(${ad.img})"></div>
				<div class="ad-content">
					<h4 class="ad-title">${ad.title}</h4>
					<p class="ad-desc">${ad.desc}</p>
					<span class="ad-cta">Научи повече &rarr;</span>
				</div>
			</a>
		`;
	});
}

document.addEventListener('DOMContentLoaded', () => {
	renderLogistics();
	renderAds();

	document.getElementById('q')?.addEventListener('input', renderLogistics);
	document.getElementById('service-type')?.addEventListener('change', renderLogistics);
	document.getElementById('reset-filters')?.addEventListener('click', () => {
		document.getElementById('q').value = '';
		document.getElementById('service-type').value = '';
		renderLogistics();
	});

	// Calculator Logic
	const calcBtn = document.getElementById('calc-btn');
	if (calcBtn) {
		calcBtn.addEventListener('click', () => {
			const kmInput = document.getElementById('calc-km');
			const tonsInput = document.getElementById('calc-tons');
			const resultBox = document.getElementById('calc-result');
			const priceValue = document.getElementById('calc-price-value');

			const km = parseFloat(kmInput.value) || 0;
			const tons = parseFloat(tonsInput.value) || 0;

			if (km <= 0 || tons <= 0) {
				alert('Моля, въведете валидно разстояние и товар.');
				return;
			}

			// Base formula: 2.50 BGN/km. Extra 0.50 BGN/km if tons > 20
			let baseRate = 2.50;
			if (tons > 20) {
				baseRate += 0.50;
			}
			
			const total = Math.round(km * baseRate);
			
			priceValue.textContent = `~${total} лв.`;
			resultBox.classList.remove('hidden');
		});
	}
});
