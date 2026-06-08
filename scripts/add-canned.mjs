import fs from 'fs';

const publicPath = 'public/data/live-listings.json';
const dataPath = 'data/live-listings.json';

if (!fs.existsSync(publicPath)) {
    console.error("No listings file found.");
    process.exit(1);
}

const rawData = fs.readFileSync(publicPath, 'utf8');
const data = JSON.parse(rawData);

const cannedAds = [
    {
        id: "demo-canned-1",
        type: "sell",
        title: "Доматена лютеница (едро смляна) - 0.500 кг",
        subtitle: "България 🇧🇬",
        price: "4.50",
        priceUnit: "BGN/бр.",
        qty: "2 000 буркана",
        incoterm: "EXW Пловдив",
        contact: "Агроконсерв ООД",
        category: "canned",
        tags: ["Консерви", "crop:preserves"],
        publishedAt: new Date().toISOString()
    },
    {
        id: "demo-canned-2",
        type: "sell",
        title: "Мариновани краставички (Корнишони) - палети",
        subtitle: "България 🇧🇬",
        price: "3.20",
        priceUnit: "BGN/бр.",
        qty: "5 палета",
        incoterm: "FCA Стара Загора",
        contact: "ЗП Иван Петров",
        category: "canned",
        tags: ["Консерви", "crop:preserves"],
        publishedAt: new Date().toISOString()
    }
];

// Add them to the top of the listings array
if (Array.isArray(data.listings)) {
    data.listings.unshift(...cannedAds);
}

fs.writeFileSync(publicPath, JSON.stringify(data, null, 2), 'utf8');
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`Added ${cannedAds.length} canned goods listings!`);
