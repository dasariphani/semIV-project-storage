import os
from sqlalchemy import create_all, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# This check ensures it uses /tmp on Vercel but stays normal on your PC
if os.environ.get('VERCEL'):
    SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/storage.db"
else:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./storage.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()