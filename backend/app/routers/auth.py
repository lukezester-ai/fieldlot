from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import TokenOut, UserLogin, UserOut, UserRegister
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: UserRegister, db: Annotated[Session, Depends(get_db)]):
	existing = db.scalar(select(User).where(User.email == body.email.lower()))
	if existing:
		raise HTTPException(status_code=400, detail="Email already registered")
	user = User(
		name=body.name.strip(),
		email=body.email.lower().strip(),
		password_hash=hash_password(body.password),
		role=body.role,
		country=body.country,
		phone=body.phone,
	)
	db.add(user)
	db.commit()
	db.refresh(user)
	token = create_access_token(user.id, {"role": user.role})
	return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
def login(body: UserLogin, db: Annotated[Session, Depends(get_db)]):
	user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
	if not user or not verify_password(body.password, user.password_hash):
		raise HTTPException(status_code=401, detail="Invalid credentials")
	token = create_access_token(user.id, {"role": user.role})
	return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(get_current_user)]):
	return user
