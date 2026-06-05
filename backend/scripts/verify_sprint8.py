"""Verifica E2E Sprint 8: marcatori end-to-end.

Usa-e-getta: un utente normale + un utente admin (is_admin impostato via DB,
MAI toccando l'admin reale). Partite fittizie + giocatori reali (rose FIFA).
Cleanup completo. Richiede backend su localhost:8000 e tabella players popolata.
"""
import sys

import httpx

sys.path.insert(0, ".")

from app.config import settings  # noqa: E402
from app.database import supabase_admin  # noqa: E402

BASE = "http://localhost:8000"
M_OPEN = 999_801  # TIMED futuro: pronostico marcatore aperto
M_DONE = 999_802  # diventerà FINISHED per lo scoring
HOME_TLA = "BRA"
AWAY_TLA = "ARG"
WRONG_TLA = "FRA"  # squadra non in partita -> 400

USERS = {
    "player": ("test-e2e-s8-player@lmn.local", "test-e2e-S8-player!pass", "Test S8 Player"),
    "admin": ("test-e2e-s8-admin@lmn.local", "test-e2e-S8-admin!pass", "Test S8 Admin"),
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
# Promuovi SOLO l'utente di test ad admin (non l'admin reale)
supabase_admin.table("profiles").update({"is_admin": True}).eq("id", ids["admin"]).execute()
hdr = {role: token(USERS[role][0], USERS[role][1]) for role in USERS}


def first_player(tla):
    rows = (
        supabase_admin.table("players")
        .select("id, name, team_tla")
        .eq("team_tla", tla)
        .order("shirt_number")
        .limit(2)
        .execute()
        .data
    )
    return rows


def seed():
    supabase_admin.table("matches").upsert(
        [
            {"id": M_OPEN, "utc_date": "2030-01-10T18:00:00+00:00", "status": "TIMED",
             "stage": "GROUP_STAGE", "matchday": 97,
             "home_team_name": "Brasile", "home_team_tla": HOME_TLA,
             "away_team_name": "Argentina", "away_team_tla": AWAY_TLA},
            {"id": M_DONE, "utc_date": "2030-01-10T18:00:00+00:00", "status": "TIMED",
             "stage": "GROUP_STAGE", "matchday": 97,
             "home_team_name": "Brasile", "home_team_tla": HOME_TLA,
             "away_team_name": "Argentina", "away_team_tla": AWAY_TLA},
        ],
        on_conflict="id",
    ).execute()


def cleanup():
    supabase_admin.table("scorer_predictions").delete().in_("match_id", [M_OPEN, M_DONE]).execute()
    supabase_admin.table("match_goals").delete().in_("match_id", [M_OPEN, M_DONE]).execute()
    supabase_admin.table("predictions").delete().in_("match_id", [M_OPEN, M_DONE]).execute()
    supabase_admin.table("matches").delete().in_("id", [M_OPEN, M_DONE]).execute()
    for uid in ids.values():
        try:
            supabase_admin.auth.admin.delete_user(uid)
        except Exception:
            pass


try:
    seed()
    bra = first_player(HOME_TLA)
    fra = first_player(WRONG_TLA)
    check("rose disponibili (BRA + FRA popolate)", len(bra) >= 2 and len(fra) >= 1,
          f"BRA={len(bra)} FRA={len(fra)}")
    X = bra[0]            # bomber previsto (faremo doppietta)
    other = bra[1]        # segnerà al posto suo nel test "miss"

    # --- 1. GET /players?team_tla=BRA ordinato per numero di maglia
    r = httpx.get(f"{BASE}/players?team_tla={HOME_TLA}", headers=hdr["player"])
    pl = r.json()
    shirts = [p["shirt_number"] for p in pl if p["shirt_number"] is not None]
    check("GET /players?team_tla=BRA: 26 giocatori ordinati per maglia",
          r.status_code == 200 and len(pl) == 26 and shirts == sorted(shirts),
          f"n={len(pl)}")

    # M_OPEN: serve prima il pronostico risultato (1-0)
    httpx.post(f"{BASE}/predictions",
               json={"match_id": M_OPEN, "home_score": 1, "away_score": 0},
               headers=hdr["player"])

    # --- 2. scorer senza pronostico risultato -> 400 (M_DONE non ha prediction)
    r = httpx.post(f"{BASE}/predictions/scorer",
                   json={"match_id": M_DONE, "player_ids": [X["id"]]},
                   headers=hdr["player"])
    check("POST scorer: 400 senza pronostico risultato", r.status_code == 400, str(r.status_code))

    # --- 3. conteggio sbagliato (2 marcatori per un 1-0) -> 400
    r = httpx.post(f"{BASE}/predictions/scorer",
                   json={"match_id": M_OPEN, "player_ids": [X["id"], other["id"]]},
                   headers=hdr["player"])
    check("POST scorer: 400 se #marcatori != gol previsti", r.status_code == 400, str(r.status_code))

    # --- 4. giocatore non della partita -> 400
    r = httpx.post(f"{BASE}/predictions/scorer",
                   json={"match_id": M_OPEN, "player_ids": [fra[0]["id"]]},
                   headers=hdr["player"])
    check("POST scorer: 400 se giocatore non gioca la partita", r.status_code == 400, str(r.status_code))

    # --- 5. conteggio giusto (1 marcatore casa per un 1-0) -> 200
    r = httpx.post(f"{BASE}/predictions/scorer",
                   json={"match_id": M_OPEN, "player_ids": [X["id"]]},
                   headers=hdr["player"])
    check("POST scorer: salva con conteggio corretto", r.status_code == 200, str(r.status_code))

    # --- 6. partita iniziata -> 403
    supabase_admin.table("matches").update(
        {"utc_date": "2020-01-10T18:00:00+00:00"}
    ).eq("id", M_DONE).execute()
    r = httpx.post(f"{BASE}/predictions/scorer",
                   json={"match_id": M_DONE, "player_ids": [X["id"], X["id"]]},
                   headers=hdr["player"])
    check("POST scorer: 403 se partita iniziata", r.status_code == 403, str(r.status_code))

    # Scoring su M_DONE: pronostico 2-0 con doppietta di X (deadline già passata -> via DB)
    supabase_admin.table("predictions").upsert(
        {"user_id": ids["player"], "match_id": M_DONE, "home_score": 2, "away_score": 0},
        on_conflict="user_id,match_id",
    ).execute()
    supabase_admin.table("scorer_predictions").upsert(
        {"user_id": ids["player"], "match_id": M_DONE, "player_ids": [X["id"], X["id"]]},
        on_conflict="user_id,match_id",
    ).execute()
    supabase_admin.table("matches").update(
        {"status": "FINISHED", "home_score": 2, "away_score": 0}
    ).eq("id", M_DONE).execute()

    def scorer_points():
        rows = (
            supabase_admin.table("scorer_predictions")
            .select("points")
            .eq("user_id", ids["player"]).eq("match_id", M_DONE)
            .execute().data
        )
        return rows[0]["points"] if rows else None

    def add_goal(p, minute=None):
        return httpx.post(f"{BASE}/admin/goals",
                          json={"match_id": M_DONE, "player_id": p["id"],
                                "player_name": p["name"], "team_tla": HOME_TLA, "minute": minute},
                          headers=hdr["admin"])

    # --- 7. una rete di X (doppietta prevista, 1 gol) -> +2
    add_goal(X, 23)
    check("doppietta prevista, 1 gol di X -> +2", scorer_points() == 2, f"pts={scorer_points()}")

    # --- 8. seconda rete di X -> +4 (multiset completo)
    add_goal(X, 67)
    check("doppietta prevista, 2 gol di X -> +4", scorer_points() == 4, f"pts={scorer_points()}")

    # --- 9. rimuovo i gol -> torna a 0 (idempotenza)
    goals = httpx.get(f"{BASE}/admin/goals/{M_DONE}", headers=hdr["admin"]).json()
    for g in goals:
        httpx.request("DELETE", f"{BASE}/admin/goals/{g['id']}?match_id={M_DONE}", headers=hdr["admin"])
    check("rimuovo i gol -> marcatori a 0", scorer_points() == 0, f"pts={scorer_points()}")

    # --- 10. gol di un altro giocatore -> resta 0
    add_goal(other)
    check("gol di altro giocatore -> previsto resta 0", scorer_points() == 0, f"pts={scorer_points()}")

    # --- 11. /predictions/scorer/me riporta l'esito (lista players)
    r = httpx.get(f"{BASE}/predictions/scorer/me", headers=hdr["player"])
    mine = next((s for s in r.json() if s["match_id"] == M_DONE), None)
    check("GET scorer/me: outcome=miss, 2 players in lista",
          mine is not None and mine["outcome"] == "miss" and len(mine["players"]) == 2,
          str(mine))

    # --- 12. admin endpoint vietato al player normale (403)
    r = httpx.post(f"{BASE}/admin/goals",
                   json={"match_id": M_DONE, "player_id": X["id"], "player_name": X["name"]},
                   headers=hdr["player"])
    check("POST /admin/goals negato al non-admin (403)", r.status_code == 403, str(r.status_code))

finally:
    cleanup()
    print("\ncleanup ok")

print(f"\n{len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
