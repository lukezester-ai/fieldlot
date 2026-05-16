from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import TrustScoreOut

router = APIRouter(prefix="/trust", tags=["trust"])


def _label(score: float) -> str:
	if score >= 4.7:
		return "Отличен"
	if score >= 4.2:
		return "Добър"
	if score >= 3.5:
		return "Среден"
	return "Нов"


@router.get("/users/{user_id}", response_model=TrustScoreOut)
def trust_score(user_id: str, db: Annotated[Session, Depends(get_db)]):
	user = db.get(User, user_id)
	if not user:
		raise HTTPException(status_code=404, detail="User not found")
	return TrustScoreOut(
		user_id=user.id,
		trust_score=user.trust_score,
		successful_deals=user.successful_deals,
		verified=user.verified,
		rating_label=_label(user.trust_score),
		history_summary=f"{user.successful_deals} успешни сделки · {'верифициран' if user.verified else 'неверифициран'}",
	)
