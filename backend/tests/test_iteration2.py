"""
Iteration 2 backend regression tests for LotePro.
Covers:
- POST /api/deposits now REQUIRES proof_image (base64 data URL).
- GET /api/admin/deposits returns proof_image.
- GET /api/withdrawals/rules -> first withdrawal rule set.
- POST /api/withdrawals: min 10 first, min 30 after; 10% tax after first.
- Admin reject refunds gross amount, not net.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://lotes-gestao.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ggc@gmail.com"
ADMIN_PASSWORD = "@N1collas"

# A tiny base64 PNG (1x1) as proof
PROOF_B64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0"
    "lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def user():
    """Fresh user per test session — avoids cross-contamination with iteration 1 withdrawals."""
    email = f"TEST_it2_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"name": "TEST It2", "email": email, "password": "Senha123!"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["token"], "id": d["user"]["id"]}


# ---------------------------------------------------------------------------
# DEPOSITS — proof_image required
# ---------------------------------------------------------------------------
class TestDepositProof:
    def test_deposit_without_proof_rejected_422(self, user):
        r = requests.post(
            f"{API}/deposits",
            json={"amount": 100.0},
            headers=bearer(user["token"]),
            timeout=10,
        )
        assert r.status_code == 422, f"Expected 422, got {r.status_code} {r.text}"

    def test_deposit_with_proof_ok_and_stored(self, user, admin_token):
        r = requests.post(
            f"{API}/deposits",
            json={"amount": 100.0, "proof_image": PROOF_B64},
            headers=bearer(user["token"]),
            timeout=10,
        )
        assert r.status_code == 200, r.text
        dep = r.json()
        assert dep["status"] == "pending"
        assert dep["amount"] == 100.0
        assert dep["proof_image"] == PROOF_B64
        assert "_id" not in dep
        dep_id = dep["id"]

        # Admin list shows proof_image
        r = requests.get(
            f"{API}/admin/deposits", params={"status": "pending"},
            headers=bearer(admin_token), timeout=10,
        )
        assert r.status_code == 200
        match = next((d for d in r.json() if d["id"] == dep_id), None)
        assert match is not None, "Admin should see the new deposit"
        assert match.get("proof_image") == PROOF_B64

    def test_deposit_empty_proof_rejected(self, user):
        r = requests.post(
            f"{API}/deposits",
            json={"amount": 50.0, "proof_image": ""},
            headers=bearer(user["token"]),
            timeout=10,
        )
        # min_length=10 -> 422
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# WITHDRAWAL RULES + TAX LOGIC
# ---------------------------------------------------------------------------
class TestWithdrawalRules:
    """Full flow using a DEDICATED user so first/second withdrawal semantics are clean."""

    @pytest.fixture(scope="class")
    def w_user(self, admin_token):
        email = f"TEST_wd_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(
            f"{API}/auth/register",
            json={"name": "TEST Wd", "email": email, "password": "Senha123!"},
            timeout=10,
        )
        assert r.status_code == 200
        tok = r.json()["token"]

        # Credit 200 via deposit + admin approve
        rd = requests.post(
            f"{API}/deposits",
            json={"amount": 200.0, "proof_image": PROOF_B64},
            headers=bearer(tok),
            timeout=10,
        )
        assert rd.status_code == 200
        dep_id = rd.json()["id"]
        ra = requests.post(f"{API}/admin/deposits/{dep_id}/approve",
                           headers=bearer(admin_token), timeout=10)
        assert ra.status_code == 200

        bal = requests.get(f"{API}/wallet", headers=bearer(tok), timeout=10).json()["balance"]
        assert bal >= 200.0
        return {"token": tok, "email": email}

    def test_01_rules_first_time(self, w_user):
        r = requests.get(f"{API}/withdrawals/rules", headers=bearer(w_user["token"]), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["is_first_withdrawal"] is True
        assert d["min_amount"] == 10.0
        assert d["tax_pct"] == 0.0
        assert "primeiro" in d["message"].lower()

    def test_02_first_withdraw_below_10_rejected(self, w_user):
        r = requests.post(
            f"{API}/withdrawals",
            json={"amount": 5.0, "pix_key": "a@b.com", "pix_key_type": "email"},
            headers=bearer(w_user["token"]), timeout=10,
        )
        assert r.status_code == 400
        assert "10" in r.json()["detail"]
        assert "primeiro" in r.json()["detail"].lower()

    def test_03_first_withdraw_10_ok_no_tax(self, w_user, admin_token):
        bal_before = requests.get(f"{API}/wallet", headers=bearer(w_user["token"]), timeout=10).json()["balance"]
        r = requests.post(
            f"{API}/withdrawals",
            json={"amount": 10.0, "pix_key": "a@b.com", "pix_key_type": "email"},
            headers=bearer(w_user["token"]), timeout=10,
        )
        assert r.status_code == 200, r.text
        wd = r.json()
        assert wd["tax_pct"] == 0.0
        assert wd["tax_amount"] == 0.0
        assert wd["net_amount"] == 10.0
        assert wd["is_first_withdrawal"] is True
        assert wd["amount"] == 10.0

        bal_after = requests.get(f"{API}/wallet", headers=bearer(w_user["token"]), timeout=10).json()["balance"]
        assert round(bal_before - bal_after, 2) == 10.0

        # Approve so the user is no longer "first"
        ra = requests.post(f"{API}/admin/withdrawals/{wd['id']}/approve",
                           headers=bearer(admin_token), timeout=10)
        assert ra.status_code == 200
        pytest.first_wd_id = wd["id"]

    def test_04_rules_after_first_approved(self, w_user):
        r = requests.get(f"{API}/withdrawals/rules", headers=bearer(w_user["token"]), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["is_first_withdrawal"] is False
        assert d["min_amount"] == 30.0
        assert d["tax_pct"] == 10.0

    def test_05_second_withdraw_below_30_rejected(self, w_user):
        r = requests.post(
            f"{API}/withdrawals",
            json={"amount": 20.0, "pix_key": "a@b.com", "pix_key_type": "email"},
            headers=bearer(w_user["token"]), timeout=10,
        )
        assert r.status_code == 400
        assert "30" in r.json()["detail"]

    def test_06_second_withdraw_50_taxed(self, w_user, admin_token):
        bal_before = requests.get(f"{API}/wallet", headers=bearer(w_user["token"]), timeout=10).json()["balance"]
        assert bal_before >= 50.0, f"Need >=50 balance, got {bal_before}"
        r = requests.post(
            f"{API}/withdrawals",
            json={"amount": 50.0, "pix_key": "a@b.com", "pix_key_type": "email"},
            headers=bearer(w_user["token"]), timeout=10,
        )
        assert r.status_code == 200, r.text
        wd = r.json()
        assert wd["tax_pct"] == 10.0
        assert wd["tax_amount"] == 5.0
        assert wd["net_amount"] == 45.0
        assert wd["is_first_withdrawal"] is False
        assert wd["amount"] == 50.0

        bal_after = requests.get(f"{API}/wallet", headers=bearer(w_user["token"]), timeout=10).json()["balance"]
        # gross 50 reserved
        assert round(bal_before - bal_after, 2) == 50.0

        pytest.second_wd_id = wd["id"]
        pytest.bal_before_reject = bal_before

    def test_07_reject_second_refunds_gross_50(self, w_user, admin_token):
        wd_id = pytest.second_wd_id
        r = requests.post(f"{API}/admin/withdrawals/{wd_id}/reject",
                          headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200
        bal_after = requests.get(f"{API}/wallet", headers=bearer(w_user["token"]), timeout=10).json()["balance"]
        # refunded gross, so balance should be back to bal_before_reject
        assert round(bal_after, 2) == round(pytest.bal_before_reject, 2), \
            f"Expected refund of gross 50 -> {pytest.bal_before_reject}, got {bal_after}"

    def test_08_admin_withdrawals_exposes_tax_fields(self, admin_token):
        r = requests.get(f"{API}/admin/withdrawals", headers=bearer(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        # at least one of ours should have tax fields populated
        taxed = [w for w in data if w.get("tax_pct") is not None]
        assert len(taxed) >= 1
        for key in ("tax_pct", "tax_amount", "net_amount", "is_first_withdrawal", "amount"):
            assert key in taxed[0]
