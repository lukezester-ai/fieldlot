import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
	return str(uuid.uuid4())


def _utcnow() -> datetime:
	return datetime.now(timezone.utc)


class User(Base):
	__tablename__ = "users"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	name: Mapped[str] = mapped_column(Text, nullable=False)
	email: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
	password_hash: Mapped[str] = mapped_column(Text, nullable=False)
	role: Mapped[str] = mapped_column(String(32), default="farmer", index=True)
	country: Mapped[str] = mapped_column(String(64), default="BG")
	phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
	profile_image: Mapped[str | None] = mapped_column(Text, nullable=True)
	verified: Mapped[bool] = mapped_column(Boolean, default=False)
	trust_score: Mapped[float] = mapped_column(Float, default=4.5)
	successful_deals: Mapped[int] = mapped_column(Integer, default=0)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

	products: Mapped[list["Product"]] = relationship(back_populates="owner")
	orders_as_buyer: Mapped[list["Order"]] = relationship(back_populates="buyer", foreign_keys="Order.buyer_id")


class Product(Base):
	__tablename__ = "products"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
	title: Mapped[str] = mapped_column(Text, nullable=False)
	description: Mapped[str | None] = mapped_column(Text, nullable=True)
	category: Mapped[str] = mapped_column(String(64), index=True)
	price: Mapped[float | None] = mapped_column(Float, nullable=True)
	quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
	unit: Mapped[str] = mapped_column(String(32), default="kg")
	region: Mapped[str | None] = mapped_column(String(128), nullable=True)
	images: Mapped[list | None] = mapped_column(JSON, default=list)
	videos: Mapped[list | None] = mapped_column(JSON, default=list)
	certifications: Mapped[list | None] = mapped_column(JSON, default=list)
	blockchain_trace: Mapped[dict | None] = mapped_column(JSON, nullable=True)
	ai_rank_score: Mapped[float] = mapped_column(Float, default=0.0)
	status: Mapped[str] = mapped_column(String(32), default="active", index=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

	owner: Mapped["User"] = relationship(back_populates="products")
	orders: Mapped[list["Order"]] = relationship(back_populates="product")


class Order(Base):
	__tablename__ = "orders"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	buyer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
	product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
	quantity: Mapped[float] = mapped_column(Float, nullable=False)
	total_price: Mapped[float | None] = mapped_column(Float, nullable=True)
	status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

	buyer: Mapped["User"] = relationship(back_populates="orders_as_buyer", foreign_keys=[buyer_id])
	product: Mapped["Product"] = relationship(back_populates="orders")
	logistics: Mapped["Logistics | None"] = relationship(back_populates="order", uselist=False)


class Logistics(Base):
	__tablename__ = "logistics"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), unique=True)
	driver_name: Mapped[str | None] = mapped_column(Text, nullable=True)
	vehicle_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
	tracking_code: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
	delivery_status: Mapped[str] = mapped_column(String(32), default="requested")
	location: Mapped[str | None] = mapped_column(Text, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

	order: Mapped["Order"] = relationship(back_populates="logistics")


class Chat(Base):
	__tablename__ = "chats"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	sender_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
	receiver_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
	message: Mapped[str] = mapped_column(Text, nullable=False)
	attachment: Mapped[str | None] = mapped_column(Text, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AiAnalytics(Base):
	__tablename__ = "ai_analytics"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
	field_name: Mapped[str | None] = mapped_column(Text, nullable=True)
	humidity: Mapped[float | None] = mapped_column(Float, nullable=True)
	temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
	risk_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
	ai_prediction: Mapped[str | None] = mapped_column(Text, nullable=True)
	satellite_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PriceForecast(Base):
	__tablename__ = "price_forecasts"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	commodity: Mapped[str] = mapped_column(String(64), index=True)
	current_price: Mapped[float] = mapped_column(Float)
	forecast_price: Mapped[float] = mapped_column(Float)
	horizon_months: Mapped[int] = mapped_column(Integer, default=2)
	change_probability: Mapped[float] = mapped_column(Float)
	trend: Mapped[str] = mapped_column(String(16))
	notes: Mapped[str | None] = mapped_column(Text, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ExportRequest(Base):
	__tablename__ = "export_requests"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
	country: Mapped[str] = mapped_column(String(64), index=True)
	product_name: Mapped[str] = mapped_column(Text)
	requested_quantity: Mapped[float] = mapped_column(Float)
	price_offer: Mapped[float | None] = mapped_column(Float, nullable=True)
	certification: Mapped[str | None] = mapped_column(Text, nullable=True)
	status: Mapped[str] = mapped_column(String(32), default="open")
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Warehouse(Base):
	__tablename__ = "warehouses"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
	name: Mapped[str] = mapped_column(Text)
	location: Mapped[str | None] = mapped_column(Text, nullable=True)
	temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
	capacity_tons: Mapped[float | None] = mapped_column(Float, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

	inventory: Mapped[list["WarehouseInventory"]] = relationship(back_populates="warehouse")


class WarehouseInventory(Base):
	__tablename__ = "warehouse_inventory"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), index=True)
	product_name: Mapped[str] = mapped_column(Text)
	quantity: Mapped[float] = mapped_column(Float)
	unit: Mapped[str] = mapped_column(String(32), default="t")
	expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

	warehouse: Mapped["Warehouse"] = relationship(back_populates="inventory")


class Document(Base):
	__tablename__ = "documents"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
	doc_type: Mapped[str] = mapped_column(String(32), index=True)
	title: Mapped[str] = mapped_column(Text)
	payload: Mapped[dict] = mapped_column(JSON, default=dict)
	file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class MarketPrice(Base):
	__tablename__ = "market_prices"

	id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
	commodity: Mapped[str] = mapped_column(String(64), unique=True, index=True)
	price: Mapped[float] = mapped_column(Float)
	unit: Mapped[str] = mapped_column(String(32), default="лв/тон")
	change_pct: Mapped[float] = mapped_column(Float, default=0.0)
	updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
