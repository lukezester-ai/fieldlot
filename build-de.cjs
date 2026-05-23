const fs = require('fs');
const file = 'public/scripts/fieldlot-i18n-messages.js';
let txt = fs.readFileSync(file, 'utf8');

const startIdx = txt.indexOf('en: {');
const endIdx = txt.indexOf('},', startIdx) + 2;
const enBlock = txt.substring(startIdx, endIdx);

let deText = enBlock.replace(/^en:/, 'de:')
	.replace(/'Home'/g, "'Startseite'")
	.replace(/'Catalog'/g, "'Katalog'")
	.replace(/'Marketplace'/g, "'Marktplatz'")
	.replace(/'Exchange'/g, "'Börse'")
	.replace(/'Logistics'/g, "'Logistik'")
	.replace(/'Producers'/g, "'Produzenten'")
	.replace(/'Categories'/g, "'Kategorien'")
	.replace(/'Early access'/g, "'Frühzugang'")
	.replace(/'Language'/g, "'Sprache'")
	.replace(/'Buy produce'/g, "'Erzeugnisse kaufen'")
	.replace(/'Sell produce'/g, "'Erzeugnisse verkaufen'")
	.replace(/'AI assistant'/g, "'KI-Assistent'")
	.replace(/'Vegetables'/g, "'Gemüse'")
	.replace(/'Fruit'/g, "'Obst'")
	.replace(/'Grain'/g, "'Getreide'")
	.replace(/'Oil'/g, "'Öl'")
	.replace(/'Fertilizer'/g, "'Düngemittel'")
	.replace(/'Machinery'/g, "'Maschinen'")
	.replace(/'Feed'/g, "'Futtermittel'")
	.replace(/'Price today'/g, "'Preis heute'")
	.replace(/'Quantity'/g, "'Menge'")
	.replace(/'Price'/g, "'Preis'")
	.replace(/'Location'/g, "'Ort'")
	.replace(/'Contact'/g, "'Kontakt'")
	.replace(/'For sale'/g, "'Zu verkaufen'")
	.replace(/'Wanted'/g, "'Gesucht'")
	.replace(/'Transport'/g, "'Transport'")
	.replace(/'Warehouses'/g, "'Lagerhäuser'")
	.replace(/'Tracking'/g, "'Tracking'");

const additional = `
			'exchange.quote.wheat': 'Weizen',
			'exchange.quote.corn': 'Mais',
			'exchange.quote.rapeseed': 'Raps',
			'exchange.quote.sunflower': 'Sonnenblumen',
`;

deText = deText.replace(/'exchange\.colChange': 'Change',/, "'exchange.colChange': 'Änderung'," + additional);

txt = txt.replace('en: {', deText + '\n\t\ten: {');
fs.writeFileSync(file, txt);
