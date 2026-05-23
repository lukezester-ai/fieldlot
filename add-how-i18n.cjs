const fs = require('fs');
const file = 'public/scripts/fieldlot-i18n-messages.js';
let txt = fs.readFileSync(file, 'utf8');

const bgAdd = `
			'how.eyebrow': 'Как работи',
			'how.title': 'Как работи Fieldlot',
			'how.lead': 'Лесен и бърз процес от регистрация до успешна сделка.',
			'how.step1': '1. Регистрация',
			'how.step1Desc': 'Създай профил за броени минути.',
			'how.step2': '2. Обяви и Търсене',
			'how.step2Desc': 'Публикувай продукция или намери това, което търсиш.',
			'how.step3': '3. Директна Сделка',
			'how.step3Desc': 'Свържи се директно без скрити такси.',
`;

const enAdd = `
			'how.eyebrow': 'How it works',
			'how.title': 'How Fieldlot Works',
			'how.lead': 'A simple and fast process from registration to a successful deal.',
			'how.step1': '1. Registration',
			'how.step1Desc': 'Create your profile in minutes.',
			'how.step2': '2. Post & Search',
			'how.step2Desc': 'Publish your produce or find what you need.',
			'how.step3': '3. Direct Deal',
			'how.step3Desc': 'Connect directly with no hidden fees.',
`;

const deAdd = `
			'how.eyebrow': 'Wie es funktioniert',
			'how.title': 'Wie Fieldlot funktioniert',
			'how.lead': 'Ein einfacher und schneller Prozess von der Registrierung bis zum erfolgreichen Geschäft.',
			'how.step1': '1. Registrierung',
			'how.step1Desc': 'Erstellen Sie Ihr Profil in wenigen Minuten.',
			'how.step2': '2. Inserieren & Suchen',
			'how.step2Desc': 'Veröffentlichen Sie Ihre Produkte oder finden Sie, was Sie brauchen.',
			'how.step3': '3. Direktes Geschäft',
			'how.step3Desc': 'Direkt verbinden ohne versteckte Gebühren.',
`;

txt = txt.replace(/'farmers\.cta': 'Публикувай профил \(ранен достъп\)',/, "'farmers.cta': 'Публикувай профил (ранен достъп)'," + bgAdd);
txt = txt.replace(/'farmers\.cta': 'Publish your profile \(early access\)',/, "'farmers.cta': 'Publish your profile (early access)'," + enAdd);
txt = txt.replace(/'farmers\.cta': 'Publish your profile \(early access\)'/, "'farmers.cta': 'Publish your profile (early access)'," + deAdd); // de uses the same key for farmers.cta right now because my previous replace translated from en but kept values if I missed it, wait!
// Let's check what farmers.cta is in de
// Actually I'll replace before 'exchange.eyebrow' since that is stable.
// BG: 'exchange.eyebrow': 'Борса',
// EN: 'exchange.eyebrow': 'Exchange',
// DE: 'exchange.eyebrow': 'Börse',

txt = txt.replace(/'exchange\.eyebrow': 'Борса',/, bgAdd + "\t\t\t'exchange.eyebrow': 'Борса',");
txt = txt.replace(/'exchange\.eyebrow': 'Exchange',/, enAdd + "\t\t\t'exchange.eyebrow': 'Exchange',");
txt = txt.replace(/'exchange\.eyebrow': 'Börse',/, deAdd + "\t\t\t'exchange.eyebrow': 'Börse',");

fs.writeFileSync(file, txt);
