// logistics-page.js
const DUMMY_LOGISTICS = [
	{
		id: 'log-1',
		title: 'Транспорт със зърновоз (Гондола 24т)',
		category: 'transport',
		qty: '24',
		unit: 'тона',
		price: 'По договаряне',
		region: 'Варна',
		role: 'sell',
		sourceName: 'Fieldlot Logistics',
		publishedAt: new Date().toISOString(),
		img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=400&q=80',
		desc: 'Свободен зърновоз за курсове от Добруджа към Пристанище Варна. Възможност за дългосрочен договор.'
	},
	{
		id: 'log-2',
		title: 'Хладилен транспорт до Европа',
		category: 'transport',
		qty: '20',
		unit: 'палета',
		price: 'По договаряне',
		region: 'Пловдив',
		role: 'sell',
		sourceName: 'Fieldlot Logistics',
		publishedAt: new Date(Date.now() - 86400000).toISOString(),
		img: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=400&q=80',
		desc: 'Транспорт на пресни плодове и зеленчуци (режим) за Германия, Австрия и Румъния.'
	},
	{
		id: 'log-3',
		title: 'Складова база - Силози',
		category: 'warehouse',
		qty: '5000',
		unit: 'тона',
		price: '6 лв/тон на месец',
		region: 'Плевен',
		role: 'sell',
		sourceName: 'Fieldlot Logistics',
		publishedAt: new Date(Date.now() - 172800000).toISOString(),
		img: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=400&q=80',
		desc: 'Свободен капацитет в стоманобетонни силози за съхранение на пшеница или царевица. Активна вентилация.'
	},
	{
		id: 'log-4',
		title: 'Търся зърновоз за Слънчоглед',
		category: 'transport',
		qty: '120',
		unit: 'тона',
		price: 'По договаряне',
		region: 'Ямбол',
		role: 'buy',
		sourceName: 'Fieldlot Logistics',
		publishedAt: new Date(Date.now() - 3600000).toISOString(),
		img: null,
		desc: 'Нужни са 5 камиона за извозване на слънчоглед от база в Ямбол до фабрика в Бургас.'
	}
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
});
