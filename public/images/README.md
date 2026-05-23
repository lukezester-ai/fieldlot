# Fieldlot images

JPG files under `hero/`, `crops/`, `farmers/`, `logistics/` match `data/fieldlot-image-manifest.json`.

**Sync (download + regenerate JS):**

```bash
npm run sync:images
```

**Regenerate only** `public/scripts/fieldlot-images.js` (no download):

```bash
node scripts/sync-images-from-manifest.mjs
```

License: Pexels (see `scripts/fix-crop-images.mjs` URLs). Do not commit unrelated stock photos.
