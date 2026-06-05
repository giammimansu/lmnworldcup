"""Verifica E2E Sprint 6: leghe private.

Tre utenti usa-e-getta (owner, membro, estraneo). Cleanup completo.
Richiede il backend in esecuzione su localhost:8000 e la migration 005 applicata.
"""
import sys

import httpx

sys.path.insert(0, ".")

from app.config import settings  # noqa: E402
from app.database import supabase_admin  # noqa: E402

BASE = "http://localhost:8000"
USERS = {
    "owner": ("test-e2e-s6-owner@lmn.local", "test-e2e-S6-owner!pass", "Test S6 Owner"),
    "member": ("test-e2e-s6-member@lmn.local", "test-e2e-S6-member!pass", "Test S6 Member"),
    "outsider": ("test-e2e-s6-out@lmn.local", "test-e2e-S6-out!pass", "Test S6 Outsider"),
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


def cleanup():
    for uid in ids.values():
        # le leghe di proprietà spariscono in cascata (on delete cascade)
        supabase_admin.table("leagues").delete().eq("owner_id", uid).execute()
        supabase_admin.table("league_members").delete().eq("user_id", uid).execute()
        try:
            supabase_admin.auth.admin.delete_user(uid)
        except Exception:
            pass


try:
    # --- 1. owner crea lega
    r = httpx.post(f"{BASE}/leagues", json={"name": "Lega Test S6"}, headers=hdr["owner"])
    league = r.json()
    lid = league.get("id")
    code = league.get("invite_code")
    check(
        "POST /leagues crea lega con codice + owner membro",
        r.status_code == 200
        and code
        and league["member_count"] == 1
        and league["is_owner"] is True,
        str(league),
    )

    # --- 2. owner /leagues/me
    r = httpx.get(f"{BASE}/leagues/me", headers=hdr["owner"])
    mine = r.json()
    check(
        "GET /leagues/me elenca la lega (is_owner=true)",
        r.status_code == 200 and any(l["id"] == lid and l["is_owner"] for l in mine),
        str(mine),
    )

    # --- 3. member join con codice
    r = httpx.post(f"{BASE}/leagues/join", json={"invite_code": code}, headers=hdr["member"])
    check(
        "POST /leagues/join membro entra col codice",
        r.status_code == 200 and r.json()["id"] == lid and r.json()["is_owner"] is False,
        str(r.json()),
    )
    r = httpx.get(f"{BASE}/leagues/me", headers=hdr["member"])
    check(
        "membro vede la lega in /leagues/me",
        any(l["id"] == lid for l in r.json()),
    )

    # --- 4. leaderboard ristretta ai 2 membri
    r = httpx.get(f"{BASE}/leagues/{lid}/leaderboard", headers=hdr["owner"])
    board = r.json()
    member_ids = {row["user_id"] for row in board}
    check(
        "GET leaderboard ristretta ai membri (2 righe, posizioni 1..2)",
        r.status_code == 200
        and len(board) == 2
        and member_ids == {ids["owner"], ids["member"]}
        and [row["position"] for row in board] == [1, 2],
        str(board),
    )

    # --- 5. estraneo NON vede la leaderboard
    r = httpx.get(f"{BASE}/leagues/{lid}/leaderboard", headers=hdr["outsider"])
    check("leaderboard negata a non-membro (403)", r.status_code == 403, str(r.status_code))

    # --- 6. join codice errato
    r = httpx.post(f"{BASE}/leagues/join", json={"invite_code": "WC26-XXXXX"}, headers=hdr["outsider"])
    check("join codice non valido (404)", r.status_code == 404, str(r.status_code))

    # --- 7. owner rinomina
    r = httpx.patch(f"{BASE}/leagues/{lid}", json={"name": "Lega Rinominata"}, headers=hdr["owner"])
    name_now = (
        supabase_admin.table("leagues").select("name").eq("id", lid).execute().data[0]["name"]
    )
    check("PATCH rinomina lega", r.status_code == 200 and name_now == "Lega Rinominata")

    # --- 8. non-owner non può rinominare
    r = httpx.patch(f"{BASE}/leagues/{lid}", json={"name": "Hack"}, headers=hdr["member"])
    check("rinomina negata a non-owner (403)", r.status_code == 403, str(r.status_code))

    # --- 9. rigenera codice: il vecchio non funziona più
    r = httpx.post(f"{BASE}/leagues/{lid}/regenerate-code", headers=hdr["owner"])
    new_code = r.json().get("invite_code")
    check("regenerate-code restituisce nuovo codice", r.status_code == 200 and new_code and new_code != code)
    r = httpx.post(f"{BASE}/leagues/join", json={"invite_code": code}, headers=hdr["outsider"])
    check("vecchio codice invalidato (404)", r.status_code == 404, str(r.status_code))

    # --- 10. owner rimuove il membro
    r = httpx.delete(f"{BASE}/leagues/{lid}/members/{ids['member']}", headers=hdr["owner"])
    still = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", lid)
        .eq("user_id", ids["member"])
        .execute()
        .data
    )
    check("owner rimuove membro", r.status_code == 200 and not still)

    # --- 11. owner non può uscire dalla propria lega
    r = httpx.post(f"{BASE}/leagues/{lid}/leave", headers=hdr["owner"])
    check("owner non può uscire (400)", r.status_code == 400, str(r.status_code))

    # --- 12. membro rientra e poi esce da solo
    httpx.post(f"{BASE}/leagues/join", json={"invite_code": new_code}, headers=hdr["member"])
    r = httpx.post(f"{BASE}/leagues/{lid}/leave", headers=hdr["member"])
    gone = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", lid)
        .eq("user_id", ids["member"])
        .execute()
        .data
    )
    check("membro esce dalla lega", r.status_code == 200 and not gone)

finally:
    cleanup()
    print("\ncleanup ok")

print(f"\n{len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
