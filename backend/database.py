import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Vercel has a read-only filesystem, except for the /tmp directory.
# This logic checks if we are on Vercel and switches the DB path automatically.
if os.environ.get('VERCEL'):
    SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/storage.db"
else:
    # Use your local path when running on your machine
    SQLALCHEMY_DATABASE_URL = "sqlite:///./storage.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()