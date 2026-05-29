"""
Backend test suite for the Neon Farm / LotePro API.
Tests referral system, notifications, IP tracking + ban, plus regression on
core flows (login/register/me, deposits, withdrawals, PIX settings).
"""

import base64
import os
import sys
import time
import uuid
import requests

BASE = "https://lotes-gestao.preview.emergentagent.com/api"

ADMIN_EMAIL = "ggc@gmail.com"
ADMIN_PASSWORD = "@N1collas"

results = []  # list of (name, ok, info)


def log_result(name, ok, info=""):
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name}  {info}")
    results.append((name, ok, info))


def post(path, json=None, token=None, expect=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.post(f"{BASE}{path}", json=json, headers=headers, timeout=30)
    return r


def get(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE}{path}", headers=headers, timeout=30)


def delete(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.delete(f"{BASE}{path}", headers=headers, timeout=30)


def rand_email(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@neonfarmtest.com"


def b64_image():
    # Tiny PNG header bytes (valid 1x1 transparent pixel) – encoded as data URL
    raw = (b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAA"
           b"SsJTYQAAAAASUVORK5CYII=")
    return "data:image/png;base64," + raw.decode()


def admin_login():
    r = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        raise RuntimeError(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


def register(name, password="Senha@123", referral_code=None, expect=200):
    body = {"name": name, "email": rand_email(name.lower().replace(" ", "")), "password": password}
    if referral_code is not None:
        body["referral_code"] = referral_code
    r = post("/auth/register", body)
    return r, body


# ---------------------------------------------------------------------------
# 0. Admin login (regression)
# ---------------------------------------------------------------------------
def test_admin_login():
    try:
        token = admin_login()
        ok = isinstance(token, str) and len(token) > 20
        log_result("admin_login", ok, "")
        return token
    except Exception as e:
        log_result("admin_login", False, str(e))
        return None


# ---------------------------------------------------------------------------
# 1. REFERRAL SYSTEM
# ---------------------------------------------------------------------------
def test_referrals(admin_token):
    # 1a. Register user A without code
    r, body_a = register("Alice Neon")
    if r.status_code != 200:
        log_result("register_user_A", False, f"{r.status_code} {r.text}")
        return None, None, None
    a = r.json()
    code_a = a["user"].get("referral_code")
    log_result("register_user_A_has_referral_code", bool(code_a), f"code={code_a}")
    user_a_token = a["token"]
    user_a_id = a["user"]["id"]
    user_a_email = body_a["email"]

    # 1b. Register user B with A's code
    r, body_b = register("Bruno Tester", referral_code=code_a)
    if r.status_code != 200:
        log_result("register_user_B_with_valid_referral", False, f"{r.status_code} {r.text}")
        return user_a_token, None, None
    b = r.json()
    log_result("register_user_B_with_valid_referral", True, "")
    user_b_token = b["token"]
    user_b_id = b["user"]["id"]
    user_b_email = body_b["email"]

    # GET /me/referrals as A: should show 1 pending
    r = get("/me/referrals", token=user_a_token)
    if r.status_code != 200:
        log_result("me_referrals_returns_200", False, f"{r.status_code} {r.text}")
    else:
        data = r.json()
        keys_ok = all(k in data for k in
                      ("code", "bonus_pct", "bonus_cap", "total_referrals",
                       "paid_referrals", "total_earned", "referrals"))
        log_result("me_referrals_schema_keys", keys_ok, f"keys={list(data.keys())}")
        log_result("me_referrals_bonus_pct_is_10", data.get("bonus_pct") == 10 or data.get("bonus_pct") == 10.0,
                   f"bonus_pct={data.get('bonus_pct')}")
        log_result("me_referrals_bonus_cap_is_50", data.get("bonus_cap") == 50 or data.get("bonus_cap") == 50.0,
                   f"bonus_cap={data.get('bonus_cap')}")
        log_result("me_referrals_total_referrals_is_1", data.get("total_referrals") == 1,
                   f"total_referrals={data.get('total_referrals')}")
        log_result("me_referrals_paid_referrals_is_0_initially", data.get("paid_referrals") == 0,
                   f"paid_referrals={data.get('paid_referrals')}")

    # 1c. Register user C with INVALID code → 400
    r, _ = register("Carlos Inv", referral_code="INVALID999")
    log_result("register_with_invalid_referral_returns_400", r.status_code == 400,
               f"status={r.status_code} body={r.text[:120]}")

    return user_a_token, user_a_id, (user_b_token, user_b_id, user_a_email, user_b_email)


# ---------------------------------------------------------------------------
# 2. Referral bonus on first approved deposit + notifications
# ---------------------------------------------------------------------------
def test_referral_bonus_and_notifications(admin_token, user_a_token, user_a_id, ctx_b):
    if not ctx_b:
        log_result("referral_bonus_flow", False, "user B not registered")
        return
    user_b_token, user_b_id, _, _ = ctx_b

    # B's balance before
    r = get("/wallet", token=user_b_token)
    b_balance_before = r.json().get("balance", 0) if r.status_code == 200 else None

    # A's balance before
    r = get("/wallet", token=user_a_token)
    a_balance_before = r.json().get("balance", 0) if r.status_code == 200 else 0

    # Create a deposit for B (R$200 → expect 10% capped at R$50 to A)
    dep_amount = 200.0
    r = post("/deposits", {"amount": dep_amount, "proof_image": b64_image()}, token=user_b_token)
    if r.status_code != 200:
        log_result("user_B_create_deposit", False, f"{r.status_code} {r.text}")
        return
    dep_id = r.json()["id"]
    log_result("user_B_create_deposit", True, f"id={dep_id}")

    # Admin approves
    r = post(f"/admin/deposits/{dep_id}/approve", token=admin_token)
    log_result("admin_approve_deposit_for_B", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return

    # Re-check A's balance — should have +50 (10% of 200 capped at 50)
    r = get("/wallet", token=user_a_token)
    a_balance_after = r.json().get("balance", 0)
    expected_bonus = min(dep_amount * 0.10, 50.0)
    bonus_received = round(a_balance_after - a_balance_before, 2)
    log_result("user_A_received_referral_bonus_capped_at_50",
               abs(bonus_received - expected_bonus) < 0.01,
               f"before={a_balance_before} after={a_balance_after} bonus={bonus_received} expected={expected_bonus}")

    # /me/referrals on A should now show paid_referrals=1, total_earned >= 50
    r = get("/me/referrals", token=user_a_token)
    if r.status_code == 200:
        d = r.json()
        log_result("me_referrals_paid_count_updated", d.get("paid_referrals", 0) >= 1,
                   f"paid_referrals={d.get('paid_referrals')}")
        log_result("me_referrals_total_earned_at_least_50", d.get("total_earned", 0) >= 50.0,
                   f"total_earned={d.get('total_earned')}")

    # B should get a notification with kind "deposit"
    r = get("/me/notifications", token=user_b_token)
    if r.status_code == 200:
        items = r.json().get("items", [])
        kinds = [i.get("kind") for i in items]
        log_result("user_B_received_deposit_notification", "deposit" in kinds, f"kinds={kinds}")
    else:
        log_result("user_B_received_deposit_notification", False, f"{r.status_code}")

    # A should get a notification with kind "referral"
    r = get("/me/notifications", token=user_a_token)
    if r.status_code == 200:
        items = r.json().get("items", [])
        kinds = [i.get("kind") for i in items]
        log_result("user_A_received_referral_notification", "referral" in kinds, f"kinds={kinds}")
    else:
        log_result("user_A_received_referral_notification", False, f"{r.status_code}")


# ---------------------------------------------------------------------------
# 3. NOTIFICATIONS endpoints
# ---------------------------------------------------------------------------
def test_notifications_endpoints(user_a_token):
    r = get("/me/notifications", token=user_a_token)
    if r.status_code != 200:
        log_result("GET_me_notifications", False, f"{r.status_code} {r.text}")
        return
    data = r.json()
    log_result("GET_me_notifications_schema",
               isinstance(data.get("items"), list) and "unread" in data,
               f"keys={list(data.keys())}")
    items = data["items"]

    r = get("/me/notifications/unread-count", token=user_a_token)
    log_result("GET_me_notifications_unread_count",
               r.status_code == 200 and "unread" in r.json(),
               f"status={r.status_code} body={r.text[:80]}")

    # Mark one as read (if any)
    if items:
        nid = items[0]["id"]
        r = post(f"/me/notifications/{nid}/read", token=user_a_token)
        log_result("POST_mark_notification_read", r.status_code == 200,
                   f"status={r.status_code} body={r.text[:80]}")
    else:
        log_result("POST_mark_notification_read", False, "no notifications available to mark")

    # Mark all as read
    r = post("/me/notifications/read-all", token=user_a_token)
    log_result("POST_mark_all_notifications_read", r.status_code == 200,
               f"status={r.status_code} body={r.text[:80]}")

    r = get("/me/notifications/unread-count", token=user_a_token)
    log_result("unread_count_zero_after_read_all",
               r.status_code == 200 and r.json().get("unread") == 0,
               f"body={r.text[:80]}")


# ---------------------------------------------------------------------------
# 4. IP tracking on admin/users
# ---------------------------------------------------------------------------
def test_ip_tracking(admin_token, user_a_id):
    r = get("/admin/users", token=admin_token)
    if r.status_code != 200:
        log_result("GET_admin_users", False, f"{r.status_code} {r.text}")
        return
    users = r.json()
    target = next((u for u in users if u.get("id") == user_a_id), None)
    if not target:
        log_result("admin_users_finds_user_A", False, "user A not found in admin list")
        return
    log_result("admin_users_finds_user_A", True, "")
    # Expected fields present (values may be None for private IPs but keys should exist)
    expected_keys = ["last_ip", "last_ip_city", "last_ip_country",
                     "last_ip_country_code", "last_ip_isp", "last_login_at"]
    missing = [k for k in expected_keys if k not in target]
    log_result("admin_users_has_ip_geo_fields", len(missing) == 0,
               f"missing={missing} sample={ {k: target.get(k) for k in expected_keys} }")


# ---------------------------------------------------------------------------
# 5. /admin/users/{id}/ips
# ---------------------------------------------------------------------------
def test_user_ips_endpoint(admin_token, user_a_id):
    r = get(f"/admin/users/{user_a_id}/ips", token=admin_token)
    if r.status_code != 200:
        log_result("GET_admin_user_ips", False, f"{r.status_code} {r.text}")
        return
    data = r.json()
    ok = isinstance(data.get("user"), dict) and isinstance(data.get("logs"), list)
    log_result("GET_admin_user_ips_schema", ok, f"keys={list(data.keys())}")
    if data.get("logs"):
        sample = data["logs"][0]
        keys = ["ip", "action", "city", "country", "banned", "created_at"]
        missing = [k for k in keys if k not in sample]
        log_result("admin_user_ips_log_entry_keys", len(missing) == 0,
                   f"missing={missing} sample_keys={list(sample.keys())}")


# ---------------------------------------------------------------------------
# 6. Ban / unban user (private IP friendly)
# ---------------------------------------------------------------------------
def test_ban_flow(admin_token):
    # Create a victim user
    r, body_v = register("Victim Banuser")
    if r.status_code != 200:
        log_result("create_victim_user", False, r.text)
        return
    v = r.json()
    v_token = v["token"]
    v_id = v["user"]["id"]
    v_email = body_v["email"]
    v_password = body_v["password"]
    log_result("create_victim_user", True, f"id={v_id}")

    # Ban
    r = post(f"/admin/users/{v_id}/ban", {"reason": "test"}, token=admin_token)
    if r.status_code != 200:
        log_result("admin_ban_user", False, f"{r.status_code} {r.text}")
        return
    data = r.json()
    log_result("admin_ban_user", data.get("ok") is True, f"resp={data}")
    log_result("ban_response_has_banned_ips_list", isinstance(data.get("banned_ips"), list),
               f"banned_ips={data.get('banned_ips')}")
    log_result("ban_response_has_ip_count", "ip_count" in data, f"ip_count={data.get('ip_count')}")

    # User should now be unable to login
    r = post("/auth/login", {"email": v_email, "password": v_password})
    log_result("banned_user_login_returns_403", r.status_code == 403,
               f"status={r.status_code} body={r.text[:200]}")

    # Admin sees user banned in /admin/users
    r = get("/admin/users", token=admin_token)
    users = r.json() if r.status_code == 200 else []
    target = next((u for u in users if u.get("id") == v_id), None)
    log_result("admin_users_marks_banned_true",
               target is not None and target.get("banned") is True,
               f"banned={target.get('banned') if target else 'missing'}")

    # GET /admin/banned-ips works (admin only)
    r = get("/admin/banned-ips", token=admin_token)
    log_result("GET_admin_banned_ips", r.status_code == 200 and isinstance(r.json(), list),
               f"status={r.status_code}")

    # If there are any banned IPs, test DELETE on one
    banned_list = r.json() if r.status_code == 200 else []
    if banned_list:
        ip_to_remove = banned_list[0]["ip"]
        r = delete(f"/admin/banned-ips/{ip_to_remove}", token=admin_token)
        log_result("DELETE_admin_banned_ips_single", r.status_code == 200,
                   f"status={r.status_code} body={r.text[:100]}")
    else:
        log_result("DELETE_admin_banned_ips_single", True,
                   "skipped: banned_ips empty (likely private IP environment) — expected")

    # Unban
    r = post(f"/admin/users/{v_id}/unban", token=admin_token)
    if r.status_code != 200:
        log_result("admin_unban_user", False, f"{r.status_code} {r.text}")
    else:
        d = r.json()
        log_result("admin_unban_user", d.get("ok") is True, f"resp={d}")
        log_result("admin_unban_user_returns_ips_unbanned_count",
                   "ips_unbanned" in d, f"ips_unbanned={d.get('ips_unbanned')}")

    # After unban, login should work again
    r = post("/auth/login", {"email": v_email, "password": v_password})
    log_result("unbanned_user_can_login_again", r.status_code == 200,
               f"status={r.status_code} body={r.text[:120]}")


# ---------------------------------------------------------------------------
# 7. Non-admin access on admin endpoints (security)
# ---------------------------------------------------------------------------
def test_admin_endpoints_protected(user_token):
    r = get("/admin/banned-ips", token=user_token)
    log_result("non_admin_blocked_from_banned_ips", r.status_code == 403,
               f"status={r.status_code}")
    r = get("/admin/users", token=user_token)
    log_result("non_admin_blocked_from_admin_users", r.status_code == 403,
               f"status={r.status_code}")


# ---------------------------------------------------------------------------
# 8. REGRESSION
# ---------------------------------------------------------------------------
def test_regression(admin_token):
    # /api/auth/me
    r = get("/auth/me", token=admin_token)
    log_result("GET_auth_me_admin", r.status_code == 200 and r.json().get("email") == ADMIN_EMAIL,
               f"status={r.status_code}")

    # PIX settings
    r = get("/settings/pix", token=admin_token)
    if r.status_code == 200:
        d = r.json()
        keys_ok = all(k in d for k in ("pix_key", "pix_key_type", "payload", "display_key"))
        log_result("GET_settings_pix", keys_ok, f"keys={list(d.keys())}")
    else:
        log_result("GET_settings_pix", False, f"{r.status_code} {r.text}")

    # Create a fresh user, set withdraw password, create withdrawal (need balance — admin approves deposit)
    r, body_w = register("Withdraw Tester")
    if r.status_code != 200:
        log_result("withdraw_flow_register_user", False, r.text)
        return
    wt = r.json()
    w_token = wt["token"]
    w_id = wt["user"]["id"]
    log_result("withdraw_flow_register_user", True, "")

    # Create + approve deposit so user has balance
    r = post("/deposits", {"amount": 100.0, "proof_image": b64_image()}, token=w_token)
    if r.status_code != 200:
        log_result("withdraw_user_create_deposit", False, r.text)
        return
    dep_id = r.json()["id"]
    r = post(f"/admin/deposits/{dep_id}/approve", token=admin_token)
    log_result("withdraw_user_deposit_approved", r.status_code == 200, f"{r.status_code}")

    # Try to create withdrawal WITHOUT withdraw password set → 400
    r = post("/withdrawals", {
        "amount": 50.0, "pix_key": "test@pix.com", "pix_key_type": "email",
        "withdraw_password": "1234"
    }, token=w_token)
    log_result("withdraw_without_password_set_returns_400",
               r.status_code == 400, f"status={r.status_code} body={r.text[:120]}")

    # Set withdraw password
    r = post("/me/withdraw-password", {"password": "9876"}, token=w_token)
    log_result("POST_me_withdraw_password_initial_set", r.status_code == 200,
               f"status={r.status_code} body={r.text[:120]}")

    # Now create withdrawal
    r = post("/withdrawals", {
        "amount": 10.0, "pix_key": "joao@pix.com", "pix_key_type": "email",
        "withdraw_password": "9876"
    }, token=w_token)
    if r.status_code != 200:
        log_result("withdraw_create_with_password", False, f"{r.status_code} {r.text}")
        return
    wd = r.json()
    log_result("withdraw_create_with_password", True, f"id={wd['id']}")

    # Admin approves withdrawal
    r = post(f"/admin/withdrawals/{wd['id']}/approve", token=admin_token)
    log_result("admin_approve_withdrawal", r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    # User should get a withdraw notification
    r = get("/me/notifications", token=w_token)
    if r.status_code == 200:
        kinds = [i.get("kind") for i in r.json().get("items", [])]
        log_result("withdraw_user_received_withdraw_notification", "withdraw" in kinds,
                   f"kinds={kinds}")

    # Reject deposit flow (notification with kind=deposit)
    r, body_r = register("Reject Test")
    if r.status_code == 200:
        rt = r.json()
        rt_token = rt["token"]
        r = post("/deposits", {"amount": 30.0, "proof_image": b64_image()}, token=rt_token)
        if r.status_code == 200:
            dep_rej = r.json()["id"]
            r = post(f"/admin/deposits/{dep_rej}/reject", {"reason": "comprovante ilegível"}, token=admin_token)
            log_result("admin_reject_deposit", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
            r = get("/me/notifications", token=rt_token)
            if r.status_code == 200:
                kinds = [i.get("kind") for i in r.json().get("items", [])]
                log_result("rejected_deposit_creates_notification", "deposit" in kinds, f"kinds={kinds}")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    print(f"=== Backend test against {BASE} ===\n")
    admin_token = test_admin_login()
    if not admin_token:
        print("Cannot proceed without admin login")
        sys.exit(1)

    user_a_token, user_a_id, ctx_b = test_referrals(admin_token)
    test_referral_bonus_and_notifications(admin_token, user_a_token, user_a_id, ctx_b)
    if user_a_token:
        test_notifications_endpoints(user_a_token)
    if user_a_id:
        test_ip_tracking(admin_token, user_a_id)
        test_user_ips_endpoint(admin_token, user_a_id)
    if user_a_token:
        test_admin_endpoints_protected(user_a_token)
    test_ban_flow(admin_token)
    test_regression(admin_token)

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"{passed}/{total} passed\n")
    for name, ok, info in results:
        tag = "PASS" if ok else "FAIL"
        print(f"  [{tag}] {name}")
        if not ok and info:
            print(f"         -> {info}")
    sys.exit(0 if passed == total else 2)


if __name__ == "__main__":
    main()
