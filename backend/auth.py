from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# THE CRITICAL RELATIVE IMPORTS (Preserving the dots)
from .database import get_db
from .models import User
from .schemas import UserCreate, UserLogin

router = APIRouter()

# Initializing the crypt context for bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    """Verifies a plain password against the hash, with 72-byte truncation."""
    # Truncate to 72 bytes to avoid Bcrypt ValueError
    safe_password = plain_password.encode('utf-8')[:72]
    return pwd_context.verify(safe_password, hashed_password)

def get_password_hash(password):
    """Hashes a password after truncating it to 72 bytes."""
    # Bcrypt cannot handle more than 72 bytes. 
    # We truncate manually to prevent the 'ValueError' we saw in the logs.
    safe_password = password.encode('utf-8')[:72]
    return pwd_context.hash(safe_password)

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    # 1. Check if user exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. Hash the password safely
    try:
        hashed_password = get_password_hash(user.password)
        
        # 3. Save to database
        new_user = User(email=user.email, hashed_password=hashed_password)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"message": "User created successfully", "status": "success"}
    except Exception as e:
        # Catching any other potential hashing/DB errors
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    
    # Verify existence and password
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "message": "Login successful", 
        "email": db_user.email,
        "status": "success"
    }