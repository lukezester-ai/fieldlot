import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Logistics, Order, Product, User
from app.schemas import LogisticsCreate, LogisticsOut

router = APIRouter(prefix="/logistics", tags=["logistics"])


@router.post("", response_model=LogisticsOut, status_code=status.HTTP_201_CREATED)
def create_logistics(
	body: LogisticsCreate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	order = db.get(Order, body.order_id)
	if not order:
		raise HTTPException(status_code=404, detail="Order not found")
	product = db.get(Product, order.product_id)
	if not product:
		raise HTTPException(status_code=404, detail="Product not found")
	if user.role not in ("logistics", "admin") and product.user_id != user.id and order.buyer_id != user.id:
		raise HTTPException(status_code=403, detail="Not allowed")
	existing = db.query(Logistics).filter(Logistics.order_id == body.order_id).first()
	if existing:
		raise HTTPException(status_code=400, detail="Logistics already exists")
	tracking = "FL-" + secrets.token_hex(4).upper()
	row = Logistics(
		order_id=body.order_id,
		driver_name=body.driver_name,
		vehicle_type=body.vehicle_type,
		tracking_code=tracking,
		delivery_status="requested",
		location=body.location,
	)
	db.add(row)
	db.commit()
	db.refresh(row)
	return row


@router.get("/track/{tracking_code}", response_model=LogisticsOut)
def track(tracking_code: str, db: Annotated[Session, Depends(get_db)]):
	row = db.query(Logistics).filter(Logistics.tracking_code == tracking_code).first()
	if not row:
		raise HTTPException(status_code=404, detail="Tracking not found")
	return row
