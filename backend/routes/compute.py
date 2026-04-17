from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..he_engine import (
    generate_keys,
    encrypt_vector,
    decrypt_vector,
    add_encrypted,
    multiply_encrypted
)
import base64

router = APIRouter()

class ComputeRequest(BaseModel):
    public_context_b64: str
    ciphertext1_b64: str
    ciphertext2_b64: str
    operation: str

class EncryptRequest(BaseModel):
    vector1: list
    vector2: list

class DecryptRequest(BaseModel):
    context_b64: str
    ciphertext_b64: str

@router.post("/encrypt")
def encrypt_vectors(req: EncryptRequest):
    try:
        context_bytes, public_context_bytes = generate_keys()
        ct1 = encrypt_vector(context_bytes, req.vector1)
        ct2 = encrypt_vector(context_bytes, req.vector2)
        return {
            "context_b64":        base64.b64encode(context_bytes).decode(),
            "public_context_b64": base64.b64encode(public_context_bytes).decode(),
            "ciphertext1_b64":    base64.b64encode(ct1).decode(),
            "ciphertext2_b64":    base64.b64encode(ct2).decode(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compute")
def compute_on_encrypted(req: ComputeRequest):
    try:
        pub_ctx = base64.b64decode(req.public_context_b64)
        ct1     = base64.b64decode(req.ciphertext1_b64)
        ct2     = base64.b64decode(req.ciphertext2_b64)
        if req.operation == "add":
            result = add_encrypted(pub_ctx, ct1, ct2)
        elif req.operation == "multiply":
            result = multiply_encrypted(pub_ctx, ct1, ct2)
        else:
            raise HTTPException(status_code=400, detail="Operation must be add or multiply")
        return {"result_ciphertext_b64": base64.b64encode(result).decode()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/decrypt")
def decrypt_result(req: DecryptRequest):
    try:
        context_bytes    = base64.b64decode(req.context_b64)
        ciphertext_bytes = base64.b64decode(req.ciphertext_b64)
        result           = decrypt_vector(context_bytes, ciphertext_bytes)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))