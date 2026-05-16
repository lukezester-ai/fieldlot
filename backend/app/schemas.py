from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenOut(BaseModel):
	access_token: str
	token_type: str = "bearer"


class UserRegister(BaseModel):
	name: str = Field(min_length=2, max_length=120)
	email: EmailStr
	password: str = Field(min_length=8, max_length=128)
	role: Literal["farmer", "buyer", "logistics", "admin"] = "farmer"
	country: str = "BG"
	phone: str | None = None


class UserLogin(BaseModel):
	email: EmailStr
	password: str


class UserOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	name: str
	email: str
	role: str
	country: str
	phone: str | None
	profile_image: str | None
	verified: bool
	trust_score: float
	successful_deals: int
	created_at: datetime


class ProductCreate(BaseModel):
	title: str
	description: str | None = None
	category: str
	price: float | None = None
	quantity: float | None = None
	unit: str = "kg"
	region: str | None = None
	images: list[str] = Field(default_factory=list)
	videos: list[str] = Field(default_factory=list)
	certifications: list[str] = Field(default_factory=list)
	blockchain_trace: dict[str, Any] | None = None


class ProductUpdate(BaseModel):
	title: str | None = None
	description: str | None = None
	category: str | None = None
	price: float | None = None
	quantity: float | None = None
	unit: str | None = None
	region: str | None = None
	images: list[str] | None = None
	videos: list[str] | None = None
	certifications: list[str] | None = None
	status: str | None = None


class ProductOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	user_id: str
	title: str
	description: str | None
	category: str
	price: float | None
	quantity: float | None
	unit: str
	region: str | None
	images: list | None
	videos: list | None
	certifications: list | None
	ai_rank_score: float
	status: str
	created_at: datetime
	seller_name: str | None = None
	seller_trust: float | None = None


class OrderCreate(BaseModel):
	product_id: str
	quantity: float = Field(gt=0)


class OrderOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	buyer_id: str
	product_id: str
	quantity: float
	total_price: float | None
	status: str
	created_at: datetime


class LogisticsCreate(BaseModel):
	order_id: str
	driver_name: str | None = None
	vehicle_type: str | None = None
	location: str | None = None


class LogisticsOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	order_id: str
	driver_name: str | None
	vehicle_type: str | None
	tracking_code: str | None
	delivery_status: str
	location: str | None
	created_at: datetime


class ChatCreate(BaseModel):
	receiver_id: str
	message: str = Field(min_length=1, max_length=4000)
	attachment: str | None = None


class ChatOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	sender_id: str
	receiver_id: str
	message: str
	attachment: str | None
	created_at: datetime


class ExportRequestCreate(BaseModel):
	country: str
	product_name: str
	requested_quantity: float = Field(gt=0)
	price_offer: float | None = None
	certification: str | None = None


class ExportRequestOut(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	country: str
	product_name: str
	requested_quantity: float
	price_offer: float | None
	certification: str | None
	status: str
	created_at: datetime


class WarehouseCreate(BaseModel):
	name: str
	location: str | None = None
	temperature_c: float | None = None
	capacity_tons: float | None = None


class InventoryCreate(BaseModel):
	product_name: str
	quantity: float = Field(gt=0)
	unit: str = "t"
	expires_at: datetime | None = None


class DocumentGenerate(BaseModel):
	doc_type: Literal["invoice", "contract", "waybill", "certificate"]
	party_name: str
	product_name: str
	quantity: float
	unit: str = "t"
	price: float | None = None
	notes: str | None = None


class PriceForecastOut(BaseModel):
	commodity: str
	current_price: float
	forecast_price: float
	horizon_months: int
	change_pct: float
	drop_probability_pct: float
	trend: str
	summary: str


class CropAnalysisOut(BaseModel):
	diagnosis: str
	confidence: float
	recommendations: list[str]
	risk_level: str


class CalculatorFertilizerIn(BaseModel):
	area_ha: float = Field(gt=0)
	crop: str
	nitrogen_kg_per_ha: float = Field(ge=0)


class CalculatorProfitIn(BaseModel):
	revenue: float
	seed_cost: float = 0
	fertilizer_cost: float = 0
	fuel_cost: float = 0
	labor_cost: float = 0
	other_cost: float = 0


class TrustScoreOut(BaseModel):
	user_id: str
	trust_score: float
	successful_deals: int
	verified: bool
	rating_label: str
	history_summary: str
