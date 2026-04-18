import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Relative imports for Vercel
from .database import engine, Base
from .auth import router as auth_router
from .routes.compute import router as compute_router
from .routes.vault import router as vault_router

# Create tables in the /tmp database
Base.metadata.create_all(bind=engine)

app = FastAPI(title="HE Cloud Storage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prefixing to match your frontend API calls
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(compute_router, prefix="/api/he", tags=["HE Compute"])
app.include_router(vault_router, prefix="/api/vault", tags=["Vault"])

@app.get("/")
def root():
    return {"message": "HE API is running"}