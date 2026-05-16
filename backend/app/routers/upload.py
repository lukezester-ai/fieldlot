import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import settings
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED = {"image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"}


@router.post("")
async def upload_file(
	user: Annotated[User, Depends(get_current_user)],
	file: UploadFile = File(...),
):
	if file.content_type not in ALLOWED:
		raise HTTPException(status_code=400, detail="File type not allowed")
	data = await file.read()
	max_bytes = settings.max_upload_mb * 1024 * 1024
	if len(data) > max_bytes:
		raise HTTPException(status_code=400, detail="File too large")
	upload_root = Path(settings.upload_dir)
	upload_root.mkdir(parents=True, exist_ok=True)
	ext = Path(file.filename or "file").suffix or ".bin"
	name = f"{user.id}_{uuid.uuid4().hex}{ext}"
	path = upload_root / name
	path.write_bytes(data)
	url = f"/api/v1/upload/files/{name}"
	return {"url": url, "filename": name, "content_type": file.content_type}


@router.get("/files/{filename}")
def get_file(filename: str):
	path = Path(settings.upload_dir) / filename
	if not path.is_file() or ".." in filename:
		raise HTTPException(status_code=404, detail="Not found")
	return FileResponse(path)
