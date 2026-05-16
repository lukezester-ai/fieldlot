# Vercel import — ВАЖНО

## Не ползвай preset „Services“

Ако Vercel показва **backend (FastAPI)** + **frontend (Vite)** като две отделни услуги — **спри**.

Fieldlot на Vercel е **един проект**:

| Част | Как се хоства |
|------|----------------|
| Сайт (`index.html`, `catalog.html`) | Static build → папка `dist` |
| `/api/fieldlot-chat`, `/api/register-interest` | Serverless functions в `api/*.ts` |
| Python `backend/` | **НЕ** на Vercel (локално / Railway по-късно) |

## Правилни стъпки

1. **Application Preset** → избери **Other** (не „Services“).
2. **Root Directory** → `.` (корен на repo).
3. Потвърди от `vercel.json`:
   - Build: `npm run build`
   - Output: `dist`
4. **Environment Variables** → виж README.md
5. **Deploy**

## Ако си вече в „Services“

- Върни се назад / смени preset на **Other**
- Или импортирай отново:  
  https://vercel.com/new/import?s=https://github.com/roxsonltd-droid/fieldlot

## След deploy

- `/` — начало
- `/catalog.html` — каталог
- `/api/*` — форма + AI (с env keys)
