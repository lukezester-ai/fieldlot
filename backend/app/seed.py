import json
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import MarketPrice, Product, User
from app.security import hash_password

DEMO_PASSWORD = "FieldlotDemo1!"


def seed_if_empty() -> None:
	db = SessionLocal()
	try:
		if db.scalar(select(User).limit(1)):
			return

		farmer = User(
			name="Иван Петров (демо)",
			email="farmer@fieldlot.demo",
			password_hash=hash_password(DEMO_PASSWORD),
			role="farmer",
			country="BG",
			phone="+359888000001",
			verified=True,
			trust_score=4.9,
			successful_deals=12,
		)
		buyer = User(
			name="Агро Трейд ООД",
			email="buyer@fieldlot.demo",
			password_hash=hash_password(DEMO_PASSWORD),
			role="buyer",
			country="BG",
			verified=True,
			trust_score=4.6,
		)
		logistics_user = User(
			name="Транспорт БГ",
			email="logistics@fieldlot.demo",
			password_hash=hash_password(DEMO_PASSWORD),
			role="logistics",
			country="BG",
		)
		db.add_all([farmer, buyer, logistics_user])
		db.flush()

		listings_path = Path(__file__).resolve().parents[2] / "data" / "demo-listings.json"
		if listings_path.is_file():
			raw = json.loads(listings_path.read_text(encoding="utf-8"))
			for item in raw:
				price = None
				try:
					if item.get("price") and str(item["price"]).replace(".", "").isdigit():
						price = float(item["price"])
				except (TypeError, ValueError):
					price = None
				qty = item.get("qty", "")
				quantity = None
				if isinstance(qty, str):
					num = "".join(c for c in qty if c.isdigit() or c == ".")
					if num:
						try:
							quantity = float(num)
						except ValueError:
							pass
				db.add(
					Product(
						user_id=farmer.id,
						title=item.get("title", "Продукт"),
						description=item.get("quality"),
						category=item.get("category", "grain"),
						price=price,
						quantity=quantity,
						unit=item.get("priceUnit", "т").replace("лв/", "").strip() or "t",
						region=item.get("subtitle"),
						images=[],
						certifications=item.get("tags") or [],
						ai_rank_score=4.2,
						status="active",
					)
				)

		for row in [
			("Пшеница", 410, "лв/тон", 3.0),
			("Слънчоглед", 920, "лв/тон", -1.2),
			("Царевица", 380, "лв/тон", 1.1),
			("Рапица", 510, "лв/тон", -0.5),
		]:
			db.add(MarketPrice(commodity=row[0], price=row[1], unit=row[2], change_pct=row[3]))

		db.commit()
		print("[fieldlot-api] Seeded demo users, products, market prices")
	finally:
		db.close()
