from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models import Product, User
from app.schemas import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


def _enrich(db: Session, p: Product) -> ProductOut:
	owner = db.get(User, p.user_id)
	out = ProductOut.model_validate(p)
	out.seller_name = owner.name if owner else None
	out.seller_trust = owner.trust_score if owner else None
	return out


@router.get("", response_model=list[ProductOut])
def list_products(
	db: Annotated[Session, Depends(get_db)],
	q: str | None = None,
	category: str | None = None,
	region: str | None = None,
	status_filter: str = Query("active", alias="status"),
	limit: int = Query(50, le=100),
	offset: int = 0,
):
	stmt = select(Product).where(Product.status == status_filter)
	if category:
		stmt = stmt.where(Product.category == category)
	if region:
		stmt = stmt.where(Product.region.ilike(f"%{region}%"))
	if q:
		like = f"%{q}%"
		stmt = stmt.where(or_(Product.title.ilike(like), Product.description.ilike(like)))
	stmt = stmt.order_by(Product.ai_rank_score.desc(), Product.created_at.desc()).offset(offset).limit(limit)
	rows = db.scalars(stmt).all()
	return [_enrich(db, p) for p in rows]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Annotated[Session, Depends(get_db)]):
	p = db.get(Product, product_id)
	if not p:
		raise HTTPException(status_code=404, detail="Product not found")
	return _enrich(db, p)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
	body: ProductCreate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	if user.role not in ("farmer", "admin"):
		raise HTTPException(status_code=403, detail="Only farmers can publish products")
	p = Product(
		user_id=user.id,
		title=body.title,
		description=body.description,
		category=body.category,
		price=body.price,
		quantity=body.quantity,
		unit=body.unit,
		region=body.region,
		images=body.images,
		videos=body.videos,
		certifications=body.certifications,
		blockchain_trace=body.blockchain_trace,
		ai_rank_score=min(5.0, 3.5 + user.trust_score * 0.2),
	)
	db.add(p)
	db.commit()
	db.refresh(p)
	return _enrich(db, p)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
	product_id: str,
	body: ProductUpdate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	p = db.get(Product, product_id)
	if not p:
		raise HTTPException(status_code=404, detail="Product not found")
	if p.user_id != user.id and user.role != "admin":
		raise HTTPException(status_code=403, detail="Not allowed")
	for k, v in body.model_dump(exclude_unset=True).items():
		setattr(p, k, v)
	db.commit()
	db.refresh(p)
	return _enrich(db, p)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
	product_id: str,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	p = db.get(Product, product_id)
	if not p:
		raise HTTPException(status_code=404, detail="Product not found")
	if p.user_id != user.id and user.role != "admin":
		raise HTTPException(status_code=403, detail="Not allowed")
	p.status = "archived"
	db.commit()
