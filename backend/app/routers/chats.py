from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Chat, User
from app.schemas import ChatCreate, ChatOut

router = APIRouter(prefix="/chats", tags=["chats"])


@router.post("", response_model=ChatOut, status_code=201)
def send_message(
	body: ChatCreate,
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
):
	receiver = db.get(User, body.receiver_id)
	if not receiver:
		raise HTTPException(status_code=404, detail="Receiver not found")
	msg = Chat(
		sender_id=user.id,
		receiver_id=body.receiver_id,
		message=body.message.strip(),
		attachment=body.attachment,
	)
	db.add(msg)
	db.commit()
	db.refresh(msg)
	return msg


@router.get("", response_model=list[ChatOut])
def list_messages(
	user: Annotated[User, Depends(get_current_user)],
	db: Annotated[Session, Depends(get_db)],
	with_user: str | None = None,
	limit: int = Query(50, le=200),
):
	stmt = select(Chat).where(or_(Chat.sender_id == user.id, Chat.receiver_id == user.id))
	if with_user:
		stmt = stmt.where(
			or_(
				(Chat.sender_id == user.id) & (Chat.receiver_id == with_user),
				(Chat.sender_id == with_user) & (Chat.receiver_id == user.id),
			)
		)
	stmt = stmt.order_by(Chat.created_at.desc()).limit(limit)
	return list(reversed(db.scalars(stmt).all()))
