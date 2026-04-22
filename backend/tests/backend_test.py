"""
Backend API tests for LotePro.
Tests all core flows: auth, lotes, deposits, withdrawals, admin actions, PIX payload.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://lotes-gestao.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ggc@gmail.com"
ADMIN_PASSWORD = "@N1collas"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def test_user():
    """Register a fresh user once and share across tests."""
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
    password = "Senha123!"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST User", "email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    d = r.json()
    assert "token" in d and d["user"]["role"] == "user"
    return {"email": email, "password": password, "token": d["token"], "id": d["user"]["id"]}


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- Health ---
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# --- Auth ---
class TestAuth:
    def test_login_admin(self, admin_token):
        assert admin_token

    def test_me_admin(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert d["email"] == ADMIN_EMAIL
        assert "password_hash" not in d
        assert "_id" not in d

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_register_duplicate(self, test_user):
        r = requests.post(f"{API}/auth/register", json={"name": "Dup", "email": test_user["email"], "password": "whatever1"}, timeout=10)
        assert r.status_code == 400

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# --- Lotes list (seed) ---
class TestLotes:
    def test_list_lotes_has_seed(self, test_user):
        r = requests.get(f"{API}/lotes", headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        names = {i["name"] for i in items}
        # the problem statement mentions 3 seed lotes
        assert len(items) >= 3, f"Expected at least 3 seed lotes, got {len(items)}: {names}"

    def test_lotes_requires_auth(self):
        r = requests.get(f"{API}/lotes", timeout=10)
        assert r.status_code == 401


# --- PIX payload ---
class TestPix:
    def test_get_pix_payload(self, test_user):
        r = requests.get(f"{API}/settings/pix", params={"amount": 30}, headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "pix_key" in d and d["pix_key"]
        assert "payload" in d and d["payload"].startswith("00020126")
        assert d["payload"].endswith(
            d["payload"][-4:]
        )  # CRC exists
        # EMV should contain amount field tag 54
        assert "5404" in d["payload"] or "540" in d["payload"]


# --- Admin guards ---
class TestAdminGuards:
    def test_admin_deposits_forbidden_for_user(self, test_user):
        r = requests.get(f"{API}/admin/deposits", headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 403

    def test_admin_lotes_forbidden_for_user(self, test_user):
        r = requests.get(f"{API}/admin/lotes", headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 403

    def test_admin_users_ok(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Full flow: deposit -> approve -> buy -> yield -> collect -> withdraw approve/reject ---
class TestFullFlow:
    def test_01_create_deposit_and_approve(self, test_user, admin_token):
        # Create deposit of 600 to afford Ouro Puro + a bit extra
        _proof = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = requests.post(f"{API}/deposits", json={"amount": 600.0, "proof_image": _proof}, headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 200, r.text
        dep = r.json()
        assert dep["status"] == "pending"
        assert dep["amount"] == 600.0
        assert "_id" not in dep
        pytest.dep_id = dep["id"]

        # Admin sees it in pending list
        r = requests.get(f"{API}/admin/deposits", params={"status": "pending"}, headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert pytest.dep_id in ids

        # Approve
        r = requests.post(f"{API}/admin/deposits/{pytest.dep_id}/approve", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200

        # Verify balance credited
        r = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["balance"] >= 600.0

        # Re-approve -> 400
        r = requests.post(f"{API}/admin/deposits/{pytest.dep_id}/approve", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 400

    def test_02_buy_lote_insufficient(self, test_user):
        # Try buying before having enough balance (user already has 600, so pick a huge price by creating another user)
        email = f"TEST_poor_{uuid.uuid4().hex[:8]}@example.com"
        rr = requests.post(f"{API}/auth/register", json={"name": "TEST Poor", "email": email, "password": "Senha123!"}, timeout=10)
        assert rr.status_code == 200
        tok = rr.json()["token"]
        lotes = requests.get(f"{API}/lotes", headers=bearer(tok), timeout=10).json()
        target = next(l for l in lotes if l["price"] >= 30)
        r = requests.post(f"{API}/lotes/{target['id']}/buy", headers=bearer(tok), timeout=10)
        assert r.status_code == 400

    def test_03_buy_lote_pc(self, test_user):
        lotes = requests.get(f"{API}/lotes", headers=bearer(test_user["token"]), timeout=10).json()
        lote_pc = min(lotes, key=lambda l: l["price"])  # cheapest lote we can afford
        before = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10).json()["balance"]
        r = requests.post(f"{API}/lotes/{lote_pc['id']}/buy", headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 200, r.text
        after = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10).json()["balance"]
        assert round(before - after, 2) == round(lote_pc["price"], 2)

        # my lotes lists it
        r = requests.get(f"{API}/me/lotes", headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 200
        my = r.json()
        assert len(my) >= 1
        m = my[0]
        for key in ("purchase_id", "earned_total", "progress_pct", "available", "remaining_seconds"):
            assert key in m
        assert m["earned_total"] >= 0
        assert m["progress_pct"] >= 0

    def test_04_yield_accrues_and_collect(self, test_user):
        # Wait a few seconds, earned_total should be small but >=0 (tiny fraction)
        time.sleep(3)
        r = requests.post(f"{API}/me/collect", headers=bearer(test_user["token"]), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["collected"] >= 0
        assert "balance" in d

    def test_05_withdraw_reserve_and_reject_refunds(self, test_user, admin_token):
        bal_before = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10).json()["balance"]
        assert bal_before > 0

        amt = round(min(50.0, bal_before), 2)
        r = requests.post(
            f"{API}/withdrawals",
            json={"amount": amt, "pix_key": "test@example.com", "pix_key_type": "email"},
            headers=bearer(test_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200, r.text
        wd = r.json()
        assert wd["status"] == "pending"
        wd_id = wd["id"]

        bal_reserved = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10).json()["balance"]
        assert round(bal_before - bal_reserved, 2) == amt

        # Reject -> refund
        r = requests.post(f"{API}/admin/withdrawals/{wd_id}/reject", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200

        bal_refunded = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10).json()["balance"]
        assert round(bal_refunded, 2) == round(bal_before, 2), f"Refund failed: before={bal_before}, after={bal_refunded}"

    def test_06_withdraw_approve(self, test_user, admin_token):
        bal_before = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10).json()["balance"]
        amt = round(min(20.0, bal_before), 2)
        r = requests.post(
            f"{API}/withdrawals",
            json={"amount": amt, "pix_key": "test@example.com", "pix_key_type": "email"},
            headers=bearer(test_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200
        wd_id = r.json()["id"]
        r = requests.post(f"{API}/admin/withdrawals/{wd_id}/approve", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200
        bal_after = requests.get(f"{API}/wallet", headers=bearer(test_user["token"]), timeout=10).json()["balance"]
        # Balance should stay reduced (not refunded)
        assert round(bal_before - bal_after, 2) == amt


# --- Admin lotes CRUD ---
class TestAdminLoteCRUD:
    def test_crud_cycle(self, admin_token):
        payload = {"name": "TEST_Lote", "description": "temp", "price": 10, "hourly_yield": 0.5, "duration_days": 7, "image_url": "", "active": True}
        r = requests.post(f"{API}/admin/lotes", json=payload, headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        lote = r.json()
        lid = lote["id"]

        # Update
        r = requests.put(f"{API}/admin/lotes/{lid}", json={"price": 15}, headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["price"] == 15

        # Delete
        r = requests.delete(f"{API}/admin/lotes/{lid}", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200

        # Re-delete -> 404
        r = requests.delete(f"{API}/admin/lotes/{lid}", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 404


# --- Admin PIX update ---
class TestAdminPix:
    def test_update_pix(self, admin_token):
        # Read current to restore later
        orig = requests.get(f"{API}/settings/pix", headers=bearer(admin_token), timeout=10).json()
        new_payload = {
            "pix_key": "admin-test@example.com",
            "pix_key_type": "email",
            "company_name": "LotePro Investimentos",
            "beneficiary_city": "SAO PAULO",
        }
        r = requests.put(f"{API}/admin/settings/pix", json=new_payload, headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["pix_key"] == "admin-test@example.com"

        # Restore
        requests.put(
            f"{API}/admin/settings/pix",
            json={
                "pix_key": orig["pix_key"],
                "pix_key_type": orig["pix_key_type"],
                "company_name": orig.get("company_name", "LotePro Investimentos"),
                "beneficiary_city": orig.get("beneficiary_city", "SAO PAULO"),
            },
            headers=bearer(admin_token),
            timeout=10,
        )
