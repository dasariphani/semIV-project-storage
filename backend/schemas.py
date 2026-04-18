from pydantic import BaseModel, EmailStr

# This defines what the "Register" data should look like
class UserCreate(BaseModel):
    email: EmailStr
    password: str

# This defines what the "Login" data should look like
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# This defines how the User data looks when sent back to the frontend
class UserResponse(BaseModel):
    id: int
    email: EmailStr

    class Config:
        from_attributes = True