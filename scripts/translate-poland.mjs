import fs from 'fs';

async function translateText(text, sourceLang = 'pl', targetLang = 'bg') {
    if (!text) return text;
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        return data[0].map(x => x[0]).join('');
    } catch (e) {
        console.error("Translation error:", e);
        return text; // return original on error
    }
}

async function run() {
    const publicPath = 'public/data/live-listings.json';
    const dataPath = 'data/live-listings.json';
    
    if (!fs.existsSync(publicPath)) {
        console.error("No listings file found.");
        return;
    }

    const rawData = fs.readFileSync(publicPath, 'utf8');
    const data = JSON.parse(rawData);
    
    let translatedCount = 0;
    
    for (const listing of data.listings) {
        // Find Polish ads
        if (listing.id && listing.id.startsWith('pl-igrit')) {
            console.log(`Translating: ${listing.title}`);
            const newTitle = await translateText(listing.title);
            const newDesc = await translateText(listing.description);
            
            listing.title = newTitle;
            listing.description = newDesc;
            translatedCount++;
            
            // delay to avoid google translate api rate limit
            await new Promise(r => setTimeout(r, 200));
        }
    }
    
    fs.writeFileSync(publicPath, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Successfully translated ${translatedCount} Polish ads to Bulgarian!`);
}

run();
