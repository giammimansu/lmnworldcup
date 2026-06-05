"""Verifica E2E Sprint 4: leaderboard, stats, achievements, snapshot/trend.

Usa SOLO un utente di test usa-e-getta (mai l'account admin reale).
Partite fittizie con id >= 999100. Cleanup completo alla fine.
"""
import sys
from datetime import date

import httpx

sys.path.insert(0, ".")

from app.config import settings  # noqa: E402
from app.database import supabase_admin  # noqa: E402
from app.services.achievements import evaluate_achievements_for_user  # noqa: E402
from app.services.leaderboard import compute_leaderboard, save_snapshot  # noqa: E402
from app.services.scoring import score_match  # noqa: E402

BASE = "http://localhost:8000"
TEST_EMAIL = "test-e2e-sprint4@lmn.local"
TEST_PASSWORD = "test-e2e-Sprint4!pass"
M = [999_101, 999_102, 999_103]  # 3 partite finite GROUP_STAGE matchday 1

passed, failed = [], []


def check(name, cond, extra=""):
    (passed if cond else failed).append(name)
    print(("PASS" if cond else "FAIL"), name, extra)


def cleanup(user_id=None):
    supabase_admin.table("predictions").delete().in_("match_id", M).execute()
    supabase_admin.table("matches").delete().in_("id", M).execute()
    if user_id:
        supabase_admin.table("leaderboard_snapshots").delete().eq(
            "user_id", user_id
        ).execute()
        supabase_admin.table("user_achievements").delete().eq(
            "user_id", user_id
        ).execute()
        supabase_admin.auth.admin.delete_user(user_id)


# --- setup utente test
try:
    res = supabase_admin.auth.admin.create_user(
        {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"display_name": "Test E2E"},
        }
    )
    test_uid = res.user.id
except Exception:
    users = supabase_admin.auth.admin.list_users()
    test_uid = next(u for u in users if u.email == TEST_EMAIL).id

# --- setup 3 partite finite, matchday 1, GROUP_STAGE
supabase_admin.table("matches").upsert(
    [
        {
            "id": M[0], "utc_date": "2026-01-01T12:00:00+00:00", "status": "FINISHED",
            "stage": "GROUP_STAGE", "matchday": 99,
            "home_team_name": "T-A", "away_team_name": "T-B",
            "home_score": 2, "away_score": 1,
        },
        {
            "id": M[1], "utc_date": "2026-01-01T15:00:00+00:00", "status": "FINISHED",
            "stage": "GROUP_STAGE", "matchday": 99,
            "home_team_name": "T-C", "away_team_name": "T-D",
            "home_score": 0, "away_score": 0,
        },
        {
            "id": M[2], "utc_date": "2026-01-01T18:00:00+00:00", "status": "FINISHED",
            "stage": "GROUP_STAGE", "matchday": 99,
            "home_team_name": "T-E", "away_team_name": "T-F",
            "home_score": 1, "away_score": 3,
        },
    ],
    on_conflict="id",
).execute()

# --- 3 pronostici tutti esatti
supabase_admin.table("predictions").upsert(
    [
        {"user_id": test_uid, "match_id": M[0], "home_score": 2, "away_score": 1},
        {"user_id": test_uid, "match_id": M[1], "home_score": 0, "away_score": 0},
        {"user_id": test_uid, "match_id": M[2], "home_score": 1, "away_score": 3},
    ],
    on_conflict="user_id,match_id",
).execute()

for mid in M:
    score_match(mid)

# --- JWT utente test
auth = httpx.post(
    f"{settings.supabase_url}/auth/v1/token?grant_type=password",
    json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": settings.supabase_anon_key},
)
token = auth.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

try:
    # --- 1. leaderboard: utente test con 9 punti, 3 esatti, 100%
    r = httpx.get(f"{BASE}/leaderboard", headers=headers)
    board = r.json()
    me = next((x for x in board if x["user_id"] == test_uid), None)
    check(
        "leaderboard: 9 pt, 3 esatti, 100%",
        r.status_code == 200
        and me is not None
        and me["points"] == 9
        and me["exact_count"] == 3
        and me["accuracy"] == 100.0,
        str(me),
    )
    check(
        "leaderboard ordinata per punti",
        all(board[i]["points"] >= board[i + 1]["points"] for i in range(len(board) - 1)),
    )

    # --- 2. stats /users/me/stats
    r = httpx.get(f"{BASE}/users/me/stats", headers=headers)
    s = r.json()
    check(
        "stats: totali corretti",
        s["total_points"] == 9
        and s["exact_count"] == 3
        and s["wrong_count"] == 0
        and s["accuracy"] == 100.0,
        str({k: s[k] for k in ('total_points', 'exact_count', 'accuracy')}),
    )
    check(
        "stats: punti per matchday",
        s["points_by_matchday"] == [{"matchday": 99, "points": 9}],
        str(s["points_by_matchday"]),
    )
    check("stats: storico 3 voci", len(s["history"]) == 3)

    # --- 3. stats pubbliche di un altro utente
    r = httpx.get(f"{BASE}/users/{test_uid}/stats", headers=headers)
    check("stats pubbliche ok", r.status_code == 200 and r.json()["exact_count"] == 3)

    # --- 4. achievements: cecchino (3 esatti) sbloccato
    evaluate_achievements_for_user(test_uid)
    r = httpx.get(f"{BASE}/users/me/achievements", headers=headers)
    ach = {a["code"]: a["unlocked"] for a in r.json()["achievements"]}
    check("achievement cecchino sbloccato", ach.get("cecchino") is True, str(ach))
    check("achievement veggente NON sbloccato (solo 3 di fila)", ach.get("veggente") is False)

    # --- 5. en_plein: tutte le partite del matchday 1 esatte -> sbloccato
    check("achievement en_plein sbloccato", ach.get("en_plein") is True, str(ach))

    # --- 6. snapshot + trend
    saved = save_snapshot()
    check("snapshot salvato", saved >= 1, str(saved))
    today = date.today().isoformat()
    snap = (
        supabase_admin.table("leaderboard_snapshots")
        .select("*")
        .eq("user_id", test_uid)
        .eq("date", today)
        .execute()
        .data
    )
    check("snapshot riga utente test", len(snap) == 1 and snap[0]["points"] == 9)

    # trend: snapshot di ieri con posizione peggiore -> trend positivo
    pos_today = snap[0]["position"]
    supabase_admin.table("leaderboard_snapshots").upsert(
        {
            "user_id": test_uid,
            "date": "2026-06-02",
            "position": pos_today + 5,
            "points": 0,
        },
        on_conflict="user_id,date",
    ).execute()
    # elimina snapshot di oggi cosÃ¬ l'ultimo Ã¨ quello di ieri
    supabase_admin.table("leaderboard_snapshots").delete().eq("date", today).execute()
    board2 = compute_leaderboard()
    me2 = next(x for x in board2 if x["user_id"] == test_uid)
    check("trend +5 dopo snapshot ieri", me2["trend"] == 5, str(me2["trend"]))

    # --- 7. comeback (trend >= 3) sbloccato
    evaluate_achievements_for_user(test_uid)
    r = httpx.get(f"{BASE}/users/me/achievements", headers=headers)
    ach = {a["code"]: a["unlocked"] for a in r.json()["achievements"]}
    check("achievement comeback sbloccato", ach.get("comeback") is True, str(ach))

finally:
    cleanup(test_uid)
    print("\ncleanup ok")

print(f"\n{len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)

