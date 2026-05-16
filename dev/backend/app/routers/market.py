from datetime import datetime, timezone
import random
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MarketPrice

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/prices")
def live_prices(db: Annotated[Session, Depends(get_db)]):
	rows = db.query(MarketPrice).all()
	if not rows:
		return {"updated_at": datetime.now(timezone.utc).isoformat(), "items": []}
	# Slight live jitter for demo
	items = []
	for r in rows:
		jitter = random.uniform(-0.005, 0.005)
		price = round(r.price * (1 + jitter), 2)
		items.append(
			{
				"commodity": r.commodity,
				"price": price,
				"unit": r.unit,
				"change_pct": r.change_pct,
			}
		)
	return {"updated_at": datetime.now(timezone.utc).isoformat(), "items": items}
