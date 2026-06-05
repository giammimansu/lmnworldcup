"""Sprint 6 — Leghe private.

Pronostici e scoring invariati. Qui si gestiscono solo creazione/join/gestione lega
e la classifica ristretta ai membri (riusa il calcolo globale dello Sprint 4).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.database import supabase_admin
from app.services.invite_code import generate_unique_code
from app.services.leaderboard import compute_leaderboard

router = APIRouter(prefix="/leagues", tags=["leagues"])


class LeagueCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40)


class JoinRequest(BaseModel):
    invite_code: str


class RenameRequest(BaseModel):
    name: str = Field(min_length=2, max_length=40)


@router.post("")
def create_league(body: LeagueCreate, user: dict = Depends(get_current_user)):
    code = generate_unique_code()
    league = (
        supabase_admin.table("leagues")
        .insert(
            {"name": body.name, "owner_id": user["id"], "invite_code": code}
        )
        .execute()
        .data[0]
    )
    # Il proprietario è automaticamente membro.
    supabase_admin.table("league_members").insert(
        {"league_id": league["id"], "user_id": user["id"]}
    ).execute()
    return {**league, "member_count": 1, "is_owner": True}


@router.post("/join")
def join_league(body: JoinRequest, user: dict = Depends(get_current_user)):
    league = (
        supabase_admin.table("leagues")
        .select("*")
        .eq("invite_code", body.invite_code.strip().upper())
        .execute()
        .data
    )
    if not league:
        raise HTTPException(404, "Codice non valido")
    lg = league[0]
    supabase_admin.table("league_members").upsert(
        {"league_id": lg["id"], "user_id": user["id"]},
        on_conflict="league_id,user_id",
    ).execute()
    count = (
        supabase_admin.table("league_members")
        .select("user_id", count="exact")
        .eq("league_id", lg["id"])
        .execute()
    )
    return {**lg, "member_count": count.count, "is_owner": lg["owner_id"] == user["id"]}


@router.get("/me")
def my_leagues(user: dict = Depends(get_current_user)):
    """Le leghe a cui partecipo, con conteggio membri."""
    memberships = (
        supabase_admin.table("league_members")
        .select("league_id, leagues(*)")
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    out = []
    for m in memberships:
        lg = m["leagues"]
        if not lg:
            continue
        count = (
            supabase_admin.table("league_members")
            .select("user_id", count="exact")
            .eq("league_id", lg["id"])
            .execute()
        )
        out.append(
            {
                **lg,
                "member_count": count.count,
                "is_owner": lg["owner_id"] == user["id"],
            }
        )
    out.sort(key=lambda l: l["name"].lower())
    return out


def _assert_owner(league_id: str, user_id: str) -> dict:
    lg = (
        supabase_admin.table("leagues")
        .select("*")
        .eq("id", league_id)
        .execute()
        .data
    )
    if not lg:
        raise HTTPException(404, "Lega non trovata")
    if lg[0]["owner_id"] != user_id:
        raise HTTPException(403, "Solo il proprietario può farlo")
    return lg[0]


@router.get("/{league_id}/members")
def league_members(league_id: str, user: dict = Depends(get_current_user)):
    """Membri della lega (solo se ne sei membro)."""
    member = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", league_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    if not member:
        raise HTTPException(403, "Non sei membro di questa lega")

    lg = _league_or_404(league_id)
    rows = (
        supabase_admin.table("league_members")
        .select("user_id, joined_at, profiles(display_name)")
        .eq("league_id", league_id)
        .execute()
        .data
    )
    return [
        {
            "user_id": r["user_id"],
            "display_name": (r.get("profiles") or {}).get("display_name", "—"),
            "joined_at": r["joined_at"],
            "is_owner": r["user_id"] == lg["owner_id"],
        }
        for r in rows
    ]


def _league_or_404(league_id: str) -> dict:
    lg = (
        supabase_admin.table("leagues")
        .select("*")
        .eq("id", league_id)
        .execute()
        .data
    )
    if not lg:
        raise HTTPException(404, "Lega non trovata")
    return lg[0]


@router.patch("/{league_id}")
def rename_league(
    league_id: str, body: RenameRequest, user: dict = Depends(get_current_user)
):
    _assert_owner(league_id, user["id"])
    supabase_admin.table("leagues").update({"name": body.name}).eq(
        "id", league_id
    ).execute()
    return {"ok": True}


@router.post("/{league_id}/regenerate-code")
def regenerate_code(league_id: str, user: dict = Depends(get_current_user)):
    _assert_owner(league_id, user["id"])
    code = generate_unique_code()
    supabase_admin.table("leagues").update({"invite_code": code}).eq(
        "id", league_id
    ).execute()
    return {"invite_code": code}


@router.delete("/{league_id}/members/{member_id}")
def remove_member(
    league_id: str, member_id: str, user: dict = Depends(get_current_user)
):
    owner = _assert_owner(league_id, user["id"])
    if member_id == owner["owner_id"]:
        raise HTTPException(400, "Il proprietario non può rimuovere se stesso")
    supabase_admin.table("league_members").delete().eq(
        "league_id", league_id
    ).eq("user_id", member_id).execute()
    return {"ok": True}


@router.post("/{league_id}/leave")
def leave_league(league_id: str, user: dict = Depends(get_current_user)):
    lg = _league_or_404(league_id)
    if lg["owner_id"] == user["id"]:
        raise HTTPException(
            400, "Il proprietario non può uscire: elimina la lega o trasferiscila"
        )
    supabase_admin.table("league_members").delete().eq(
        "league_id", league_id
    ).eq("user_id", user["id"]).execute()
    return {"ok": True}


@router.get("/{league_id}/leaderboard")
def league_leaderboard(league_id: str, user: dict = Depends(get_current_user)):
    """Classifica ristretta ai membri della lega. Solo i membri possono vederla.

    Riusa il calcolo globale (compute_leaderboard) e lo filtra sui membri, poi
    ricalcola posizioni e trend interni alla lega.
    """
    member = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", league_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    if not member:
        raise HTTPException(403, "Non sei membro di questa lega")

    member_ids = {
        m["user_id"]
        for m in supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", league_id)
        .execute()
        .data
    }

    # Punti globali, filtrati ai membri e riordinati (già ordinati per punti desc).
    board = [r for r in compute_leaderboard() if r["user_id"] in member_ids]

    # Trend interno alla lega: posizione di ieri tra i soli membri, dallo snapshot
    # globale dello Sprint 4 (nessuna tabella nuova).
    snaps = (
        supabase_admin.table("leaderboard_snapshots")
        .select("user_id, date, points")
        .in_("user_id", list(member_ids))
        .order("date", desc=True)
        .execute()
        .data
    )
    prev_pos: dict[str, int] = {}
    if snaps:
        last_date = snaps[0]["date"]
        members_yday = [s for s in snaps if s["date"] == last_date]
        members_yday.sort(key=lambda s: -s["points"])
        prev_pos = {s["user_id"]: i + 1 for i, s in enumerate(members_yday)}

    out = []
    for i, r in enumerate(board):
        pos = i + 1
        prev = prev_pos.get(r["user_id"])
        out.append(
            {
                "position": pos,
                "user_id": r["user_id"],
                "display_name": r["display_name"],
                "points": r["points"],
                "exact_count": r["exact_count"],
                "accuracy": r["accuracy"],
                "trend": (prev - pos) if prev is not None else 0,
            }
        )
    return out
