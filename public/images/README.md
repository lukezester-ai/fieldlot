# Fieldlot images (bundled with the site)

Снимките са **локални** в тази папка — зареждат се на Vercel без външен CDN.

| Папка | Съдържание |
|-------|------------|
| `hero/` | `background.jpg` (фон зад заглавието), `fresh.jpg`, `tomatoes.jpg`, `farm.jpg` |
| `crops/` | По една снимка на култура от демо каталога |
| `farmers/` | `spotlight.jpg` + 4 топ фермери |
| `logistics/` | transport, warehouse, tracking |

**Manifest за UI + RAG:** `/data/fieldlot-image-manifest.json`  
**JS:** `public/scripts/fieldlot-images.js`

За нови снимки: замени `.jpg` файл и обнови manifest при нужда.
