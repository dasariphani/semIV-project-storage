import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Use relative imports (the dots) so Vercel can find the files in the backend folder
from .database import engine, Base
from .auth import router as auth_router
from .routes.compute import router as compute_router
from .routes.vault import router as vault_router, init_vault_table

# --- CLOUD COMPATIBILITY & DB INIT ---
# This creates the tables in the writable /tmp directory we set in database.py
try:
    Base.metadata.create_all(bind=engine)
    init_vault_table(engine)
    print("Database initialized successfully.")
except Exception as e:
    print(f"Database initialization warning: {e}")

app = FastAPI(title="HE Cloud Storage API")

# Configure CORS so your frontend can talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, you'd replace this with your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(compute_router, prefix="/he", tags=["HE Compute"])
app.include_router(vault_router, prefix="/vault", tags=["Encrypted Vault"])

@app.get("/api/health")
def health_check():
    """Simple route to check if the backend is alive"""
    return {
        "status": "online", 
        "environment": "Vercel" if os.environ.get('VERCEL') else "Local"
    }

@app.get("/")
def root():
    return {"message": "HE Cloud Storage API is running"}