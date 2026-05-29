"""
Focused test of new Neon Farm admin endpoints:
  1. GET  /api/admin/stats
  2. POST /api/admin/generate-image
  3. POST /api/admin/reset
  4. DELETE /api/admin/lotes/{id}  (regression)
  5. POST /api/admin/lotes  duration_days flexibility (1..365)
"""
import os, sys, time, json, traceback
import requests

BASE = "https://lotes-gestao.preview.emergentagent.com/api"
ADMIN_EMAIL = "ggc@gmail.com"
ADMIN_PASSWORD = "@N1collas"

results = []
def log(name, ok, detail=""):
    results.append((name, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {name} :: {detail}")

def admin_headers():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}

def make_regular_user():
    ts = int(time.time() * 1000)
    email = f"qa.user.{ts}@example.com"
    payload = {"name": f"QA User {ts}", "email": email, "password": "Pass!2345"}
    r = requests.post(f"{BASE}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    j = r.json()
    return j["token"], j["user"], payload["password"]


def test_stats_schema_and_auth(adm):
    expected = {"total_users","total_lotes","total_deposits","pending_deposits","approved_deposits",
                "total_withdrawals","pending_withdrawals","total_transactions","total_notifications",
                "total_referrals","total_banned_ips","total_balance","sum_approved_deposits",
                "sum_approved_withdrawals"}
    r = requests.get(f"{BASE}/admin/stats", headers=adm, timeout=20)
    if r.status_code != 200:
        log("admin/stats GET 200 as admin", False, f"status={r.status_code} body={r.text[:200]}")
        return None
    body = r.json()
    missing = expected - set(body.keys())
    if missing:
        log("admin/stats schema", False, f"missing keys: {missing}")
    else:
        log("admin/stats schema", True, f"all {len(expected)} keys present; got {body}")

    # 403 for non-admin
    _, _, _ = make_regular_user()
    tok, _, _ = make_regular_user()
    r2 = requests.get(f"{BASE}/admin/stats", headers={"Authorization": f"Bearer {tok}"}, timeout=20)
    log("admin/stats non-admin -> 403", r2.status_code == 403, f"status={r2.status_code}")

    return body


def test_generate_image(adm):
    # admin required
    tok, _, _ = make_regular_user()
    r = requests.post(f"{BASE}/admin/generate-image", json={"prompt": "PC Gamer"},
                      headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    log("generate-image non-admin -> 403", r.status_code == 403, f"status={r.status_code}")

    # empty prompt validation -> 422
    r2 = requests.post(f"{BASE}/admin/generate-image", json={"prompt": ""}, headers=adm, timeout=30)
    log("generate-image empty prompt -> 422", r2.status_code == 422, f"status={r2.status_code} body={r2.text[:120]}")

    # actual generation (allow 90s)
    try:
        r3 = requests.post(f"{BASE}/admin/generate-image", json={"prompt": "PC Gamer"}, headers=adm, timeout=95)
    except requests.exceptions.RequestException as e:
        log("generate-image PC Gamer 200 + base64", False, f"request error: {e}")
        return
    if r3.status_code != 200:
        log("generate-image PC Gamer 200 + base64", False, f"status={r3.status_code} body={r3.text[:300]}")
        return
    j = r3.json()
    ok_url = isinstance(j.get("image_url"), str) and j["image_url"].startswith("data:image")
    ok_prompt = j.get("prompt") == "PC Gamer"
    log("generate-image PC Gamer 200 + base64", ok_url and ok_prompt,
        f"image_url_prefix={j.get('image_url','')[:30]} prompt={j.get('prompt')}")


def test_lote_duration_flex(adm):
    created_ids = []
    base_payload = {
        "name": "QA Duration Test",
        "description": "temp",
        "price": 10.0,
        "hourly_yield": 0.5,
        "image_url": "",
        "active": True,
    }
    for d in [7, 60, 90, 1, 365]:
        p = dict(base_payload); p["duration_days"] = d; p["name"] = f"QA Dur {d}"
        r = requests.post(f"{BASE}/admin/lotes", json=p, headers=adm, timeout=15)
        if r.status_code == 200 and r.json().get("duration_days") == d:
            log(f"lote create duration_days={d}", True, f"id={r.json()['id']}")
            created_ids.append(r.json()["id"])
        else:
            log(f"lote create duration_days={d}", False, f"status={r.status_code} body={r.text[:160]}")

    for d in [0, 400]:
        p = dict(base_payload); p["duration_days"] = d; p["name"] = f"QA Dur {d}"
        r = requests.post(f"{BASE}/admin/lotes", json=p, headers=adm, timeout=15)
        ok = r.status_code in (400, 422)
        log(f"lote create duration_days={d} -> rejected", ok, f"status={r.status_code}")

    return created_ids


def test_lote_delete_regression(adm):
    p = {"name":"QA DeleteMe","description":"temp","price":5.0,"hourly_yield":0.1,
         "duration_days":3,"image_url":"","active":True}
    r = requests.post(f"{BASE}/admin/lotes", json=p, headers=adm, timeout=15)
    if r.status_code != 200:
        log("lote create (for delete regression)", False, f"status={r.status_code} body={r.text[:160]}")
        return
    lote_id = r.json()["id"]
    log("lote create (for delete regression)", True, f"id={lote_id}")

    r2 = requests.delete(f"{BASE}/admin/lotes/{lote_id}", headers=adm, timeout=15)
    log("DELETE /admin/lotes/{id} -> 200", r2.status_code == 200, f"status={r2.status_code}")

    # confirm gone: trying to delete again must be 404
    r3 = requests.delete(f"{BASE}/admin/lotes/{lote_id}", headers=adm, timeout=15)
    log("DELETE again -> 404 (verifies deletion)", r3.status_code == 404, f"status={r3.status_code}")


def cleanup_lotes(adm, ids):
    for lid in ids:
        try:
            requests.delete(f"{BASE}/admin/lotes/{lid}", headers=adm, timeout=15)
        except Exception:
            pass


def test_reset(adm, pre_stats):
    # non-admin
    tok, _, _ = make_regular_user()
    r = requests.post(f"{BASE}/admin/reset", json={"confirm":"RESET","keep_lotes":True},
                      headers={"Authorization": f"Bearer {tok}"}, timeout=20)
    log("admin/reset non-admin -> 403", r.status_code == 403, f"status={r.status_code}")

    # wrong confirm
    r2 = requests.post(f"{BASE}/admin/reset", json={"confirm":"WRONG","keep_lotes":True}, headers=adm, timeout=20)
    body_txt = r2.text
    log("admin/reset wrong confirm -> 400 'Confirmação inválida'",
        r2.status_code == 400 and "Confirma" in body_txt and "inv" in body_txt.lower(),
        f"status={r2.status_code} body={body_txt[:160]}")

    # Pre-count lotes so we can check keep_lotes
    pre_lotes = pre_stats.get("total_lotes")

    # actual reset (once!)
    r3 = requests.post(f"{BASE}/admin/reset", json={"confirm":"RESET","keep_lotes":True}, headers=adm, timeout=30)
    if r3.status_code != 200:
        log("admin/reset OK", False, f"status={r3.status_code} body={r3.text[:200]}")
        return
    j = r3.json()
    deleted = j.get("deleted", {})
    needed = {"users","deposits","withdrawals","transactions","purchases","notifications","referrals","user_ip_logs","banned_ips"}
    missing = needed - set(deleted.keys())
    extra_lotes = "lotes" in deleted
    log("admin/reset OK with full deleted dict",
        j.get("ok") is True and not missing and not extra_lotes,
        f"deleted={deleted} (missing={missing}, lotes_present={extra_lotes})")

    # admin login still works
    r4 = requests.post(f"{BASE}/auth/login", json={"email":ADMIN_EMAIL,"password":ADMIN_PASSWORD}, timeout=20)
    log("Admin login still works after reset", r4.status_code == 200, f"status={r4.status_code}")
    if r4.status_code == 200:
        new_adm = {"Authorization": f"Bearer {r4.json()['token']}"}
    else:
        new_adm = adm

    # stats now should be ~zero, total_lotes unchanged
    r5 = requests.get(f"{BASE}/admin/stats", headers=new_adm, timeout=20)
    if r5.status_code == 200:
        s = r5.json()
        ok = (s["total_users"] == 0 and s["total_deposits"] == 0 and s["total_withdrawals"] == 0
              and s["total_transactions"] == 0 and s["total_notifications"] == 0
              and s["total_referrals"] == 0 and s["total_banned_ips"] == 0
              and s["total_lotes"] == pre_lotes)
        log("post-reset stats: zeros + total_lotes preserved", ok,
            f"users={s['total_users']} deps={s['total_deposits']} wds={s['total_withdrawals']} "
            f"tx={s['total_transactions']} notif={s['total_notifications']} ref={s['total_referrals']} "
            f"banned_ips={s['total_banned_ips']} lotes_now={s['total_lotes']} lotes_pre={pre_lotes}")
    else:
        log("post-reset stats: zeros + total_lotes preserved", False, f"status={r5.status_code}")

    return new_adm


def main():
    print(f"BASE = {BASE}")
    adm = admin_headers()
    print("Got admin token.\n")

    # === STATS (also verifies non-admin 403) ===
    pre_stats = test_stats_schema_and_auth(adm)

    # === LOTE duration_days flexibility ===
    new_ids = test_lote_duration_flex(adm)

    # === LOTE delete regression ===
    test_lote_delete_regression(adm)

    # cleanup the duration test lotes before reset (reset keeps lotes anyway, but cleaner)
    cleanup_lotes(adm, new_ids)

    # refresh pre_stats (lotes count after cleanup) for accurate post-reset comparison
    r = requests.get(f"{BASE}/admin/stats", headers=adm, timeout=20)
    if r.status_code == 200:
        pre_stats = r.json()
        print(f"\nPre-reset stats snapshot: {pre_stats}\n")

    # === IMAGE GENERATION ===
    test_generate_image(adm)

    # === RESET (only once) ===
    new_adm = test_reset(adm, pre_stats) or adm

    # === Summary ===
    fails = [r for r in results if not r[1]]
    print("\n=========================================")
    print(f"TOTAL: {len(results)}   PASS: {len(results)-len(fails)}   FAIL: {len(fails)}")
    if fails:
        print("\nFailures:")
        for n, _, d in fails:
            print(f"  - {n} :: {d}")
    print("=========================================")
    return 0 if not fails else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        traceback.print_exc()
        sys.exit(2)
