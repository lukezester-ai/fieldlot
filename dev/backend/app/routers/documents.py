from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, User
from app.schemas import DocumentGenerate

router = APIRouter(prefix="/documents", tags=["documents"])

TEMPLATES = {
	"invoice": "ФАКТУРА",
	"contract": "ДОГОВОР ЗА ДОСТАВКА",
	"waybill": "ТОВАРИТЕЛНИЦА",
	"certificate": "СЕРТИФИКАТ ЗА ПРОИЗХОД",
}


@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_document(
	body: DocumentGenerate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
	title = TEMPLATES[body.doc_type]
	payload = {
		"header": title,
		"date": now,
		"seller": user.name,
		"party": body.party_name,
		"product": body.product_name,
		"quantity": body.quantity,
		"unit": body.unit,
		"price": body.price,
		"notes": body.notes,
		"disclaimer": "Демо документ — не е правен документ без подпис.",
	}
	doc = Document(
		user_id=user.id,
		doc_type=body.doc_type,
		title=f"{title} — {body.product_name}",
		payload=payload,
	)
	db.add(doc)
	db.commit()
	db.refresh(doc)
	return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type, "payload": doc.payload}


@router.get("")
def list_documents(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
	rows = db.query(Document).filter(Document.user_id == user.id).order_by(Document.created_at.desc()).limit(50).all()
	return [{"id": r.id, "title": r.title, "doc_type": r.doc_type, "created_at": r.created_at} for r in rows]
