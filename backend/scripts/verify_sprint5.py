"""Verifica E2E Sprint 5: bracket, admin endpoints, override + re-score.

Utente di test usa-e-getta (admin per i test admin). Cleanup completo.
"""
import sys

import httpx

sys.path.insert(0, ".")

from app.config import settings  # noqa: E402
from app.database import supabase_admin  # noqa: E402

BASE = "http://localhost:8000"
TEST_EMAIL = "test-e2e-sprint5@lmn.local"
TEST_PASSWORD = "test-e2e-Sprint5!pass"
KO_MATCH = 999_201  # knockout fittizio

passed, failed = [], []


def check(name, cond, extra=""):
    (passed if cond else failed).append(name)
    print(("PASS" if cond else "FAIL"), name, extra)


def cleanup(user_id=None):
    supabase_admin.table("predictions").delete().eq("match_id", KO_MATCH).execute()
    supabase_admin.table("matches").delete().eq("id", KO_MATCH).execute()
    if user_id:
        supabase_admin.table("leaderboard_snapshots").delete().eq("user_id", user_id).execute()
        supabase_admin.table("user_achievements").delete().eq("user_id", user_id).execute()
        supabase_admin.auth.admin.delete_user(user_id)


# --- utente test ADMIN
try:
    res = supabase_admin.auth.admin.create_user(
        {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"display_name": "Test E2E 5"},
        }
    )
    uid = res.user.id
except Exception:
    users = supabase_admin.auth.admin.list_users()
    uid = next(u for u in users if u.email == TEST_EMAIL).id
supabase_admin.table("profiles").update({"is_admin": True}).eq("id", uid).execute()

# --- partita knockout fittizia FINISHED + pronostico
supabase_admin.table("matches").upsert(
    {
        "id": KO_MATCH,
        "utc_date": "2026-01-02T20:00:00+00:00",
        "status": "FINISHED",
        "stage": "QUARTER_FINALS",
        "home_team_name": "KO-A",
        "away_team_name": "KO-B",
        "home_score": 1,
        "away_score": 0,
    },
    on_conflict="id",
).execute()
supabase_admin.table("predictions").upsert(
    {"user_id": uid, "match_id": KO_MATCH, "home_score": 2, "away_score": 0},
    on_conflict="user_id,match_id",
).execute()

auth = httpx.post(
    f"{settings.supabase_url}/auth/v1/token?grant_type=password",
    json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": settings.supabase_anon_key},
)
headers = {"Authorization": f"Bearer {auth.json()['access_token']}"}

try:
    # --- 1. bracket: include la partita KO con winner home
    r = httpx.get(f"{BASE}/bracket", headers=headers)
    body = r.json()
    qf = next((s for s in body["stages"] if s["stage"] == "QUARTER_FINALS"), None)
    ko = next((m for m in (qf["matches"] if qf else []) if m["match_id"] == KO_MATCH), None)
    check(
        "bracket: partita KO con winner=home",
        r.status_code == 200 and ko is not None and ko["winner"] == "home",
        str(ko),
    )
    order = [s["stage"] for s in body["stages"]]
    expected_order = [s for s in ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"] if s in order]
    check("bracket: ordine fasi corretto", order == expected_order, str(order))

    # --- 2. admin/users
    r = httpx.get(f"{BASE}/admin/users", headers=headers)
    users_list = r.json()
    me = next((u for u in users_list if u["id"] == uid), None)
    check(
        "admin/users: lista con conteggio pronostici",
        r.status_code == 200 and me is not None and me["predictions_count"] >= 1,
        str(me),
    )

    # --- 3. override: 1-0 -> 2-0 => pronostico 2-0 diventa esatto (3 x2 = 6 pt)
    r = httpx.patch(
        f"{BASE}/admin/matches/{KO_MATCH}",
        json={"home_score": 2, "away_score": 0},
        headers=headers,
    )
    check(
        "override admin + re-score",
        r.status_code == 200 and r.json()["predictions_rescored"] == 1,
        str(r.json()),
    )
    pred = (
        supabase_admin.table("predictions")
        .select("points")
        .eq("user_id", uid)
        .eq("match_id", KO_MATCH)
        .execute()
        .data
    )
    check("punti ricalcolati: esatto QF = 6", pred[0]["points"] == 6, str(pred))

    # --- 4. sync-log
    r = httpx.get(f"{BASE}/admin/sync-log", headers=headers)
    log = r.json()
    check(
        "sync-log: max 50 righe, override registrato",
        r.status_code == 200
        and len(log) <= 50
        and any("Override admin" in (row["detail"] or "") for row in log),
    )

    # --- 5. endpoints admin negati a non-admin
    supabase_admin.table("profiles").update({"is_admin": False}).eq("id", uid).execute()
    r = httpx.get(f"{BASE}/admin/users", headers=headers)
    check("admin/users negato a non-admin (403)", r.status_code == 403, str(r.status_code))

finally:
    cleanup(uid)
    print("\ncleanup ok")

print(f"\n{len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
