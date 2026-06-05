"""Verifica E2E Sprint 7: recap giornata (sola lettura).

Tre utenti usa-e-getta (owner, membro, estraneo) + partite fittizie matchday 99.
Cleanup completo. Richiede backend su localhost:8000.
"""
import sys

import httpx

sys.path.insert(0, ".")

from app.config import settings  # noqa: E402
from app.database import supabase_admin  # noqa: E402

BASE = "http://localhost:8000"
MD = 99
M_A = 999_701  # FINISHED 2-1
M_B = 999_702  # FINISHED 0-0
M_T = 999_703  # TIMED (deve essere escluso)
USERS = {
    "owner": ("test-e2e-s7-owner@lmn.local", "test-e2e-S7-owner!pass", "Test S7 Owner"),
    "member": ("test-e2e-s7-member@lmn.local", "test-e2e-S7-member!pass", "Test S7 Member"),
    "outsider": ("test-e2e-s7-out@lmn.local", "test-e2e-S7-out!pass", "Test S7 Outsider"),
}

passed, failed = [], []


def check(name, cond, extra=""):
    (passed if cond else failed).append(name)
    print(("PASS" if cond else "FAIL"), name, extra)


def make_user(email, password, display_name):
    try:
        res = supabase_admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"display_name": display_name},
            }
        )
        return res.user.id
    except Exception:
        users = supabase_admin.auth.admin.list_users()
        return next(u for u in users if u.email == email).id


def token(email, password):
    r = httpx.post(
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": settings.supabase_anon_key},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


ids = {role: make_user(*info) for role, info in USERS.items()}
hdr = {role: token(USERS[role][0], USERS[role][1]) for role in USERS}


def seed():
    supabase_admin.table("matches").upsert(
        [
            {"id": M_A, "utc_date": "2026-01-10T18:00:00+00:00", "status": "FINISHED",
             "stage": "GROUP_STAGE", "matchday": MD, "home_team_name": "MD-A1",
             "away_team_name": "MD-A2", "home_score": 2, "away_score": 1},
            {"id": M_B, "utc_date": "2026-01-10T20:00:00+00:00", "status": "FINISHED",
             "stage": "GROUP_STAGE", "matchday": MD, "home_team_name": "MD-B1",
             "away_team_name": "MD-B2", "home_score": 0, "away_score": 0},
            {"id": M_T, "utc_date": "2026-01-11T20:00:00+00:00", "status": "TIMED",
             "stage": "GROUP_STAGE", "matchday": MD, "home_team_name": "MD-T1",
             "away_team_name": "MD-T2"},
        ],
        on_conflict="id",
    ).execute()
    # owner: A esatto (3) + B esatto (3) = 6 ; member: A 1 + B 0 = 1
    supabase_admin.table("predictions").upsert(
        [
            {"user_id": ids["owner"], "match_id": M_A, "home_score": 2, "away_score": 1, "points": 3},
            {"user_id": ids["owner"], "match_id": M_B, "home_score": 0, "away_score": 0, "points": 3},
            {"user_id": ids["member"], "match_id": M_A, "home_score": 1, "away_score": 1, "points": 1},
            {"user_id": ids["member"], "match_id": M_B, "home_score": 1, "away_score": 0, "points": 0},
        ],
        on_conflict="user_id,match_id",
    ).execute()


def cleanup():
    supabase_admin.table("predictions").delete().in_("match_id", [M_A, M_B, M_T]).execute()
    supabase_admin.table("matches").delete().in_("id", [M_A, M_B, M_T]).execute()
    for uid in ids.values():
        supabase_admin.table("leagues").delete().eq("owner_id", uid).execute()
        supabase_admin.table("league_members").delete().eq("user_id", uid).execute()
        try:
            supabase_admin.auth.admin.delete_user(uid)
        except Exception:
            pass


try:
    seed()
    # lega con owner + member
    league = httpx.post(f"{BASE}/leagues", json={"name": "Lega S7"}, headers=hdr["owner"]).json()
    lid = league["id"]
    httpx.post(f"{BASE}/leagues/join", json={"invite_code": league["invite_code"]}, headers=hdr["member"])

    # --- 1. recap esplicito matchday 99
    r = httpx.get(f"{BASE}/leagues/{lid}/recap?matchday={MD}", headers=hdr["owner"])
    rec = r.json()
    check(
        "recap matchday 99: 2 partite FINISHED (TIMED escluso)",
        r.status_code == 200 and rec["matchday"] == MD and len(rec["matches"]) == 2,
        str([m["id"] for m in rec["matches"]]),
    )

    # --- 2. ranking di giornata: owner 6, member 1, ordinato
    ranking = rec["ranking"]
    by = {row["user_id"]: row["points"] for row in ranking}
    check(
        "ranking giornata: owner=6, member=1, ordinato desc",
        by.get(ids["owner"]) == 6
        and by.get(ids["member"]) == 1
        and [row["points"] for row in ranking] == sorted((row["points"] for row in ranking), reverse=True)
        and ranking[0]["user_id"] == ids["owner"],
        str(ranking),
    )

    # --- 3. partita A: pronostici dei 2 membri, ordinati per punti desc
    ma = next(m for m in rec["matches"] if m["id"] == M_A)
    preds_uids = [p["user_id"] for p in ma["predictions"]]
    check(
        "partita A: 2 pronostici membri, owner (3pt) prima del member (1pt)",
        len(ma["predictions"]) == 2
        and set(preds_uids) == {ids["owner"], ids["member"]}
        and preds_uids[0] == ids["owner"]
        and ma["home_score"] == 2 and ma["away_score"] == 1,
        str(ma["predictions"]),
    )

    # --- 4. il membro vede lo stesso recap
    r = httpx.get(f"{BASE}/leagues/{lid}/recap?matchday={MD}", headers=hdr["member"])
    check("membro vede il recap", r.status_code == 200 and len(r.json()["matches"]) == 2)

    # --- 5. estraneo: 403
    r = httpx.get(f"{BASE}/leagues/{lid}/recap?matchday={MD}", headers=hdr["outsider"])
    check("recap negato a non-membro (403)", r.status_code == 403, str(r.status_code))

    # --- 6. matchday senza partite finite -> matches vuoto, matchday riportato
    r = httpx.get(f"{BASE}/leagues/{lid}/recap?matchday=98", headers=hdr["owner"])
    check(
        "matchday 98 (nessun FINISHED): matches vuoto",
        r.status_code == 200 and r.json()["matchday"] == 98 and r.json()["matches"] == [],
        str(r.json()),
    )

    # --- 7. nessun pronostico futuro esposto (M_T mai presente)
    all_ids = {m["id"] for m in rec["matches"]}
    check("partita TIMED mai esposta", M_T not in all_ids)

finally:
    cleanup()
    print("\ncleanup ok")

print(f"\n{len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
