# Fieldlot

Самостоятелен лендинг и API за B2B агро оферти в България.

**Git:** основен клон за разработка е **`fieldlot`**; **веднъж месечно** се синхронизира със **`main`** (виж [`docs/BRANCHING.md`](docs/BRANCHING.md)). Репото не е част от друг монорепо — само `lukezester-ai/fieldlot`.

## Старт (локално)

```bash
npm install
cp .env.example .env   # или Copy-Item .env.example .env
npm run dev
```

Отвори http://localhost:5174 — Vite проксира `/api` към Node API (порт **8789**).

Продуктовият стек е **Vite + Node API + Firebase**. FastAPI в `dev/backend` е **локален прототип** (поръчки/JWT) и **не** се ползва от UI и **не** се деплойва на Vercel.

```bash
npm run dev        # сайт + Node API
npm run dev:full   # същото + FastAPI на :8000 (по желание)
```

### FastAPI (по желание, само локално)

```bash
cd dev/backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
npm run dev:full
```

**Демо каталог:** http://localhost:5174/catalog.html

## Lovable / static preview

Каталогът е достъпен на **`/catalog.html`** (статичен JSON + UI).

Backend API-тата (**`/api/register-interest`**, **`/api/fieldlot-chat`**) **няма да отговарят** в Lovable preview — няма Node/Vercel functions там.

- Формата и AI чатът показват **`offline`** и жълт banner отгоре.
- За пълна функционалност: `npm run dev` локално или deploy на **Vercel** с env vars.

## API

| Метод | Път | Описание |
|-------|-----|----------|
| GET | `/api/fieldlot-chat` | Статус на LLM |
| POST | `/api/fieldlot-chat` | Fieldlot Guide (чат) |
| POST | `/api/register-interest` | Форма „ранен достъп“ |
| POST | `/api/notify-inquiry` | Имейл към inbox при запитване |
| GET | `/api/listings` | Каталог (кеш + snapshot) |
| GET | `/api/exchange-prices` | Борсови цени |
| POST | `/api/classify-image` | Vision класификация |
| POST | `/api/draft-listing` | Чернова на обява |
| GET/POST | `/api/admin/*` | Admin (cookie сесия) |
| GET | `/api/cron/sync-listings` | Cron: sync обяви (изисква `CRON_SECRET`) |
| GET | `/api/cron/exchange-prices` | Cron: борсови цени |

## `.env`

| Променлива | Описание |
|------------|----------|
| `FIELDLOT_INBOX_EMAIL` | Получател на заявки (`info@agrinexus.eu`) |
| `RESEND_API_KEY` + `RESEND_FROM` | Изпращане на имейл |
| `FIELDLOT_STORE_LEADS=1` | Локален лог в `.local/fieldlot-leads.jsonl` |
| `MISTRAL_API_KEY` / `OPENAI_API_KEY` / `OLLAMA_*` | AI чат |
| `MISTRAL_EMBED_MODEL` | Семантичен RAG (`mistral-embed`) |
| `FIELDLOT_ADMIN_SECRET` | Токен за `/admin` панела |
| `VITE_FIREBASE_*` | Firebase Auth/Firestore (задължителни при `npm run build`) |
| `CRON_SECRET` | Vercel cron за sync на обяви |
| `FIELDLOT_SNAPSHOT_URL` / `FIELDLOT_SNAPSHOT_PUT_URL` | Отдалечен JSON snapshot между serverless инстанции |
| `FIELDLOT_ENABLE_SYNTHETIC_FEED=1` | Включва RNG „Global Feed“ (изключен по подразбиране) |

## Обяви, снимки, RAG и държавни сайтове

- **Sync:** `npm run sync:listings` — тегли обяви, обновява `data/live-listings.json` и копира към `public/data/` при build.
- **Cron:** Vercel вика `/api/cron/sync-listings` на всеки 6 часа. За persist между инстанции задай `FIELDLOT_SNAPSHOT_PUT_URL` + `FIELDLOT_SNAPSHOT_URL`.
- **Admin:** cookie сесия след вход в `/admin.html` (не пази секрета в localStorage).
- **Снимки:** `npm run sync:images` — сваля/обновява изображения от manifest.
- **Източници:** `data/listing-sources.json` — **продава и купува** от **borsaagro.com**, **agro.bg**, **agri.bg**. Само продажби: `FIELDLOT_SALES_ONLY=1`.
- **Admin:** http://localhost:5174/admin.html (или `/admin` на Vercel) — sync, knowledge, източници. Header: `Authorization: Bearer <FIELDLOT_ADMIN_SECRET>`.
- **Чат:** Fieldlot Guide ползва keyword + семантичен RAG; в UI се показват **Doc Discovery** хитове при `MISTRAL_API_KEY`.

## Тестове

```bash
npm run typecheck
npm test      # unit + smoke API
npx playwright install chromium && npm run test:e2e   # публични страници
```

## Deploy на Vercel

**Пълна инструкция от нулата:** [`VERCEL-START.md`](VERCEL-START.md)

Бърз линк за import:

**Production:** https://fieldlot-two.vercel.app (team **roxsonltd-droid**, Hobby)

**Git import (Hobby):** https://vercel.com/new/import?s=https://github.com/lukezester-ai/fieldlot  
*(създай repo на lukezester-ai първо — виж `VERCEL-START.md`)*

- Preset: **Other** (не Services)
- Build: `npm run build` → Output: `dist`
- Env: `FIELDLOT_INBOX_EMAIL`, `RESEND_*`, `MISTRAL_API_KEY` или `OPENAI_API_KEY`

## SQL / mobile / плащания

`supabase-fieldlot-listings.sql` остава **бъдеща фаза** — живите обяви са JSON + Firebase, не Postgres.

Capacitor/Android е скелет, не е продуктов app.

Плащания/депозити не са включени, докато офертите след запитване не се ползват реално.

## Firestore rules

След промяна на `firestore.rules`: `firebase deploy --only firestore:rules`
