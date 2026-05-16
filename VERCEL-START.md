# Fieldlot — Vercel от нулата

Repo: **https://github.com/roxsonltd-droid/fieldlot**

---

## Стъпка 0 — Изчисти старото (ако има объркване)

В [vercel.com/dashboard](https://vercel.com/dashboard):

1. Отвори грешните проекти (напр. 2 services: backend + frontend).
2. **Settings** → най-долу **Delete Project**.
3. Остави само един чист import по-долу.

---

## Стъпка 1 — Нов import

Отвори директно:

**https://vercel.com/new/import?s=https://github.com/roxsonltd-droid/fieldlot**

- Account: **roxsonltd-droid**
- Repo: **fieldlot**
- Branch: **main**

---

## Стъпка 2 — Настройки (много важно)

| Поле | Стойност |
|------|----------|
| **Application Preset** | **Other** (най-сигурно) или **Vite** |
| **Root Directory** | `.` (празно / root) |

### Ако виждаш дърво `backend` (FastAPI) + `frontend` (Vite)

1. **Махни backend услугата** — иконка кош / Remove до `backend` (остави само `frontend` на `/`).
2. Или смени preset на **Other** и провери, че deploy-ва само root.
3. Python API е в `dev/backend/` — **не** се качва на Vercel.
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install --no-audit --no-fund` |

Ако виждаш **2 услуги** (backend + frontend) — върни се и смени preset на **Other**.

---

## Стъпка 3 — Environment Variables

Добави **преди** Deploy (Production + Preview):

| Key | Пример | Защо |
|-----|--------|------|
| `FIELDLOT_INBOX_EMAIL` | `info@agrinexus.eu` | Получател на формата |
| `RESEND_API_KEY` | `re_...` | Изпращане на имейл ([resend.com](https://resend.com)) |
| `RESEND_FROM` | `Fieldlot <onboarding@yourdomain.com>` | Подател (верифициран домейн в Resend) |
| `MISTRAL_API_KEY` | `...` | AI чат *(или `OPENAI_API_KEY`)* |

**Минимум за тест:** `FIELDLOT_INBOX_EMAIL` + един LLM ключ.

---

## Стъпка 4 — Deploy

Натисни **Deploy** и изчакай build да стане **Ready**.

---

## Стъпка 5 — Проверка

Замени `YOUR-URL` с production домейна от Vercel:

| URL | Очаквано |
|-----|----------|
| `YOUR-URL/` | Начална страница, **без** жълт offline banner |
| `YOUR-URL/catalog.html` | Демо каталог |
| `YOUR-URL/api/fieldlot-chat` | JSON: `"ok": true` |
| AI чат | Статус не е „offline“ |

---

## Какво НЕ е на Vercel

| Част | Къде |
|------|------|
| Python `backend/` (FastAPI) | Само локално: `npm run backend:dev` |
| `/api/v1/*` | Railway/Render по-късно, ако искаш |

На Vercel работят само:

- Статичен сайт от `dist/`
- `/api/fieldlot-chat`
- `/api/register-interest`

---

## Ако build падне

1. **Deployments** → failed deploy → **Building** лог.
2. Чести причини: грешен Output (`dist` не `build`), preset „Services“, липсва `npm run build`.
3. Локален тест: `npm install && npm run build` — трябва да мине.

---

## Redeploy след env vars

**Project → Settings → Environment Variables** → добави ключове →  
**Deployments** → ⋯ → **Redeploy**.
