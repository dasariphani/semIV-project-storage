from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import File

router = APIRouter()

@router.get("/files")
def get_files(db: Session = Depends(get_db)):
    return db.query(File).all()