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
import httpx
import asyncio
import base64
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, Body
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


def new_referral_code() -> str:
    """Short, friendly user-shareable code."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))


REFERRAL_BONUS_PCT = 10.0   # 10% bonus to referrer
REFERRAL_BONUS_CAP = 50.0   # capped at R$ 50 per referral


async def push_notification(user_id: str, title: str, body: str, kind: str = "info", link: Optional[str] = None):
    """Persist an in-app notification for the given user."""
    try:
        await db.notifications.insert_one({
            "id": new_id(),
            "user_id": user_id,
            "title": title,
            "body": body,
            "kind": kind,           # "deposit" | "withdraw" | "referral" | "info"
            "link": link,
            "read": False,
            "created_at": now_iso(),
        })
    except Exception as e:
        log.warning(f"push_notification failed: {e}")


# ---------------------------------------------------------------------------
# IP / GEO HELPERS
# ---------------------------------------------------------------------------
def get_client_ip(request: Request) -> str:
    """Return the real client IP, honoring proxy headers."""
    headers = request.headers
    fwd = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if fwd:
        # may contain multiple IPs separated by comma — take the first
        return fwd.split(",")[0].strip()
    real = headers.get("x-real-ip") or headers.get("X-Real-IP")
    if real:
        return real.strip()
    cf = headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    return (request.client.host if request.client else "0.0.0.0") or "0.0.0.0"


def is_private_ip(ip: str) -> bool:
    if not ip or ip in ("0.0.0.0", "127.0.0.1", "::1", "localhost"):
        return True
    try:
        parts = ip.split(".")
        if len(parts) == 4:
            a = int(parts[0]); b = int(parts[1])
            if a == 10: return True
            if a == 172 and 16 <= b <= 31: return True
            if a == 192 and b == 168: return True
            if a == 169 and b == 254: return True
    except Exception:
        pass
    return False


async def geolocate_ip(ip: str) -> dict:
    """Free IP geolocation via ip-api.com (45 req/min). Returns dict with country/city/etc."""
    if not ip or is_private_ip(ip):
        return {"country": "Local", "country_code": "", "region": "", "city": "Rede privada", "lat": None, "lon": None, "isp": ""}
    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,lat,lon,isp,query"
        async with httpx.AsyncClient(timeout=4.0) as cli:
            r = await cli.get(url)
            d = r.json()
        if d.get("status") != "success":
            return {"country": "Desconhecido", "country_code": "", "region": "", "city": "", "lat": None, "lon": None, "isp": ""}
        return {
            "country": d.get("country", ""),
            "country_code": d.get("countryCode", ""),
            "region": d.get("regionName", ""),
            "city": d.get("city", ""),
            "lat": d.get("lat"),
            "lon": d.get("lon"),
            "isp": d.get("isp", ""),
        }
    except Exception as e:
        log.warning(f"geolocate_ip failed for {ip}: {e}")
        return {"country": "Desconhecido", "country_code": "", "region": "", "city": "", "lat": None, "lon": None, "isp": ""}


async def is_ip_banned(ip: str) -> Optional[dict]:
    """Return banned doc if this IP is banned, else None."""
    if not ip or is_private_ip(ip):
        return None
    return await db.banned_ips.find_one({"ip": ip}, {"_id": 0})


async def record_user_ip(user_id: str, ip: str, action: str):
    """Persist an IP visit + update user's last IP/location snapshot."""
    geo = await geolocate_ip(ip)
    record = {
        "id": new_id(),
        "user_id": user_id,
        "ip": ip,
        "action": action,        # "register" | "login" | "request"
        "country": geo.get("country"),
        "country_code": geo.get("country_code"),
        "region": geo.get("region"),
        "city": geo.get("city"),
        "lat": geo.get("lat"),
        "lon": geo.get("lon"),
        "isp": geo.get("isp"),
        "created_at": now_iso(),
    }
    try:
        await db.user_ip_logs.insert_one(record)
    except Exception as e:
        log.warning(f"user_ip_logs insert failed: {e}")

    snapshot = {
        "last_ip": ip,
        "last_ip_country": geo.get("country"),
        "last_ip_country_code": geo.get("country_code"),
        "last_ip_region": geo.get("region"),
        "last_ip_city": geo.get("city"),
        "last_ip_lat": geo.get("lat"),
        "last_ip_lon": geo.get("lon"),
        "last_ip_isp": geo.get("isp"),
        "last_login_at": now_iso(),
    }
    await db.users.update_one({"id": user_id}, {"$set": snapshot})
    return geo


def sanitize_user(u: dict) -> dict:
    u = dict(u)
    u.pop("_id", None)
    u.pop("password_hash", None)
    # Withdraw password is now the same as login password — always available
    u.pop("withdraw_password_hash", None)
    u["has_withdraw_password"] = True
    return u


# ---------------------------------------------------------------------------
# MODELS
# ---------------------------------------------------------------------------
class RegisterReq(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=120)
    referral_code: Optional[str] = None


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
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.referrals.create_index([("referrer_id", 1), ("created_at", -1)])
    await db.referrals.create_index("referred_id", unique=True)
    await db.user_ip_logs.create_index([("user_id", 1), ("created_at", -1)])
    await db.user_ip_logs.create_index("ip")
    await db.banned_ips.create_index("ip", unique=True)

    # Backfill referral_code on users that don't have one yet
    async for u in db.users.find({"referral_code": {"$exists": False}}, {"_id": 0, "id": 1}):
        code = new_referral_code()
        # ensure uniqueness
        for _ in range(5):
            if not await db.users.find_one({"referral_code": code}):
                break
            code = new_referral_code()
        await db.users.update_one({"id": u["id"]}, {"$set": {"referral_code": code}})

    try:
        await db.users.create_index("referral_code", unique=True, sparse=True)
    except Exception:
        pass

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
async def register(body: RegisterReq, request: Request):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    # Block registrations from banned IPs
    client_ip = get_client_ip(request)
    banned = await is_ip_banned(client_ip)
    if banned:
        raise HTTPException(status_code=403, detail="Acesso bloqueado a partir deste IP.")

    # generate unique referral code
    code = new_referral_code()
    for _ in range(5):
        if not await db.users.find_one({"referral_code": code}):
            break
        code = new_referral_code()

    # validate referral_code if provided
    referred_by_id = None
    referred_by_code = None
    if body.referral_code:
        rc = body.referral_code.strip().upper()
        if rc:
            ref = await db.users.find_one({"referral_code": rc}, {"_id": 0, "id": 1, "name": 1})
            if not ref:
                raise HTTPException(status_code=400, detail="Código de indicação inválido")
            referred_by_id = ref["id"]
            referred_by_code = rc

    user = {
        "id": new_id(),
        "name": body.name.strip(),
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "user",
        "balance": 0.0,
        "referral_code": code,
        "referred_by": referred_by_id,
        "referred_by_code": referred_by_code,
        "created_at": now_iso(),
        "register_ip": client_ip,
    }
    await db.users.insert_one(user)

    # record IP visit + geo
    await record_user_ip(user["id"], client_ip, "register")

    if referred_by_id:
        # track pending referral; bonus credited when this user has first approved deposit
        await db.referrals.insert_one({
            "id": new_id(),
            "referrer_id": referred_by_id,
            "referred_id": user["id"],
            "referred_name": user["name"],
            "referred_email": email,
            "bonus_amount": 0.0,
            "status": "pending",
            "created_at": now_iso(),
            "paid_at": None,
        })
        await push_notification(
            referred_by_id,
            "Novo indicado!",
            f"{user['name']} entrou pelo seu código. Você ganhará bônus no primeiro depósito aprovado dele.",
            kind="referral",
            link="/indicacao",
        )

    token = create_access_token(user["id"], email, "user")
    return {"token": token, "user": sanitize_user(user)}


@api.post("/auth/login")
async def login(body: LoginReq, request: Request):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Conta bloqueada. Contate o suporte.")

    client_ip = get_client_ip(request)

    # Block by IP for non-admin users
    if user.get("role") != "admin":
        banned = await is_ip_banned(client_ip)
        if banned:
            raise HTTPException(status_code=403, detail="Acesso bloqueado a partir deste IP.")

    # record IP visit + geo
    await record_user_ip(user["id"], client_ip, "login")

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

    # Verify with the LOGIN password (no separate withdraw password anymore)
    if not verify_password(body.withdraw_password, current.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Senha incorreta.")

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
    await push_notification(
        dep["user_id"],
        "Depósito aprovado!",
        f"Seu depósito de R$ {float(dep['amount']):.2f} foi creditado na sua carteira.",
        kind="deposit",
        link="/(tabs)/carteira",
    )

    # ----- Referral bonus on first approved deposit -----
    referral = await db.referrals.find_one({"referred_id": dep["user_id"], "status": "pending"})
    if referral:
        bonus = round(min(float(dep["amount"]) * REFERRAL_BONUS_PCT / 100.0, REFERRAL_BONUS_CAP), 2)
        if bonus > 0:
            await db.users.update_one({"id": referral["referrer_id"]}, {"$inc": {"balance": bonus}})
            await db.referrals.update_one(
                {"id": referral["id"]},
                {"$set": {"bonus_amount": bonus, "status": "paid", "paid_at": now_iso()}},
            )
            await db.transactions.insert_one({
                "id": new_id(),
                "user_id": referral["referrer_id"],
                "type": "referral_bonus",
                "amount": bonus,
                "description": f"Bônus de indicação ({referral.get('referred_name','')})",
                "created_at": now_iso(),
            })
            await push_notification(
                referral["referrer_id"],
                "Bônus de indicação recebido!",
                f"Você ganhou R$ {bonus:.2f} pelo primeiro depósito de {referral.get('referred_name','seu indicado')}.",
                kind="referral",
                link="/indicacao",
            )
    return {"ok": True}


@api.post("/admin/deposits/{dep_id}/reject")
async def admin_reject_deposit(
    dep_id: str,
    body: Optional[RejectReason] = Body(default=None),
    admin: dict = Depends(require_admin),
):
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
    await push_notification(
        dep["user_id"],
        "Depósito rejeitado",
        (f"Seu depósito de R$ {float(dep['amount']):.2f} foi rejeitado. Motivo: {reason}"
         if reason else f"Seu depósito de R$ {float(dep['amount']):.2f} foi rejeitado. Confira os detalhes."),
        kind="deposit",
        link="/(tabs)/carteira",
    )
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
    await push_notification(
        wd["user_id"],
        "Saque aprovado!",
        f"Seu saque de R$ {float(wd.get('net_amount', wd['amount'])):.2f} foi enviado para sua chave PIX.",
        kind="withdraw",
        link="/(tabs)/carteira",
    )
    return {"ok": True}


@api.post("/admin/withdrawals/{wd_id}/reject")
async def admin_reject_withdrawal(
    wd_id: str,
    body: Optional[RejectReason] = Body(default=None),
    admin: dict = Depends(require_admin),
):
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
    await push_notification(
        wd["user_id"],
        "Saque rejeitado",
        (f"Seu saque foi rejeitado. Motivo: {reason}. O valor foi estornado para sua carteira."
         if reason else "Seu saque foi rejeitado. O valor foi estornado para sua carteira."),
        kind="withdraw",
        link="/(tabs)/carteira",
    )
    return {"ok": True}


@api.post("/admin/users/{user_id}/ban")
async def admin_ban_user(
    user_id: str,
    body: Optional[RejectReason] = Body(default=None),
    admin: dict = Depends(require_admin),
):
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

    # Collect every IP ever used by this user + last_ip + register_ip
    ips = set()
    if target.get("last_ip"): ips.add(target["last_ip"])
    if target.get("register_ip"): ips.add(target["register_ip"])
    async for log_entry in db.user_ip_logs.find({"user_id": user_id}, {"_id": 0, "ip": 1}):
        if log_entry.get("ip"): ips.add(log_entry["ip"])

    banned_ips = []
    for ip in ips:
        if not ip or is_private_ip(ip):
            continue
        try:
            await db.banned_ips.update_one(
                {"ip": ip},
                {"$set": {
                    "ip": ip,
                    "user_id": user_id,
                    "user_email": target.get("email", ""),
                    "user_name": target.get("name", ""),
                    "reason": reason,
                    "banned_at": now_iso(),
                    "banned_by_admin": admin.get("email", ""),
                }},
                upsert=True,
            )
            banned_ips.append(ip)
        except Exception as e:
            log.warning(f"Failed to ban IP {ip}: {e}")
    return {"ok": True, "banned_ips": banned_ips, "ip_count": len(banned_ips)}


@api.post("/admin/users/{user_id}/unban")
async def admin_unban_user(user_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    res = await db.users.update_one(
        {"id": user_id},
        {"$set": {"banned": False}, "$unset": {"banned_at": "", "banned_reason": ""}},
    )
    # Remove all IPs associated with this user from banned_ips
    removed = await db.banned_ips.delete_many({"user_id": user_id})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"ok": True, "ips_unbanned": removed.deleted_count}


@api.get("/admin/users/{user_id}/ips")
async def admin_user_ips(user_id: str, admin: dict = Depends(require_admin)):
    """Return the full IP/location history for one user."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    logs = await db.user_ip_logs.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    # mark which IPs are currently banned
    banned_set = set()
    async for b in db.banned_ips.find({"user_id": user_id}, {"_id": 0, "ip": 1}):
        banned_set.add(b["ip"])
    for it in logs:
        it["banned"] = it.get("ip") in banned_set
    return {
        "user": {
            "id": target.get("id"),
            "name": target.get("name"),
            "email": target.get("email"),
            "banned": bool(target.get("banned")),
            "last_ip": target.get("last_ip"),
            "last_ip_city": target.get("last_ip_city"),
            "last_ip_region": target.get("last_ip_region"),
            "last_ip_country": target.get("last_ip_country"),
            "last_ip_country_code": target.get("last_ip_country_code"),
            "last_ip_isp": target.get("last_ip_isp"),
            "last_login_at": target.get("last_login_at"),
            "register_ip": target.get("register_ip"),
        },
        "logs": logs,
    }


@api.get("/admin/banned-ips")
async def admin_list_banned_ips(admin: dict = Depends(require_admin)):
    items = await db.banned_ips.find({}, {"_id": 0}).sort("banned_at", -1).to_list(500)
    return items


@api.delete("/admin/banned-ips/{ip}")
async def admin_unban_ip(ip: str, admin: dict = Depends(require_admin)):
    res = await db.banned_ips.delete_one({"ip": ip})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="IP não estava bloqueado")
    return {"ok": True}


# ---------------------------------------------------------------------------
# REFERRALS (USER)
# ---------------------------------------------------------------------------
@api.get("/me/referrals")
async def my_referrals(user: dict = Depends(get_current_user)):
    me = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    code = me.get("referral_code")
    if not code:
        # backfill
        code = new_referral_code()
        for _ in range(5):
            if not await db.users.find_one({"referral_code": code}):
                break
            code = new_referral_code()
        await db.users.update_one({"id": user["id"]}, {"$set": {"referral_code": code}})

    referrals = await db.referrals.find({"referrer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total_paid = sum(float(r.get("bonus_amount", 0)) for r in referrals if r.get("status") == "paid")
    paid_count = sum(1 for r in referrals if r.get("status") == "paid")
    return {
        "code": code,
        "bonus_pct": REFERRAL_BONUS_PCT,
        "bonus_cap": REFERRAL_BONUS_CAP,
        "total_referrals": len(referrals),
        "paid_referrals": paid_count,
        "total_earned": round(total_paid, 2),
        "referrals": [
            {
                "name": r.get("referred_name", ""),
                "email": r.get("referred_email", ""),
                "bonus_amount": float(r.get("bonus_amount", 0)),
                "status": r.get("status", "pending"),
                "created_at": r.get("created_at"),
                "paid_at": r.get("paid_at"),
            }
            for r in referrals
        ],
    }


@api.get("/auth/check-referral/{code}")
async def check_referral_code(code: str):
    c = code.strip().upper()
    if not c:
        raise HTTPException(status_code=400, detail="Código inválido")
    ref = await db.users.find_one({"referral_code": c}, {"_id": 0, "name": 1})
    if not ref:
        raise HTTPException(status_code=404, detail="Código não encontrado")
    return {"valid": True, "referrer_name": ref.get("name", "")}


# ---------------------------------------------------------------------------
# NOTIFICATIONS (USER)
# ---------------------------------------------------------------------------
@api.get("/me/notifications")
async def my_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "unread": unread}


@api.get("/me/notifications/unread-count")
async def my_unread_count(user: dict = Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"unread": n}


@api.post("/me/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user)):
    res = await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return {"ok": True}


@api.post("/me/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# ADMIN STATS / RESET
# ---------------------------------------------------------------------------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    total_lotes = await db.lotes.count_documents({})
    total_deposits = await db.deposits.count_documents({})
    pending_deposits = await db.deposits.count_documents({"status": "pending"})
    approved_deposits = await db.deposits.count_documents({"status": "approved"})
    total_withdrawals = await db.withdrawals.count_documents({})
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    total_transactions = await db.transactions.count_documents({})
    total_notifications = await db.notifications.count_documents({})
    total_referrals = await db.referrals.count_documents({})
    total_banned_ips = await db.banned_ips.count_documents({})

    total_balance = 0.0
    async for u in db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "balance": 1}):
        total_balance += float(u.get("balance", 0))

    sum_deposits = 0.0
    async for d in db.deposits.find({"status": "approved"}, {"_id": 0, "amount": 1}):
        sum_deposits += float(d.get("amount", 0))

    sum_withdrawals = 0.0
    async for w in db.withdrawals.find({"status": "approved"}, {"_id": 0, "amount": 1}):
        sum_withdrawals += float(w.get("amount", 0))

    return {
        "total_users": total_users,
        "total_lotes": total_lotes,
        "total_deposits": total_deposits,
        "pending_deposits": pending_deposits,
        "approved_deposits": approved_deposits,
        "total_withdrawals": total_withdrawals,
        "pending_withdrawals": pending_withdrawals,
        "total_transactions": total_transactions,
        "total_notifications": total_notifications,
        "total_referrals": total_referrals,
        "total_banned_ips": total_banned_ips,
        "total_balance": round(total_balance, 2),
        "sum_approved_deposits": round(sum_deposits, 2),
        "sum_approved_withdrawals": round(sum_withdrawals, 2),
    }


class ResetReq(BaseModel):
    confirm: str  # must be "RESET" to proceed
    keep_lotes: bool = True


@api.post("/admin/reset")
async def admin_reset(body: ResetReq, admin: dict = Depends(require_admin)):
    """
    Danger zone: wipes ALL non-admin user data.
    - Deletes: deposits, withdrawals, transactions, purchases, notifications,
      referrals, user_ip_logs, banned_ips, AND non-admin users.
    - Keeps: admin user(s), lotes (unless keep_lotes=False), pix settings.
    """
    if body.confirm != "RESET":
        raise HTTPException(status_code=400, detail="Confirmação inválida. Envie 'RESET' para confirmar.")

    deleted = {}
    res = await db.deposits.delete_many({})
    deleted["deposits"] = res.deleted_count
    res = await db.withdrawals.delete_many({})
    deleted["withdrawals"] = res.deleted_count
    res = await db.transactions.delete_many({})
    deleted["transactions"] = res.deleted_count
    res = await db.purchases.delete_many({})
    deleted["purchases"] = res.deleted_count
    res = await db.notifications.delete_many({})
    deleted["notifications"] = res.deleted_count
    res = await db.referrals.delete_many({})
    deleted["referrals"] = res.deleted_count
    res = await db.user_ip_logs.delete_many({})
    deleted["user_ip_logs"] = res.deleted_count
    res = await db.banned_ips.delete_many({})
    deleted["banned_ips"] = res.deleted_count
    res = await db.users.delete_many({"role": {"$ne": "admin"}})
    deleted["users"] = res.deleted_count

    if not body.keep_lotes:
        res = await db.lotes.delete_many({})
        deleted["lotes"] = res.deleted_count

    log.warning(f"ADMIN RESET by {admin.get('email')}: {deleted}")
    return {"ok": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# AI IMAGE GENERATION (LOTE THUMBNAILS)
# ---------------------------------------------------------------------------
class GenerateImageReq(BaseModel):
    prompt: str = Field(min_length=1, max_length=200)


@api.post("/admin/generate-image")
async def admin_generate_image(body: GenerateImageReq, admin: dict = Depends(require_admin)):
    """Generate a marketing thumbnail for a lote based on its name using Gemini Nano Banana."""
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY não configurada.")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lib de IA indisponível: {e}")

    user_subject = body.prompt.strip()
    full_prompt = (
        f"Create a high-quality, vibrant marketing thumbnail illustration of: '{user_subject}'. "
        f"Style: modern digital art with neon green and magenta accents, dark futuristic background, "
        f"glossy, professional product photography quality, centered subject, dramatic lighting, "
        f"square 1:1 composition, no text, no watermarks, no logos. The subject should be the clear focal point."
    )

    try:
        session_id = new_id()
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are a marketing image generator for an investment app. Generate clean, vibrant product thumbnails."
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        msg = UserMessage(text=full_prompt)
        text, images = await chat.send_message_multimodal_response(msg)

        if not images:
            raise HTTPException(status_code=500, detail="A IA não retornou imagem. Tente um nome mais específico.")

        first = images[0]
        mime = first.get("mime_type") or "image/png"
        data = first.get("data") or ""
        if not data:
            raise HTTPException(status_code=500, detail="Imagem vazia retornada pela IA.")
        # data is already base64 string
        image_url = f"data:{mime};base64,{data}"
        return {"image_url": image_url, "prompt": user_subject}
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"AI image generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Falha ao gerar imagem: {str(e)[:200]}")


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
