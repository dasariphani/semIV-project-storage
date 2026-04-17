from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id       = Column(Integer, primary_key=True, index=True)
    email    = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    files    = relationship("File", back_populates="owner")

class File(Base):
    __tablename__ = "files"
    id          = Column(Integer, primary_key=True, index=True)
    filename    = Column(String, nullable=False)
    filepath    = Column(String, nullable=False)
    owner_id    = Column(Integer, ForeignKey("users.id"))
    share_token = Column(String, unique=True, nullable=True)
    size        = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)
    owner       = relationship("User", back_populates="files")

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    action     = Column(String, nullable=False)
    detail     = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
