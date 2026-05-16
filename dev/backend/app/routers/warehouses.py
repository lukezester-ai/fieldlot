from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Warehouse, WarehouseInventory
from app.schemas import InventoryCreate, WarehouseCreate
from pydantic import BaseModel, ConfigDict
from datetime import datetime

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


class WarehouseOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)
	id: str
	user_id: str
	name: str
	location: str | None
	temperature_c: float | None
	capacity_tons: float | None
	created_at: datetime


class InventoryOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)
	id: str
	warehouse_id: str
	product_name: str
	quantity: float
	unit: str
	expires_at: datetime | None
	created_at: datetime


@router.get("", response_model=list[WarehouseOut])
def list_warehouses(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
	return db.query(Warehouse).filter(Warehouse.user_id == user.id).all()


@router.post("", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
def create_warehouse(
	body: WarehouseCreate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	w = Warehouse(user_id=user.id, **body.model_dump())
	db.add(w)
	db.commit()
	db.refresh(w)
	return w


@router.post("/{warehouse_id}/inventory", response_model=InventoryOut, status_code=201)
def add_inventory(
	warehouse_id: str,
	body: InventoryCreate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	w = db.get(Warehouse, warehouse_id)
	if not w or w.user_id != user.id:
		raise HTTPException(status_code=404, detail="Warehouse not found")
	inv = WarehouseInventory(warehouse_id=warehouse_id, **body.model_dump())
	db.add(inv)
	db.commit()
	db.refresh(inv)
	return inv


@router.get("/{warehouse_id}/inventory", response_model=list[InventoryOut])
def list_inventory(warehouse_id: str, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
	w = db.get(Warehouse, warehouse_id)
	if not w or w.user_id != user.id:
		raise HTTPException(status_code=404, detail="Warehouse not found")
	return db.query(WarehouseInventory).filter(WarehouseInventory.warehouse_id == warehouse_id).all()
