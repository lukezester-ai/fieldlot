# Fieldlot

Самостоятелен лендинг и API за B2B агро оферти в България.

## Старт (локално)

```bash
npm install
cp .env.example .env   # или Copy-Item .env.example .env
npm run dev
```

Отвори http://localhost:5174 — Vite проксира:
- `/api/v1` → FastAPI backend (порт **8000**)
- `/api` → Node dev API (чат, форма — порт **8789**)

### FastAPI backend (ново)

```bash
cd dev/backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

`npm run dev` стартира и backend автоматично. Swagger: http://127.0.0.1:8000/docs

Виж `dev/backend/README.md` за demo акаунти (Python — само локално, не на Vercel).

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

## `.env`

| Променлива | Описание |
|------------|----------|
| `FIELDLOT_INBOX_EMAIL` | Получател на заявки (`info@agrinexus.eu`) |
| `RESEND_API_KEY` + `RESEND_FROM` | Изпращане на имейл |
| `FIELDLOT_STORE_LEADS=1` | Локален лог в `.local/fieldlot-leads.jsonl` |
| `MISTRAL_API_KEY` / `OPENAI_API_KEY` / `OLLAMA_*` | AI чат |
| `MISTRAL_EMBED_MODEL` | Семантичен RAG (`mistral-embed`) |
| `FIELDLOT_ADMIN_SECRET` | Токен за `/admin` панела |
| `CRON_SECRET` | Vercel cron за sync на обяви |

## Обяви, снимки, RAG и държавни сайтове

- **Sync:** `npm run sync:listings` — тегли обяви (borsaagro + конфигурирани източници), обновява `data/live-listings.json`, manifest за снимки и `data/fieldlot-rag-index.json`.
- **Снимки:** `npm run sync:images` — сваля/обновява изображения от manifest.
- **Източници:** `data/listing-sources.json` — **продава и купува** от **borsaagro.com**, **agro.bg**, **agri.bg**. Само продажби: `FIELDLOT_SALES_ONLY=1`.
- **Admin:** http://localhost:5174/admin.html (или `/admin` на Vercel) — sync, knowledge, източници. Header: `Authorization: Bearer <FIELDLOT_ADMIN_SECRET>`.
- **Чат:** Fieldlot Guide ползва keyword + семантичен RAG; в UI се показват **Doc Discovery** хитове при `MISTRAL_API_KEY`.

## Тестове

```bash
npm run typecheck
npm run dev   # друг терминал
npm test      # smoke към API 8789
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

## SQL

`supabase-fieldlot-listings.sql` — бъдеща фаза (обяви), не е вързана към текущия лендинг.
