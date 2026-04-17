import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base  # Note the dot for relative import if needed
from .auth import router as auth_router
from .routes.compute import router as compute_router
from .routes.vault import router as vault_router, init_vault_table

# --- CLOUD COMPATIBILITY START ---
# Ensure database tables are created in the writable /tmp directory
Base.metadata.create_all(bind=engine)
init_vault_table(engine)
# --- CLOUD COMPATIBILITY END ---

app = FastAPI(title="HE Cloud Storage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(compute_router, prefix="/he", tags=["HE Compute"])
app.include_router(vault_router, prefix="/vault", tags=["Encrypted Vault"])

@app.get("/api/health") # Useful for Vercel health checks
def health_check():
    return {"status": "online", "database": "connected"}

@app.get("/")
def root():
    return {"message": "HE Cloud Storage API is running"}