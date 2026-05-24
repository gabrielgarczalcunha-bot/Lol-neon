from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.security import HTTPBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower()
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24 * 30  # 30 days - mobile friendly

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="LotePro API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("lotepro")


# ---------------------------------------------------------------------------
# UTILS
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def new_id() -> str:
    return str(uuid.uuid4())


def sanitize_user(u: dict) -> dict:
    u = dict(u)
    u.pop("_id", None)
    u.pop("password_hash", None)
    # expose whether withdraw password is set (boolean), never the hash
    u["has_withdraw_password"] = bool(u.pop("withdraw_password_hash", None))
    return u


# ---------------------------------------------------------------------------
# MODELS
# ---------------------------------------------------------------------------
class RegisterReq(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=120)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class LoteCreate(BaseModel):
    name: str
    description: str = ""
    price: float = Field(gt=0)
    hourly_yield: float = Field(gt=0)
    duration_days: int = Field(default=30, ge=1, le=365)
    image_url: str = ""
    active: bool = True


class LoteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    hourly_yield: Optional[float] = None
    duration_days: Optional[int] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None


class DepositReq(BaseModel):
    amount: float = Field(gt=0)
    proof_image: str = Field(min_length=10, max_length=8_000_000)  # base64 data URL


class WithdrawReq(BaseModel):
    amount: float = Field(gt=0)
    pix_key: str = Field(min_length=3, max_length=140)
    pix_key_type: Literal["cpf", "email", "telefone", "aleatoria"] = "aleatoria"
    withdraw_password: str = Field(min_length=4, max_length=64)


class SetWithdrawPassword(BaseModel):
    password: str = Field(min_length=4, max_length=64)
    current_password: Optional[str] = None  # required if already set


class RejectReason(BaseModel):
    reason: str = Field(default="", max_length=400)


class PixSettings(BaseModel):
    pix_key: str
    pix_key_type: Literal["cpf", "cnpj", "email", "telefone", "aleatoria"] = "aleatoria"
    company_name: str = "LotePro Investimentos"
    beneficiary_city: str = "SAO PAULO"
    display_key: Optional[str] = None  # masked random-looking alias shown on UI
    display_key_type: Optional[Literal["cpf", "cnpj", "email", "telefone", "aleatoria"]] = "aleatoria"


# ---------------------------------------------------------------------------
# AUTH DEPENDENCY
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        uid = payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Conta bloqueada. Contate o suporte.")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito")
    return user


# ---------------------------------------------------------------------------
# YIELD CALCULATION
# ---------------------------------------------------------------------------
def compute_lote_yield(purchase: dict, lote: dict, at: Optional[datetime] = None) -> dict:
    """Return dict with earned_total, active_seconds, remaining_seconds, completed."""
    at = at or now_utc()
    started = purchase["started_at"]
    if isinstance(started, str):
        started = datetime.fromisoformat(started.replace("Z", "+00:00"))
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)

    duration_seconds = int(lote["duration_days"]) * 24 * 3600
    end = started + timedelta(seconds=duration_seconds)
    active_end = min(at, end)
    active_seconds = max(0, int((active_end - started).total_seconds()))
    total_seconds = duration_seconds
    hourly = float(lote["hourly_yield"])
    earned_total = round((active_seconds / 3600.0) * hourly, 4)
    remaining_seconds = max(0, total_seconds - active_seconds)
    completed = at >= end
    return {
        "earned_total": earned_total,
        "active_seconds": active_seconds,
        "total_seconds": total_seconds,
        "remaining_seconds": remaining_seconds,
        "completed": completed,
        "started_at": started.isoformat(),
        "ends_at": end.isoformat(),
    }


async def user_accumulated_yield(user_id: str) -> float:
    """Sum of (earned_total - already_collected) across all purchases for the user."""
    total = 0.0
    cursor = db.purchases.find({"user_id": user_id}, {"_id": 0})
    async for p in cursor:
        lote = await db.lotes.find_one({"id": p["lote_id"]}, {"_id": 0})
        if not lote:
            continue
        info = compute_lote_yield(p, lote)
        total += max(0.0, info["earned_total"] - float(p.get("collected", 0)))
    return round(total, 2)


# ---------------------------------------------------------------------------
# PIX BR CODE (EMV) PAYLOAD
# ---------------------------------------------------------------------------
def _tlv(tag: str, value: str) -> str:
    return f"{tag}{len(value):02d}{value}"


def _crc16_ccitt(payload: str) -> str:
    crc = 0xFFFF
    for b in payload.encode("utf-8"):
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def build_pix_payload(key: str, amount: float, merchant_name: str, merchant_city: str, txid: str = "LOTEPRO") -> str:
    merchant_name = (merchant_name or "LOTEPRO")[:25].upper()
    merchant_city = (merchant_city or "SAO PAULO")[:15].upper()
    txid = (txid or "LOTEPRO")[:25]

    mai = _tlv("00", "br.gov.bcb.pix") + _tlv("01", key)
    payload = (
        _tlv("00", "01")
        + _tlv("26", mai)
        + _tlv("52", "0000")
        + _tlv("53", "986")
        + (_tlv("54", f"{amount:.2f}") if amount and amount > 0 else "")
        + _tlv("58", "BR")
        + _tlv("59", merchant_name)
        + _tlv("60", merchant_city)
        + _tlv("62", _tlv("05", txid))
    )
    payload_with_crc_tag = payload + "6304"
    crc = _crc16_ccitt(payload_with_crc_tag)
    return payload_with_crc_tag + crc


# ---------------------------------------------------------------------------
# STARTUP
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.lotes.create_index("id", unique=True)
    await db.purchases.create_index("user_id")
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.deposits.create_index([("status", 1), ("created_at", -1)])
    await db.withdrawals.create_index([("status", 1), ("created_at", -1)])

    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        admin = {
            "id": new_id(),
            "name": "Administrador",
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "balance": 0.0,
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin)
        log.info("Seeded admin user")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "role": "admin"}},
        )
        log.info("Updated admin password")

    settings = await db.settings.find_one({"id": "pix"})
    if not settings:
        await db.settings.insert_one(
            {
                "id": "pix",
                "pix_key": "ggc@gmail.com",
                "pix_key_type": "email",
                "company_name": "LotePro Investimentos",
                "beneficiary_city": "SAO PAULO",
                "updated_at": now_iso(),
            }
        )


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------------------------------------------------------------------------
# AUTH ROUTES
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterReq):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = {
        "id": new_id(),
        "name": body.name.strip(),
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "user",
        "balance": 0.0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], email, "user")
    return {"token": token, "user": sanitize_user(user)}


@api.post("/auth/login")
async def login(body: LoginReq):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Conta bloqueada. Contate o suporte.")
    token = create_access_token(user["id"], email, user.get("role", "user"))
    return {"token": token, "user": sanitize_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return sanitize_user(user)


@api.post("/auth/logout")
async def logout():
    return {"ok": True}


# ---------------------------------------------------------------------------
# LOTES (PUBLIC / AUTH'D)
# ---------------------------------------------------------------------------
@api.get("/lotes")
async def list_lotes(user: dict = Depends(get_current_user)):
    items = await db.lotes.find({"active": True}, {"_id": 0}).to_list(500)
    return items


@api.post("/lotes/{lote_id}/buy")
async def buy_lote(lote_id: str, user: dict = Depends(get_current_user)):
    lote = await db.lotes.find_one({"id": lote_id, "active": True}, {"_id": 0})
    if not lote:
        raise HTTPException(status_code=404, detail="Lote indisponível")
    current = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    balance = float(current.get("balance", 0))
    price = float(lote["price"])
    if balance < price:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")

    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -price}})
    purchase = {
        "id": new_id(),
        "user_id": user["id"],
        "lote_id": lote_id,
        "price_paid": price,
        "started_at": now_iso(),
        "collected": 0.0,
        "created_at": now_iso(),
    }
    await db.purchases.insert_one(purchase)
    await db.transactions.insert_one(
        {
            "id": new_id(),
            "user_id": user["id"],
            "type": "purchase",
            "amount": -price,
            "description": f"Compra do lote {lote['name']}",
            "created_at": now_iso(),
        }
    )
    purchase.pop("_id", None)
    return {"ok": True, "purchase": purchase}


@api.get("/me/lotes")
async def my_lotes(user: dict = Depends(get_current_user)):
    out = []
    purchases = await db.purchases.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    for p in purchases:
        lote = await db.lotes.find_one({"id": p["lote_id"]}, {"_id": 0})
        if not lote:
            continue
        info = compute_lote_yield(p, lote)
        out.append(
            {
                "purchase_id": p["id"],
                "lote": lote,
                "started_at": info["started_at"],
                "ends_at": info["ends_at"],
                "earned_total": info["earned_total"],
                "collected": float(p.get("collected", 0)),
                "available": round(info["earned_total"] - float(p.get("collected", 0)), 2),
                "active_seconds": info["active_seconds"],
                "total_seconds": info["total_seconds"],
                "remaining_seconds": info["remaining_seconds"],
                "completed": info["completed"],
                "progress_pct": round(100 * info["active_seconds"] / info["total_seconds"], 2) if info["total_seconds"] else 0,
            }
        )
    out.sort(key=lambda x: x["started_at"], reverse=True)
    return out


@api.post("/me/collect")
async def collect_yield(user: dict = Depends(get_current_user)):
    total_collected = 0.0
    purchases = await db.purchases.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    for p in purchases:
        lote = await db.lotes.find_one({"id": p["lote_id"]}, {"_id": 0})
        if not lote:
            continue
        info = compute_lote_yield(p, lote)
        available = info["earned_total"] - float(p.get("collected", 0))
        if available > 0.001:
            await db.purchases.update_one({"id": p["id"]}, {"$set": {"collected": info["earned_total"]}})
            total_collected += available

    total_collected = round(total_collected, 2)
    if total_collected > 0:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": total_collected}})
        await db.transactions.insert_one(
            {
                "id": new_id(),
                "user_id": user["id"],
                "type": "yield",
                "amount": total_collected,
                "description": "Rendimentos coletados",
                "created_at": now_iso(),
            }
        )
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"ok": True, "collected": total_collected, "balance": float(updated.get("balance", 0))}


@api.get("/wallet")
async def wallet(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    pending = await user_accumulated_yield(user["id"])
    pending_deposit = await db.deposits.count_documents({"user_id": user["id"], "status": "pending"})
    pending_withdraw = await db.withdrawals.count_documents({"user_id": user["id"], "status": "pending"})
    return {
        "balance": float(u.get("balance", 0)),
        "pending_yield": pending,
        "pending_deposits": pending_deposit,
        "pending_withdrawals": pending_withdraw,
    }


@api.get("/transactions")
async def list_transactions(user: dict = Depends(get_current_user)):
    items = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


# ---------------------------------------------------------------------------
# DEPOSITS (USER)
# ---------------------------------------------------------------------------
@api.post("/me/withdraw-password")
async def set_withdraw_password(body: SetWithdrawPassword, user: dict = Depends(get_current_user)):
    current = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    existing = current.get("withdraw_password_hash")
    if existing:
        if not body.current_password or not verify_password(body.current_password, existing):
            raise HTTPException(status_code=401, detail="Senha atual incorreta.")
    new_hash = hash_password(body.password)
    await db.users.update_one({"id": user["id"]}, {"$set": {"withdraw_password_hash": new_hash}})
    return {"ok": True}


@api.post("/deposits")
async def create_deposit(body: DepositReq, user: dict = Depends(get_current_user)):
    dep = {
        "id": new_id(),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "amount": float(body.amount),
        "proof_image": body.proof_image,
        "status": "pending",
        "created_at": now_iso(),
        "reviewed_at": None,
    }
    await db.deposits.insert_one(dep)
    dep.pop("_id", None)
    return dep


@api.get("/deposits/mine")
async def my_deposits(user: dict = Depends(get_current_user)):
    return await db.deposits.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------------------------------------------------------------------------
# WITHDRAWALS (USER)
# ---------------------------------------------------------------------------
@api.get("/withdrawals/rules")
async def withdrawal_rules(user: dict = Depends(get_current_user)):
    count_approved = await db.withdrawals.count_documents(
        {"user_id": user["id"], "status": "approved"}
    )
    is_first = count_approved == 0
    return {
        "is_first_withdrawal": is_first,
        "min_amount": 10.0 if is_first else 30.0,
        "tax_pct": 0.0 if is_first else 10.0,
        "message": (
            "Este é seu primeiro saque — mínimo R$ 10,00 sem taxa."
            if is_first
            else "Saque mínimo R$ 30,00 com taxa de 10%."
        ),
    }


@api.post("/withdrawals")
async def create_withdrawal(body: WithdrawReq, user: dict = Depends(get_current_user)):
    current = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    balance = float(current.get("balance", 0))

    # Verify withdrawal password
    wpw_hash = current.get("withdraw_password_hash")
    if not wpw_hash:
        raise HTTPException(status_code=400, detail="Defina sua senha de saque antes de continuar.")
    if not verify_password(body.withdraw_password, wpw_hash):
        raise HTTPException(status_code=401, detail="Senha de saque incorreta.")

    count_approved = await db.withdrawals.count_documents(
        {"user_id": user["id"], "status": "approved"}
    )
    is_first = count_approved == 0
    min_amount = 10.0 if is_first else 30.0
    tax_pct = 0.0 if is_first else 10.0

    amount = float(body.amount)
    if amount < min_amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Valor mínimo para {'o primeiro saque' if is_first else 'saques'}: R$ {min_amount:.2f}"
            ),
        )
    if amount > balance:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")

    tax_amount = round(amount * tax_pct / 100.0, 2)
    net_amount = round(amount - tax_amount, 2)

    # Reserve the GROSS balance immediately
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -amount}})

    wd = {
        "id": new_id(),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "amount": amount,          # gross (debited from balance)
        "tax_pct": tax_pct,
        "tax_amount": tax_amount,
        "net_amount": net_amount,  # what the user actually receives via PIX
        "is_first_withdrawal": is_first,
        "pix_key": body.pix_key,
        "pix_key_type": body.pix_key_type,
        "status": "pending",
        "created_at": now_iso(),
        "reviewed_at": None,
    }
    await db.withdrawals.insert_one(wd)
    await db.transactions.insert_one(
        {
            "id": new_id(),
            "user_id": user["id"],
            "type": "withdraw_request",
            "amount": -amount,
            "description": (
                f"Saque solicitado (R$ {net_amount:.2f} líq. + taxa {tax_pct:.0f}%)"
                if tax_pct > 0
                else "Saque solicitado (sem taxa)"
            ),
            "created_at": now_iso(),
        }
    )
    wd.pop("_id", None)
    return wd


@api.get("/withdrawals/mine")
async def my_withdrawals(user: dict = Depends(get_current_user)):
    return await db.withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------------------------------------------------------------------------
# SETTINGS (PIX)
# ---------------------------------------------------------------------------
def _make_random_pix_alias() -> str:
    return str(uuid.uuid4())


@api.get("/settings/pix")
async def get_pix(amount: Optional[float] = None, user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"id": "pix"}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=500, detail="Configuração PIX ausente")

    real_key = s["pix_key"]
    display_key = s.get("display_key") or ""
    if not display_key:
        # auto-generate a stable random-looking alias the first time it's asked
        display_key = _make_random_pix_alias()
        await db.settings.update_one(
            {"id": "pix"}, {"$set": {"display_key": display_key, "display_key_type": "aleatoria"}}
        )

    payload = build_pix_payload(
        key=real_key,
        amount=float(amount) if amount else 0.0,
        merchant_name=s.get("company_name", "LOTEPRO"),
        merchant_city=s.get("beneficiary_city", "SAO PAULO"),
    )
    return {
        # what the UI shows to mask the real key
        "display_key": display_key,
        "display_key_type": s.get("display_key_type") or "aleatoria",
        # real key is used when the user actually copies / scans (so payment lands)
        "pix_key": real_key,
        "pix_key_type": s["pix_key_type"],
        "company_name": s.get("company_name", "LotePro Investimentos"),
        "beneficiary_city": s.get("beneficiary_city", "SAO PAULO"),
        "payload": payload,
    }


# ---------------------------------------------------------------------------
# ADMIN ROUTES
# ---------------------------------------------------------------------------
@api.put("/admin/settings/pix")
async def admin_update_pix(body: PixSettings, admin: dict = Depends(require_admin)):
    data = body.model_dump(exclude_none=False)
    # If admin left display_key empty, auto-generate a random alias
    if not data.get("display_key"):
        data["display_key"] = _make_random_pix_alias()
        data["display_key_type"] = "aleatoria"
    data["updated_at"] = now_iso()
    await db.settings.update_one({"id": "pix"}, {"$set": data}, upsert=True)
    s = await db.settings.find_one({"id": "pix"}, {"_id": 0})
    return s


@api.get("/admin/lotes")
async def admin_list_lotes(admin: dict = Depends(require_admin)):
    return await db.lotes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/lotes")
async def admin_create_lote(body: LoteCreate, admin: dict = Depends(require_admin)):
    lote = body.model_dump()
    lote["id"] = new_id()
    lote["created_at"] = now_iso()
    await db.lotes.insert_one(lote)
    lote.pop("_id", None)
    return lote


@api.put("/admin/lotes/{lote_id}")
async def admin_update_lote(lote_id: str, body: LoteUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    res = await db.lotes.update_one({"id": lote_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    return await db.lotes.find_one({"id": lote_id}, {"_id": 0})


@api.delete("/admin/lotes/{lote_id}")
async def admin_delete_lote(lote_id: str, admin: dict = Depends(require_admin)):
    res = await db.lotes.delete_one({"id": lote_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    return {"ok": True}


@api.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return users


@api.get("/admin/deposits")
async def admin_deposits(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    return await db.deposits.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/deposits/{dep_id}/approve")
async def admin_approve_deposit(dep_id: str, admin: dict = Depends(require_admin)):
    dep = await db.deposits.find_one({"id": dep_id}, {"_id": 0})
    if not dep:
        raise HTTPException(status_code=404, detail="Depósito não encontrado")
    if dep["status"] != "pending":
        raise HTTPException(status_code=400, detail="Depósito já revisado")
    await db.users.update_one({"id": dep["user_id"]}, {"$inc": {"balance": float(dep["amount"])}})
    await db.deposits.update_one({"id": dep_id}, {"$set": {"status": "approved", "reviewed_at": now_iso()}})
    await db.transactions.insert_one(
        {
            "id": new_id(),
            "user_id": dep["user_id"],
            "type": "deposit",
            "amount": float(dep["amount"]),
            "description": "Depósito aprovado",
            "created_at": now_iso(),
        }
    )
    return {"ok": True}


@api.post("/admin/deposits/{dep_id}/reject")
async def admin_reject_deposit(dep_id: str, body: RejectReason = None, admin: dict = Depends(require_admin)):
    dep = await db.deposits.find_one({"id": dep_id}, {"_id": 0})
    if not dep:
        raise HTTPException(status_code=404, detail="Depósito não encontrado")
    if dep["status"] != "pending":
        raise HTTPException(status_code=400, detail="Depósito já revisado")
    reason = (body.reason if body else "") or ""
    await db.deposits.update_one(
        {"id": dep_id},
        {"$set": {"status": "rejected", "reviewed_at": now_iso(), "rejection_message": reason}},
    )
    if reason:
        await db.transactions.insert_one({
            "id": new_id(), "user_id": dep["user_id"], "type": "deposit_rejected",
            "amount": 0.0,
            "description": f"Depósito rejeitado: {reason}",
            "created_at": now_iso(),
        })
    return {"ok": True}


@api.get("/admin/withdrawals")
async def admin_withdrawals(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    return await db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/withdrawals/{wd_id}/approve")
async def admin_approve_withdrawal(wd_id: str, admin: dict = Depends(require_admin)):
    wd = await db.withdrawals.find_one({"id": wd_id}, {"_id": 0})
    if not wd:
        raise HTTPException(status_code=404, detail="Saque não encontrado")
    if wd["status"] != "pending":
        raise HTTPException(status_code=400, detail="Saque já revisado")
    await db.withdrawals.update_one({"id": wd_id}, {"$set": {"status": "approved", "reviewed_at": now_iso()}})
    await db.transactions.insert_one(
        {
            "id": new_id(),
            "user_id": wd["user_id"],
            "type": "withdraw",
            "amount": -float(wd["amount"]),
            "description": f"Saque aprovado para chave {wd.get('pix_key', '')[:6]}…",
            "created_at": now_iso(),
        }
    )
    return {"ok": True}


@api.post("/admin/withdrawals/{wd_id}/reject")
async def admin_reject_withdrawal(wd_id: str, body: RejectReason = None, admin: dict = Depends(require_admin)):
    wd = await db.withdrawals.find_one({"id": wd_id}, {"_id": 0})
    if not wd:
        raise HTTPException(status_code=404, detail="Saque não encontrado")
    if wd["status"] != "pending":
        raise HTTPException(status_code=400, detail="Saque já revisado")
    reason = (body.reason if body else "") or ""
    # Refund reserved balance
    await db.users.update_one({"id": wd["user_id"]}, {"$inc": {"balance": float(wd["amount"])}})
    await db.withdrawals.update_one(
        {"id": wd_id},
        {"$set": {"status": "rejected", "reviewed_at": now_iso(), "rejection_message": reason}},
    )
    desc = "Saque rejeitado — valor estornado"
    if reason:
        desc = f"Saque rejeitado: {reason} — valor estornado"
    await db.transactions.insert_one({
        "id": new_id(), "user_id": wd["user_id"], "type": "withdraw_refund",
        "amount": float(wd["amount"]),
        "description": desc,
        "created_at": now_iso(),
    })
    return {"ok": True}


@api.post("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, body: RejectReason = None, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Não é possível bloquear outro administrador.")
    reason = (body.reason if body else "") or ""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"banned": True, "banned_at": now_iso(), "banned_reason": reason}},
    )
    return {"ok": True}


@api.post("/admin/users/{user_id}/unban")
async def admin_unban_user(user_id: str, admin: dict = Depends(require_admin)):
    res = await db.users.update_one(
        {"id": user_id},
        {"$set": {"banned": False}, "$unset": {"banned_at": "", "banned_reason": ""}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"ok": True}


# ---------------------------------------------------------------------------
# HEALTH
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "LotePro API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
