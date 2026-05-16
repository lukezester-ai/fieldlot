# Fieldlot — Vercel от нулата

**Препоръчително (lukezester):**

| | URL |
|---|-----|
| **GitHub** | https://github.com/lukezester-ai/fieldlot *(създай празно repo, после `git push`)* |
| **Vercel team** | **roxsonltd-droid** (Hobby, акаунт `lukezester-8211`) |
| **Production** | https://fieldlot-two.vercel.app |
| **Dashboard** | https://vercel.com/roxsonltd-droid-250ad223/fieldlot |

Резервно (org, изисква Pro за Git import): https://github.com/roxsonltd-droid/fieldlot

---

## GitHub под lukezester-ai (веднъж)

1. https://github.com/new → Owner: **lukezester-ai** → име **fieldlot** → **Create** (без README)
2. В PowerShell:

```powershell
cd "C:\Users\expre\OneDrive\Desktop\проект\fieldlot"
git remote set-url origin https://github.com/lukezester-ai/fieldlot.git
git remote add roxson https://github.com/roxsonltd-droid/fieldlot.git 2>$null
git push -u origin main
```

3. Vercel → **fieldlot** → **Settings → Git** → Connect **lukezester-ai/fieldlot**

---

## Стъпка 0 — Изчисти старото (ако има объркване)

В [vercel.com/dashboard](https://vercel.com/dashboard):

1. Отвори грешните проекти (напр. 2 services: backend + frontend).
2. **Settings** → най-долу **Delete Project**.
3. Остави само един чист import по-долу.

---

## Стъпка 1 — GitHub integration (ако видиш червен error)

Съобщение: *„you need to install the GitHub integration first“*

1. Отвори: **https://github.com/apps/vercel**
2. **Configure** → избери акаунт **`roxsonltd-droid`**
3. **Repository access** → **Only select repositories** → маркирай **`fieldlot`**
4. **Save** / **Install & Authorize**
5. В Vercel: **Settings → Git** → **Connect GitHub** (ако още не е свързан)

**Важно:** Repo е на **`roxsonltd-droid`**. Team **AgriNexus projects** трябва също да има достъп — или deploy-вай от **личния team** на `roxsonltd-droid` (Hobby), не от AgriNexus, докато не дадеш достъп на org-а.

### Сив box: „GitHub organization requires Vercel Pro“

Ако `roxsonltd-droid` е **GitHub Organization** (не личен акаунт), **Hobby не може** Git import от org repo.

**Работещи варианти (без Pro):**

| Вариант | Как |
|--------|-----|
| **A — Vercel CLI** | Deploy директно от компютъра (по-долу) — **най-бързо** |
| **B — Pro team** | Import под **AgriNexus projects** (Pro), след GitHub App за org |
| **C — Личен GitHub** | Копирай/прехвърли repo под **личен** GitHub user (не org) |

---

## Стъпка 2 — Нов import

**https://vercel.com/new/import?s=https://github.com/roxsonltd-droid/fieldlot**

- GitHub account: **roxsonltd-droid**
- Repo: **fieldlot**
- Branch: **main**
- Team: предпочитай **roxsonltd-droid** (личен), ако AgriNexus дава permission error

---

## Алтернатива A — Deploy без GitHub import (CLI) — препоръчително при Hobby + org

Това **заобикаля** „organization requires Pro“.

```powershell
cd "C:\Users\expre\OneDrive\Desktop\проект\fieldlot"
npx vercel login
npx vercel teams switch roxsonltd-droid-250ad223
npx vercel link --yes --scope roxsonltd-droid-250ad223 --project fieldlot
npx vercel --prod --yes --scope roxsonltd-droid-250ad223
```

След първия deploy:

1. **https://vercel.com** → проект **fieldlot** → **Settings** → **Environment Variables**
2. Добави `FIELDLOT_INBOX_EMAIL`, `RESEND_*`, `MISTRAL_API_KEY`
3. **Deployments** → **Redeploy**

По-късно можеш да свържеш Git от Dashboard (ако вземеш Pro или преместиш repo).

## Алтернатива B — AgriNexus Pro team

Ако имаш **AgriNexus projects (Pro)**:

1. На import избери team **AgriNexus projects** (не Hobby)
2. Инсталирай GitHub App за org `roxsonltd-droid`
3. Import `fieldlot`

---

## Стъпка 3 — Настройки (много важно)

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

## Стъпка 4 — Environment Variables

Добави **преди** Deploy (Production + Preview):

| Key | Пример | Защо |
|-----|--------|------|
| `FIELDLOT_INBOX_EMAIL` | `info@agrinexus.eu` | Получател на формата |
| `RESEND_API_KEY` | `re_...` | Изпращане на имейл ([resend.com](https://resend.com)) |
| `RESEND_FROM` | `Fieldlot <onboarding@yourdomain.com>` | Подател (верифициран домейн в Resend) |
| `MISTRAL_API_KEY` | `...` | AI чат *(или `OPENAI_API_KEY`)* |

**Минимум за тест:** `FIELDLOT_INBOX_EMAIL` + един LLM ключ.

---

## Стъпка 5 — Deploy

Натисни **Deploy** и изчакай build да стане **Ready**.

---

## Стъпка 6 — Проверка

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
