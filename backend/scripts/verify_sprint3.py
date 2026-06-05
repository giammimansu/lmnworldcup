"""Verifica end-to-end Sprint 3 contro il backend locale (localhost:8000).

Crea una partita fittizia già iniziata e una futura, testa deadline 403,
upsert pronostico, scoring e summary. Pulisce tutto alla fine.
"""
import sys

import httpx

sys.path.insert(0, ".")

from app.database import supabase_admin  # noqa: E402
from app.services.scoring import score_match  # noqa: E402

BASE = "http://localhost:8000"
TEST_USER_EMAIL = "gianmarcomansueti@live.it"
TEST_PASSWORD = "sprint3-verify-Temp!42"
PAST_MATCH_ID = 999_001
FUTURE_MATCH_ID = 999_002

passed = []
failed = []


def check(name: str, cond: bool, extra: str = ""):
    (passed if cond else failed).append(name + (f" [{extra}]" if extra else ""))
    print(("PASS" if cond else "FAIL"), name, extra)


# --- setup: partite fittizie
supabase_admin.table("matches").upsert(
    [
        {
            "id": PAST_MATCH_ID,
            "utc_date": "2026-01-01T12:00:00+00:00",  # già iniziata
            "status": "FINISHED",
            "stage": "FINAL",
            "home_team_name": "Test Casa",
            "away_team_name": "Test Ospite",
            "home_score": 2,
            "away_score": 1,
        },
        {
            "id": FUTURE_MATCH_ID,
            "utc_date": "2027-01-01T12:00:00+00:00",  # futura
            "status": "TIMED",
            "stage": "GROUP_STAGE",
            "home_team_name": "Test Futura A",
            "away_team_name": "Test Futura B",
        },
    ],
    on_conflict="id",
).execute()

# --- setup: password temporanea per ottenere un JWT reale
users = supabase_admin.auth.admin.list_users()
user = next(u for u in users if u.email == TEST_USER_EMAIL)
supabase_admin.auth.admin.update_user_by_id(user.id, {"password": TEST_PASSWORD})

from app.config import settings  # noqa: E402

auth_resp = httpx.post(
    f"{settings.supabase_url}/auth/v1/token?grant_type=password",
    json={"email": TEST_USER_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": settings.supabase_anon_key},
)
token = auth_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# --- 1. POST su partita iniziata -> 403
r = httpx.post(
    f"{BASE}/predictions",
    json={"match_id": PAST_MATCH_ID, "home_score": 1, "away_score": 0},
    headers=headers,
)
check("403 su partita iniziata", r.status_code == 403, str(r.status_code))

# --- 2. POST su partita futura -> ok
r = httpx.post(
    f"{BASE}/predictions",
    json={"match_id": FUTURE_MATCH_ID, "home_score": 2, "away_score": 0},
    headers=headers,
)
check("pronostico su futura creato", r.status_code == 200, str(r.status_code))

# --- 3. modifica pronostico (upsert) -> ok
r = httpx.post(
    f"{BASE}/predictions",
    json={"match_id": FUTURE_MATCH_ID, "home_score": 3, "away_score": 1},
    headers=headers,
)
check(
    "pronostico modificabile",
    r.status_code == 200 and r.json()["home_score"] == 3,
    str(r.status_code),
)

# --- 4. GET /predictions/me con outcome pending
r = httpx.get(f"{BASE}/predictions/me", headers=headers)
mine = [p for p in r.json() if p["match_id"] == FUTURE_MATCH_ID]
check("GET /me outcome pending", bool(mine) and mine[0]["outcome"] == "pending")

# --- 5. summary su partita NON iniziata -> 403
r = httpx.get(f"{BASE}/predictions/match/{FUTURE_MATCH_ID}/summary", headers=headers)
check("summary 403 prima del kickoff", r.status_code == 403, str(r.status_code))

# --- 6. scoring: pronostico diretto su partita finita (FINAL 2-1, pron. 2-1 = 9pt)
supabase_admin.table("predictions").upsert(
    {
        "user_id": user.id,
        "match_id": PAST_MATCH_ID,
        "home_score": 2,
        "away_score": 1,
    },
    on_conflict="user_id,match_id",
).execute()
updated = score_match(PAST_MATCH_ID)
pred = (
    supabase_admin.table("predictions")
    .select("points")
    .eq("match_id", PAST_MATCH_ID)
    .eq("user_id", user.id)
    .execute()
)
check("score_match: esatto FINAL = 9 punti", pred.data[0]["points"] == 9, str(pred.data))

# --- 7. summary su partita iniziata -> ok
r = httpx.get(f"{BASE}/predictions/match/{PAST_MATCH_ID}/summary", headers=headers)
body = r.json()
check(
    "summary dopo kickoff",
    r.status_code == 200 and body["total"] == 1 and body["signs"]["home"] == 100.0,
    str(body),
)

# --- 8. GET /me outcome exact
r = httpx.get(f"{BASE}/predictions/me", headers=headers)
mine = [p for p in r.json() if p["match_id"] == PAST_MATCH_ID]
check("GET /me outcome exact", bool(mine) and mine[0]["outcome"] == "exact")

# --- cleanup
supabase_admin.table("predictions").delete().in_(
    "match_id", [PAST_MATCH_ID, FUTURE_MATCH_ID]
).execute()
supabase_admin.table("matches").delete().in_(
    "id", [PAST_MATCH_ID, FUTURE_MATCH_ID]
).execute()
print("\ncleanup ok")
print(f"\n{len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
