import random
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models import AiAnalytics, MarketPrice, PriceForecast, User
from app.schemas import CropAnalysisOut, PriceForecastOut

router = APIRouter(prefix="/ai", tags=["ai"])

BASE_PRICES = {
	"пшеница": 410,
	"wheat": 410,
	"слънчоглед": 920,
	"sunflower": 920,
	"царевица": 380,
	"corn": 380,
	"рапица": 510,
	"rapeseed": 510,
	"домати": 1.8,
	"tomato": 1.8,
}


def _normalize_commodity(name: str) -> str:
	return name.strip().lower()


@router.get("/price-forecast/{commodity}", response_model=PriceForecastOut)
def price_forecast(
	commodity: str,
	db: Annotated[Session, Depends(get_db)],
	months: int = Query(2, ge=1, le=12),
	_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
	key = _normalize_commodity(commodity)
	current = BASE_PRICES.get(key)
	if current is None:
		row = db.query(MarketPrice).filter(MarketPrice.commodity.ilike(f"%{commodity}%")).first()
		current = row.price if row else 400.0
	# Demo model: seasonal drift + noise
	drift = random.uniform(-0.08, 0.12) * months
	forecast = round(current * (1 + drift), 2)
	change_pct = round((forecast - current) / current * 100, 1)
	drop_prob = round(max(0, min(95, 50 - change_pct * 3 + random.uniform(-5, 5))), 1)
	trend = "up" if change_pct > 0.5 else "down" if change_pct < -0.5 else "flat"
	summary_bg = (
		f"Очаквана цена на {commodity} след {months} мес.: ~{forecast} "
		f"({'+' if change_pct > 0 else ''}{change_pct}%). "
		f"Вероятност за спад: ~{drop_prob}%."
	)
	# Persist snapshot
	db.add(
		PriceForecast(
			commodity=commodity,
			current_price=current,
			forecast_price=forecast,
			horizon_months=months,
			change_probability=drop_prob / 100,
			trend=trend,
			notes=summary_bg,
		)
	)
	db.commit()
	return PriceForecastOut(
		commodity=commodity,
		current_price=current,
		forecast_price=forecast,
		horizon_months=months,
		change_pct=change_pct,
		drop_probability_pct=drop_prob,
		trend=trend,
		summary=summary_bg,
	)


@router.post("/analyze-crop", response_model=CropAnalysisOut)
async def analyze_crop(
	db: Annotated[Session, Depends(get_db)],
	file: UploadFile = File(...),
	crop_hint: str | None = None,
	user: Annotated[User | None, Depends(get_optional_user)] = None,
):
	if not file.content_type or not file.content_type.startswith("image/"):
		raise HTTPException(status_code=400, detail="Image file required")
	_ = await file.read()
	# Phase 2: OpenAI vision. MVP: heuristic demo.
	hint = (crop_hint or "домати").lower()
	if "домат" in hint or "tomato" in hint:
		diagnosis = "Възможен манов ръжда или дефицит на калий (демо анализ)."
		recs = ["Проверете долните листа", "Проба за гъбички", "Балансирано торене"]
	elif "пшен" in hint or "wheat" in hint:
		diagnosis = "Ранни признаци на стрес от суша (демо)."
		recs = ["Проверка на влажността на почвата", "NDVI мониторинг"]
	else:
		diagnosis = "Няма ясен паттерн — качете по-ясна снимка (демо)."
		recs = ["Снимка при дневна светлина", "Крупен план на засегнатата зона"]
	confidence = round(random.uniform(0.62, 0.88), 2)
	risk = "medium" if confidence < 0.75 else "low"
	if user:
		db.add(
			AiAnalytics(
				user_id=user.id,
				field_name=crop_hint,
				risk_level=risk,
				ai_prediction=diagnosis,
				satellite_data={"ndvi": round(random.uniform(0.4, 0.85), 2)},
			)
		)
		db.commit()
	return CropAnalysisOut(
		diagnosis=diagnosis,
		confidence=confidence,
		recommendations=recs,
		risk_level=risk,
	)


@router.get("/ranking/products")
def ai_product_ranking(db: Annotated[Session, Depends(get_db)], limit: int = 20):
	from app.models import Product
	from app.routers.products import _enrich

	rows = db.query(Product).filter(Product.status == "active").order_by(Product.ai_rank_score.desc()).limit(limit).all()
	return {"items": [_enrich(db, p) for p in rows]}
