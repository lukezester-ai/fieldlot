from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models import ExportRequest, User
from app.schemas import ExportRequestCreate, ExportRequestOut

router = APIRouter(prefix="/export", tags=["export"])

MARKETS = [
	{"code": "AE", "name": "UAE / Dubai", "certifications": ["ISO", "HALAL", "Origin"]},
	{"code": "QA", "name": "Qatar", "certifications": ["ISO", "HALAL"]},
	{"code": "SA", "name": "Saudi Arabia", "certifications": ["HALAL", "ISO", "SASO"]},
	{"code": "DE", "name": "Germany", "certifications": ["EU Organic", "ISO", "GAP"]},
	{"code": "NL", "name": "Netherlands", "certifications": ["EU Export", "ISO"]},
]


@router.get("/markets")
def list_markets():
	return {"markets": MARKETS}


@router.post("/requests", response_model=ExportRequestOut, status_code=status.HTTP_201_CREATED)
def create_export_request(
	body: ExportRequestCreate,
	db: Annotated[Session, Depends(get_db)],
	user: Annotated[User | None, Depends(get_optional_user)] = None,
):
	row = ExportRequest(
		user_id=user.id if user else None,
		country=body.country,
		product_name=body.product_name,
		requested_quantity=body.requested_quantity,
		price_offer=body.price_offer,
		certification=body.certification,
		status="open",
	)
	db.add(row)
	db.commit()
	db.refresh(row)
	return row


@router.get("/requests", response_model=list[ExportRequestOut])
def list_export_requests(
	db: Annotated[Session, Depends(get_db)],
	user: Annotated[User, Depends(get_current_user)],
):
	q = db.query(ExportRequest)
	if user.role != "admin":
		q = q.filter(ExportRequest.user_id == user.id)
	return q.order_by(ExportRequest.created_at.desc()).limit(100).all()
