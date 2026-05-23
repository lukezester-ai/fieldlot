const fs = require('fs');
const txt = fs.readFileSync('public/scripts/fieldlot-i18n-messages.js', 'utf8');

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
	.replace(/'Early access'/g, "'Früher Zugang'")
	.replace(/'Language'/g, "'Sprache'")
	.replace(/'Buy produce'/g, "'Produkte kaufen'")
	.replace(/'Sell produce'/g, "'Produkte verkaufen'")
	.replace(/'AI assistant'/g, "'KI-Assistent'")
	.replace(/'Vegetables'/g, "'Gemüse'")
	.replace(/'Fruit'/g, "'Obst'")
	.replace(/'Grain'/g, "'Getreide'")
	.replace(/'Oil'/g, "'Öl'")
	.replace(/'Fertilizer'/g, "'Dünger'")
	.replace(/'Machinery'/g, "'Maschinen'")
	.replace(/'Feed'/g, "'Futtermittel'")
	.replace(/'Price today'/g, "'Preis heute'")
	.replace(/'Quantity'/g, "'Menge'")
	.replace(/'Price'/g, "'Preis'")
	.replace(/'Location'/g, "'Ort'")
	.replace(/'Contact'/g, "'Kontakt'")
	.replace(/'For sale'/g, "'Zu verkaufen'")
	.replace(/'Wanted'/g, "'Gesucht'");

const newTxt = txt.replace('en: {', deText + '\n\t\ten: {');
fs.writeFileSync('public/scripts/fieldlot-i18n-messages.js', newTxt);
