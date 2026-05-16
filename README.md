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

## Deploy на Vercel

### 1. Import проект

1. https://vercel.com/new → **Import Git Repository**
2. Избери **`roxsonltd-droid/fieldlot`** (branch `main`)
3. Framework: **Other** (или Vite — `vercel.json` вече задава build)

### 2. Build настройки (автоматични от `vercel.json`)

| Поле | Стойност |
|------|----------|
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 3. Environment Variables (Vercel → Settings → Environment Variables)

**Задължително за формата:**

| Key | Пример |
|-----|--------|
| `FIELDLOT_INBOX_EMAIL` | `info@agrinexus.eu` |
| `RESEND_API_KEY` | ключ от [resend.com](https://resend.com) |
| `RESEND_FROM` | `Fieldlot <onboarding@yourdomain.com>` |

**За AI чат (поне един):**

| Key | Пример |
|-----|--------|
| `MISTRAL_API_KEY` | … |
| или `OPENAI_API_KEY` | … |

**Опционално:**

| Key | Описание |
|-----|----------|
| `FIELDLOT_STORE_LEADS` | `1` — не работи на Vercel serverless (няма persistent disk); за лог ползвай Resend |

### 4. След deploy

- Начало: `https://твой-проект.vercel.app/`
- Каталог: `https://твой-проект.vercel.app/catalog.html` или `/catalog`
- API: `/api/fieldlot-chat`, `/api/register-interest`

**FastAPI** (`/api/v1`, Python backend) **не** се хоства на този Vercel проект — отделно Railway/Render, ако го искаш по-късно.

### 5. CLI (по избор)

```bash
npm i -g vercel
cd fieldlot
vercel login
vercel link
vercel --prod
```

## SQL

`supabase-fieldlot-listings.sql` — бъдеща фаза (обяви), не е вързана към текущия лендинг.
