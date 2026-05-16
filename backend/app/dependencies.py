from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
	db: Annotated[Session, Depends(get_db)],
	creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
	if not creds or not creds.credentials:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
	user_id = decode_access_token(creds.credentials)
	if not user_id:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
	user = db.get(User, user_id)
	if not user:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
	return user


def get_optional_user(
	db: Annotated[Session, Depends(get_db)],
	creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User | None:
	if not creds or not creds.credentials:
		return None
	user_id = decode_access_token(creds.credentials)
	if not user_id:
		return None
	return db.get(User, user_id)
