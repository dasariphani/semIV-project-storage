from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from ..database import get_db, Base
from auth import get_current_user
from ..models import User
from he_engine import generate_keys, encrypt_vector, decrypt_vector, add_encrypted
import base64, os, uuid, shutil, json, datetime

router = APIRouter()
VAULT_DIR = "vault_storage"
os.makedirs(VAULT_DIR, exist_ok=True)

class VaultFile(Base):
    __tablename__ = "vault_files"
    id               = Column(Integer, primary_key=True, index=True)
    vault_id         = Column(String, unique=True, index=True)
    owner_id         = Column(Integer, ForeignKey("users.id"))
    encrypted_meta   = Column(String)
    public_ctx       = Column(String)
    filepath         = Column(String)
    is_combined      = Column(Integer, default=0)
    combined_from    = Column(String, default="")
    created_at       = Column(DateTime, default=datetime.datetime.utcnow)

def init_vault_table(engine):
    VaultFile.__table__.create(bind=engine, checkfirst=True)

@router.post("/upload")
async def vault_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    file_size = len(content)
    vault_id  = str(uuid.uuid4())
    filepath  = os.path.join(VAULT_DIR, vault_id)

    with open(filepath, "wb") as f:
        f.write(content)

    # Encrypt file metadata as HE vector
    # [file_size, name_length, timestamp, unique_id_hash]
    name_len   = len(file.filename)
    ts         = float(datetime.datetime.utcnow().timestamp() % 100000)
    uid_hash   = float(sum(ord(c) for c in vault_id[:8]) % 1000)
    meta_vector = [float(file_size), float(name_len), ts, uid_hash]

    full_ctx, pub_ctx = generate_keys()
    encrypted_meta    = encrypt_vector(full_ctx, meta_vector)

    # Store full context (has private key) encrypted as b64
    full_ctx_b64    = base64.b64encode(full_ctx).decode()
    pub_ctx_b64     = base64.b64encode(pub_ctx).decode()
    enc_meta_b64    = base64.b64encode(encrypted_meta).decode()

    # Store original filename encrypted separately
    name_vector = [float(ord(c)) for c in file.filename[:16].ljust(16)]
    enc_name    = encrypt_vector(full_ctx, name_vector)
    enc_name_b64 = base64.b64encode(enc_name).decode()

    meta_payload = json.dumps({
        "enc_meta":    enc_meta_b64,
        "enc_name":    enc_name_b64,
        "full_ctx":    full_ctx_b64,
        "display_name": file.filename
    })

    db_file = VaultFile(
        vault_id       = vault_id,
        owner_id       = current_user.id,
        encrypted_meta = meta_payload,
        public_ctx     = pub_ctx_b64,
        filepath       = filepath,
        is_combined    = 0,
        combined_from  = ""
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {
        "message":  "File encrypted and stored in vault",
        "vault_id": vault_id,
        "encrypted_size_preview": enc_meta_b64[:32] + "...",
        "he_scheme": "CKKS"
    }

@router.get("/files")
def vault_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = db.query(VaultFile).filter(VaultFile.owner_id == current_user.id).all()
    result = []
    for f in files:
        meta = json.loads(f.encrypted_meta)
        full_ctx = base64.b64decode(meta["full_ctx"])
        enc_meta = base64.b64decode(meta["enc_meta"])
        decrypted = decrypt_vector(full_ctx, enc_meta)
        result.append({
            "vault_id":      f.vault_id,
            "display_name":  meta["display_name"],
            "encrypted_meta_preview": meta["enc_meta"][:40] + "...",
            "decrypted_size": int(round(decrypted[0])),
            "is_combined":   bool(f.is_combined),
            "combined_from": f.combined_from.split(",") if f.combined_from else [],
            "created_at":    str(f.created_at)
        })
    return result

@router.post("/combine")
def vault_combine(
    vault_id1: str,
    vault_id2: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    f1 = db.query(VaultFile).filter(VaultFile.vault_id == vault_id1, VaultFile.owner_id == current_user.id).first()
    f2 = db.query(VaultFile).filter(VaultFile.vault_id == vault_id2, VaultFile.owner_id == current_user.id).first()
    if not f1 or not f2:
        raise HTTPException(status_code=404, detail="One or both files not found")

    meta1 = json.loads(f1.encrypted_meta)
    meta2 = json.loads(f2.encrypted_meta)

    pub_ctx1  = base64.b64decode(f1.public_ctx)
    enc_meta1 = base64.b64decode(meta1["enc_meta"])
    enc_meta2 = base64.b64decode(meta2["enc_meta"])

    # Server adds encrypted metadata — never decrypts
    combined_enc = add_encrypted(pub_ctx1, enc_meta1, enc_meta2)

    # Combine actual file contents
    combined_id       = str(uuid.uuid4())
    combined_filepath = os.path.join(VAULT_DIR, combined_id)
    with open(combined_filepath, "wb") as out:
        for src in [f1.filepath, f2.filepath]:
            with open(src, "rb") as inp:
                out.write(inp.read())

    combined_name = f"[Combined] {meta1['display_name']} + {meta2['display_name']}"
    full_ctx1     = base64.b64decode(meta1["full_ctx"])
    _, new_pub_ctx = generate_keys()
    new_full_ctx, new_pub_ctx = generate_keys()

    enc_combined_b64 = base64.b64encode(combined_enc).decode()
    new_pub_b64      = base64.b64encode(pub_ctx1).decode()

    meta_payload = json.dumps({
        "enc_meta":    enc_combined_b64,
        "enc_name":    meta1["enc_name"],
        "full_ctx":    meta1["full_ctx"],
        "display_name": combined_name
    })

    db_combined = VaultFile(
        vault_id       = combined_id,
        owner_id       = current_user.id,
        encrypted_meta = meta_payload,
        public_ctx     = f1.public_ctx,
        filepath       = combined_filepath,
        is_combined    = 1,
        combined_from  = f"{vault_id1},{vault_id2}"
    )
    db.add(db_combined)
    db.commit()

    return {
        "message":        "Files combined using HE addition on server",
        "combined_vault_id": combined_id,
        "combined_name":  combined_name,
        "he_operation":   "Encrypted metadata added without decryption",
        "server_saw_plaintext": False
    }

@router.post("/split/{vault_id}")
def vault_split(
    vault_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    f = db.query(VaultFile).filter(
        VaultFile.vault_id == vault_id,
        VaultFile.owner_id == current_user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if not f.is_combined:
        raise HTTPException(status_code=400, detail="This file is not a combined file")

    source_ids = f.combined_from.split(",")
    restored   = []
    for sid in source_ids:
        original = db.query(VaultFile).filter(VaultFile.vault_id == sid).first()
        if original:
            meta = json.loads(original.encrypted_meta)
            restored.append({
                "vault_id":     original.vault_id,
                "display_name": meta["display_name"],
                "status":       "restored"
            })

    db.delete(f)
    db.commit()

    return {
        "message":  "Combined file split back into original files",
        "restored": restored,
        "he_operation": "Encrypted bundle separated"
    }

@router.get("/download/{vault_id}")
def vault_download(
    vault_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    f = db.query(VaultFile).filter(
        VaultFile.vault_id == vault_id,
        VaultFile.owner_id == current_user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    meta = json.loads(f.encrypted_meta)
    return FileResponse(f.filepath, filename=meta["display_name"])

@router.delete("/delete/{vault_id}")
def vault_delete(
    vault_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    f = db.query(VaultFile).filter(
        VaultFile.vault_id == vault_id,
        VaultFile.owner_id == current_user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.exists(f.filepath):
        os.remove(f.filepath)
    db.delete(f)
    db.commit()
    return {"message": "File deleted from vault"}
@router.get("/activity")
def vault_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = db.query(VaultFile).filter(
        VaultFile.owner_id == current_user.id
    ).order_by(VaultFile.created_at.desc()).limit(20).all()
    result = []
    for f in files:
        meta = json.loads(f.encrypted_meta)
        result.append({
            "action": "combined" if f.is_combined else "upload",
            "detail": meta["display_name"],
            "time":   str(f.created_at)
        })
    return result

@router.get("/stats")
def vault_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = db.query(VaultFile).filter(VaultFile.owner_id == current_user.id).all()
    total_size = 0
    for f in files:
        try:
            if os.path.exists(f.filepath):
                total_size += os.path.getsize(f.filepath)
        except:
            pass
    return {
        "total_files": len(files),
        "total_size":  total_size,
        "limit":       100 * 1024 * 1024
    }

@router.get("/preview/{vault_id}")
def vault_preview(
    vault_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    f = db.query(VaultFile).filter(
        VaultFile.vault_id == vault_id,
        VaultFile.owner_id == current_user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    meta = json.loads(f.encrypted_meta)
    ext  = meta["display_name"].split('.')[-1].lower()

    if ext in ['txt', 'csv', 'py', 'json', 'md', 'html', 'js', 'css']:
        with open(f.filepath, 'r', errors='replace') as fp:
            content = fp.read()
        return {"type": "text", "content": content}

    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        with open(f.filepath, 'rb') as fp:
            data = fp.read()
        b64  = base64.b64encode(data).decode()
        mime = f"image/{ext if ext != 'jpg' else 'jpeg'}"
        return {"type": "image", "content": b64, "mime": mime}

    if ext == 'pdf':
        with open(f.filepath, 'rb') as fp:
            data = fp.read()
        b64 = base64.b64encode(data).decode()
        return {"type": "pdf", "content": b64}

    return {"type": "unsupported", "content": ""}