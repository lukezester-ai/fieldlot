from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
	ai,
	auth,
	calculators,
	chats,
	documents,
	export_hub,
	logistics,
	market,
	orders,
	products,
	trust,
	upload,
	warehouses,
)
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
	Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
	init_db()
	seed_if_empty()
	yield


app = FastAPI(
	title="FIELDLOT API",
	description="Smart Agriculture Marketplace — MVP backend",
	version="1.0.0",
	lifespan=lifespan,
	docs_url="/docs",
	redoc_url="/redoc",
)

app.add_middleware(
	CORSMiddleware,
	allow_origins=settings.cors_origin_list,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(products.router, prefix=API_PREFIX)
app.include_router(orders.router, prefix=API_PREFIX)
app.include_router(logistics.router, prefix=API_PREFIX)
app.include_router(chats.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)
app.include_router(market.router, prefix=API_PREFIX)
app.include_router(export_hub.router, prefix=API_PREFIX)
app.include_router(upload.router, prefix=API_PREFIX)
app.include_router(warehouses.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(trust.router, prefix=API_PREFIX)
app.include_router(calculators.router, prefix=API_PREFIX)


@app.get("/")
def root():
	return {
		"service": "fieldlot-api",
		"version": "1.0.0",
		"docs": "/docs",
		"api": API_PREFIX,
	}


@app.get("/health")
def health():
	return {"ok": True}
