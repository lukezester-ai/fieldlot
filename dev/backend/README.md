# FIELDLOT FastAPI Backend

Smart agriculture marketplace API (MVP).

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
```

## Run

From repo root (with `npm run dev`) or standalone:

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Swagger:** http://127.0.0.1:8000/docs  
- **API base:** `/api/v1`  
- **Via Vite:** http://localhost:5174/api/v1/... (proxied)

## Demo accounts (auto-seed on first start)

| Email | Password | Role |
|-------|----------|------|
| farmer@fieldlot.demo | FieldlotDemo1! | farmer |
| buyer@fieldlot.demo | FieldlotDemo1! | buyer |
| logistics@fieldlot.demo | FieldlotDemo1! | logistics |

## Main endpoints

| Area | Examples |
|------|----------|
| Auth | `POST /api/v1/auth/register`, `login`, `GET /me` |
| Products | `GET/POST /api/v1/products` |
| Orders | `POST /api/v1/orders` |
| Logistics | `POST /api/v1/logistics`, `GET /track/{code}` |
| Chats | `POST/GET /api/v1/chats` |
| AI | `GET /api/v1/ai/price-forecast/{commodity}`, `POST /analyze-crop` |
| Market | `GET /api/v1/market/prices` |
| Export | `GET /api/v1/export/markets`, `POST /requests` |
| Warehouses | `GET/POST /api/v1/warehouses` |
| Documents | `POST /api/v1/documents/generate` |
| Trust | `GET /api/v1/trust/users/{id}` |
| Calculators | `POST /api/v1/calculators/profit` |

## PostgreSQL

Set in `.env`:

```
DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/fieldlot
```

Apply `sql/schema.postgresql.sql` on Supabase/Railway.

## Tests

```bash
# Terminal 1: backend running
npm run backend:dev
# Terminal 2
npm run test:backend
```
