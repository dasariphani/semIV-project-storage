from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from models import File as FileModel, User, ActivityLog
from auth import get_current_user
import os, uuid, shutil

router = APIRouter()
STORAGE_DIR = "storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

def log_activity(db, user_id, action, detail=""):
    entry = ActivityLog(user_id=user_id, action=action, detail=detail)
    db.add(entry)
    db.commit()

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_id  = str(uuid.uuid4())
    filepath = os.path.join(STORAGE_DIR, file_id)
    content  = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    size = len(content)
    db_file = FileModel(
        filename=file.filename,
        filepath=filepath,
        owner_id=current_user.id,
        size=size
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    log_activity(db, current_user.id, "upload", f"Uploaded {file.filename} ({size} bytes)")
    return {"message": "File uploaded", "file_id": db_file.id, "filename": db_file.filename}

@router.get("/files")
def list_files(
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(FileModel).filter(FileModel.owner_id == current_user.id)
    if search:
        query = query.filter(FileModel.filename.contains(search))
    files = query.all()
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "created_at": str(f.created_at),
            "share_token": f.share_token,
            "size": f.size
        }
        for f in files
    ]

@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.owner_id == current_user.id
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    log_activity(db, current_user.id, "download", f"Downloaded {db_file.filename}")
    return FileResponse(db_file.filepath, filename=db_file.filename)

@router.delete("/delete/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.owner_id == current_user.id
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.exists(db_file.filepath):
        os.remove(db_file.filepath)
    log_activity(db, current_user.id, "delete", f"Deleted {db_file.filename}")
    db.delete(db_file)
    db.commit()
    return {"message": "File deleted"}

@router.post("/share/{file_id}")
def share_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.owner_id == current_user.id
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if not db_file.share_token:
        db_file.share_token = str(uuid.uuid4())
        db.commit()
    log_activity(db, current_user.id, "share", f"Shared {db_file.filename}")
    return {
        "share_token": db_file.share_token,
        "share_url": f"/storage/shared/{db_file.share_token}"
    }

@router.post("/share-with/{file_id}")
def share_with_user(
    file_id: int,
    recipient_email: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.owner_id == current_user.id
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    recipient = db.query(User).filter(User.email == recipient_email).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    new_file = FileModel(
        filename=f"[Shared] {db_file.filename}",
        filepath=db_file.filepath,
        owner_id=recipient.id,
        size=db_file.size
    )
    db.add(new_file)
    db.commit()
    log_activity(db, current_user.id, "share_with", f"Shared {db_file.filename} with {recipient_email}")
    return {"message": f"File shared with {recipient_email}"}

@router.get("/shared/{token}")
def download_shared(token: str, db: Session = Depends(get_db)):
    db_file = db.query(FileModel).filter(FileModel.share_token == token).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="Invalid share link")
    return FileResponse(db_file.filepath, filename=db_file.filename)

@router.get("/activity")
def get_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logs = db.query(ActivityLog).filter(
        ActivityLog.user_id == current_user.id
    ).order_by(ActivityLog.created_at.desc()).limit(20).all()
    return [
        {"action": l.action, "detail": l.detail, "time": str(l.created_at)}
        for l in logs
    ]

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = db.query(FileModel).filter(FileModel.owner_id == current_user.id).all()
    total_size  = sum(f.size or 0 for f in files)
    total_files = len(files)
    return {"total_files": total_files, "total_size": total_size, "limit": 100 * 1024 * 1024}
from fastapi.responses import Response

@router.get("/preview/{file_id}")
def preview_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.owner_id == current_user.id
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    ext = db_file.filename.split('.')[-1].lower()

    # Text files
    if ext in ['txt', 'csv', 'py', 'json', 'md', 'html', 'js', 'css']:
        with open(db_file.filepath, 'r', errors='replace') as f:
            content = f.read()
        return {"type": "text", "content": content, "filename": db_file.filename}

    # Images
    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        with open(db_file.filepath, 'rb') as f:
            data = f.read()
        import base64
        b64 = base64.b64encode(data).decode()
        mime = f"image/{ext if ext != 'jpg' else 'jpeg'}"
        return {"type": "image", "content": b64, "mime": mime, "filename": db_file.filename}

    # PDF
    if ext == 'pdf':
        with open(db_file.filepath, 'rb') as f:
            data = f.read()
        import base64
        b64 = base64.b64encode(data).decode()
        return {"type": "pdf", "content": b64, "filename": db_file.filename}

    # Unsupported
    return {"type": "unsupported", "content": "", "filename": db_file.filename}