# Fieldlot

Самостоятелен лендинг и API за B2B агро оферти в България. **Няма връзка с AgriNexus** — отделен проект.

## Старт

```bash
npm install
npm run dev
```

Отвори http://localhost:5174 — Vite проксира `/api` към dev API (порт 8789).

## API

- `GET/POST /api/fieldlot-chat` — AI водач (Mistral / OpenAI / Ollama)
- `POST /api/register-interest` — форма за ранен достъп

Виж `.env.example`. Контакт във футъра: `contact@fieldlot.bg` (смени при нужда) или `FIELDLOT_INBOX_EMAIL` за формата.
