from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
# TWO DOTS - matching the new function names in he_engine.py
from ..he_engine import generate_keys, encrypt_vector, decrypt_vector, perform_computation

router = APIRouter()

class ComputeRequest(BaseModel):
    val1: float
    val2: float

@router.get("/keys")
def get_keys():
    try:
        pub, priv = generate_keys()
        return {"public_key": pub, "private_key": priv}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add")
def add_values(data: ComputeRequest):
    try:
        # demo logic
        result = perform_computation(data.val1, data.val2)
        return {"result": result, "mode": "demo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))