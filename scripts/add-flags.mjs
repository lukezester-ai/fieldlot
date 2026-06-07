import fs from 'fs';

const publicPath = 'public/data/live-listings.json';
const dataPath = 'data/live-listings.json';

if (!fs.existsSync(publicPath)) {
    console.error("No listings file found.");
    process.exit(1);
}

const rawData = fs.readFileSync(publicPath, 'utf8');
const data = JSON.parse(rawData);

const FLAGS = {
    'Полша': 'Полша 🇵🇱',
    'Германия': 'Германия 🇩🇪',
    'Гърция': 'Гърция 🇬🇷',
    'Италия': 'Италия 🇮🇹',
    'Румъния': 'Румъния 🇷🇴',
};

let modified = 0;

for (const listing of data.listings) {
    if (listing.location && FLAGS[listing.location]) {
        // Only update if it doesn't already have the flag
        if (!listing.subtitle || !listing.subtitle.includes('🇵🇱') && !listing.subtitle.includes('🇩🇪') && !listing.subtitle.includes('🇬🇷')) {
            listing.subtitle = FLAGS[listing.location];
            modified++;
        }
    }
}

fs.writeFileSync(publicPath, JSON.stringify(data, null, 2), 'utf8');
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`Added flags to ${modified} listings!`);
