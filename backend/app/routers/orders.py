from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Order, Product, User
from app.schemas import OrderCreate, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])

ALLOWED_STATUS = {"pending", "active", "shipped", "delivered", "cancelled"}


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
	body: OrderCreate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	product = db.get(Product, body.product_id)
	if not product or product.status != "active":
		raise HTTPException(status_code=404, detail="Product not available")
	if product.user_id == user.id:
		raise HTTPException(status_code=400, detail="Cannot order own product")
	total = None
	if product.price is not None:
		total = round(product.price * body.quantity, 2)
	order = Order(
		buyer_id=user.id,
		product_id=product.id,
		quantity=body.quantity,
		total_price=total,
		status="pending",
	)
	db.add(order)
	db.commit()
	db.refresh(order)
	return order


@router.get("", response_model=list[OrderOut])
def my_orders(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
	rows = db.scalars(select(Order).where(Order.buyer_id == user.id).order_by(Order.created_at.desc())).all()
	return rows


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_status(
	order_id: str,
	new_status: str,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	if new_status not in ALLOWED_STATUS:
		raise HTTPException(status_code=400, detail="Invalid status")
	order = db.get(Order, order_id)
	if not order:
		raise HTTPException(status_code=404, detail="Order not found")
	product = db.get(Product, order.product_id)
	if not product:
		raise HTTPException(status_code=404, detail="Product not found")
	is_seller = product.user_id == user.id
	is_buyer = order.buyer_id == user.id
	if not is_seller and not is_buyer and user.role != "admin":
		raise HTTPException(status_code=403, detail="Not allowed")
	order.status = new_status
	if new_status == "delivered" and is_seller:
		seller = db.get(User, product.user_id)
		if seller:
			seller.successful_deals += 1
			seller.trust_score = min(5.0, seller.trust_score + 0.05)
	db.commit()
	db.refresh(order)
	return order
