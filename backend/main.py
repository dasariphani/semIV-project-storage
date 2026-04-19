import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from auth import router as auth_router
from routes.compute import router as compute_router
from routes.vault import router as vault_router, init_vault_table

Base.metadata.create_all(bind=engine)
init_vault_table(engine)

app = FastAPI(title="HE Cloud Storage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,    prefix="/auth",  tags=["Auth"])
app.include_router(compute_router, prefix="/he",    tags=["HE Compute"])
app.include_router(vault_router,   prefix="/vault", tags=["Vault"])

@app.get("/")
def root():
    return {"message": "HE Cloud Storage API is running"}