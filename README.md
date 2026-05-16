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
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

`npm run dev` стартира и backend автоматично. Swagger: http://127.0.0.1:8000/docs

Виж `backend/README.md` за demo акаунти и endpoints.

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

## Тестове

```bash
npm run typecheck
npm run dev   # друг терминал
npm test      # smoke към API 8789
```

## Deploy (Vercel)

1. Import на repo `fieldlot`
2. Env vars от `.env.example`
3. Build: `npm run build`, output `dist`
4. API: `api/register-interest.ts`, `api/fieldlot-chat.ts`

## SQL

`supabase-fieldlot-listings.sql` — бъдеща фаза (обяви), не е вързана към текущия лендинг.
