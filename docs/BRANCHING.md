# Git клонове — Fieldlot отделно от `main`

Репото е самостоятелно: https://github.com/lukezester-ai/fieldlot

## Клон `fieldlot` (основен за разработка)

- Съдържа същата история като `main` към момента на създаване; нататък **новите commit-и се правят тук**.
- `main` може да остане замразен / само за архив или за стари линкове.

## 1. Default branch в GitHub (препоръчително)

1. Отвори: https://github.com/lukezester-ai/fieldlot/settings  
2. **General** → секция **Default branch** → **Switch to another branch**  
3. Избери **`fieldlot`** → потвърди.

След това `git clone` по подразбиране ще взима `fieldlot`, а PR базата ще е по-ясна.

## 2. Vercel — production от `fieldlot`

1. [Vercel](https://vercel.com) → проект **fieldlot** → **Settings** → **Git**  
2. **Production Branch** → задай **`fieldlot`** (вместо `main`).  
3. Запази; при нужда **Redeploy** от последния commit на `fieldlot`.

## 3. Локално

```bash
git fetch origin
git checkout fieldlot
git pull origin fieldlot
```

## 4. Стар клон `sync/agrinexus-final-*`

Ако вече не синхронизираш с AgriNexus, можеш да изтриеш remote клона от GitHub (**Branches** → delete). Това не пипа `main`/`fieldlot`, само премахва стария sync.

## 5. Месечно: `fieldlot` → `main` (синхрон на стабилна линия)

**Идея:** дневна работа на **`fieldlot`**; **веднъж месечно** качваш същото състояние и на **`main`** (за архив, външни интеграции или ако някой още гледа само `main`).

### Вариант A — Pull Request (препоръчително)

1. GitHub → **Pull requests** → **New pull request**  
2. **base:** `main` ← **compare:** `fieldlot`  
3. Прегледай diff → **Merge** (merge commit или squash по избор).

### Вариант B — локално

```bash
git fetch origin
git checkout main
git pull origin main
git merge origin/fieldlot -m "chore: monthly sync fieldlot → main"
git push origin main
git checkout fieldlot
```

### Напомняне

Сложи си календарно събитие (напр. „Fieldlot: merge fieldlot→main“) в **първия работен ден на месеца** или фиксирана дата.
