"""Sprint 7 — Recap giornata (sola lettura).

Aggrega dati esistenti: per la lega, mostra le partite FINISHED dell'ultima giornata
con i pronostici di tutti i membri, i punti, e la classifica di giornata.
Nessuna migration. Privacy: solo partite FINISHED (già iniziate) vengono esposte.

Sprint 8: include anche il pronostico marcatore (scorer_name + scorer_points)
accanto a ogni pronostico risultato, e ne somma i punti nella classifica di giornata.
"""
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import supabase_admin
from app.services.scoring import _sign

router = APIRouter(prefix="/leagues", tags=["recap"])


def _kickoff_passed(match: dict) -> bool:
    utc = datetime.fromisoformat(match["utc_date"].replace("Z", "+00:00"))
    return utc <= datetime.now(timezone.utc)


def _result_outcome(pred: dict, match: dict) -> str:
    """exact | sign | wrong | pending in base allo stato della partita."""
    if (
        match["status"] != "FINISHED"
        or match["home_score"] is None
        or match["away_score"] is None
    ):
        return "pending"
    if (
        pred["home_score"] == match["home_score"]
        and pred["away_score"] == match["away_score"]
    ):
        return "exact"
    if _sign(pred["home_score"], pred["away_score"]) == _sign(
        match["home_score"], match["away_score"]
    ):
        return "sign"
    return "wrong"


def _latest_finished_matchday() -> int | None:
    """Matchday più recente con almeno una partita FINISHED (esclude i null)."""
    finished = (
        supabase_admin.table("matches")
        .select("matchday")
        .eq("status", "FINISHED")
        .not_.is_("matchday", "null")
        .order("matchday", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return finished[0]["matchday"] if finished else None


@router.get("/{league_id}/recap")
def league_recap(
    league_id: str,
    matchday: int | None = None,
    user: dict = Depends(get_current_user),
):
    # 1) Appartenenza alla lega
    is_member = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", league_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    if not is_member:
        raise HTTPException(403, "Non sei membro di questa lega")

    # 2) Giornata target
    md = matchday if matchday is not None else _latest_finished_matchday()
    if md is None:
        return {"matchday": None, "matches": [], "ranking": []}

    # 3) Membri (id -> nome)
    members = (
        supabase_admin.table("league_members")
        .select("user_id, profiles(display_name)")
        .eq("league_id", league_id)
        .execute()
        .data
    )
    member_ids = [m["user_id"] for m in members]
    names = {
        m["user_id"]: (m.get("profiles") or {}).get("display_name", "?")
        for m in members
    }

    # 4) Partite FINISHED della giornata (finite => già iniziate => privacy ok)
    matches = (
        supabase_admin.table("matches")
        .select("*")
        .eq("matchday", md)
        .eq("status", "FINISHED")
        .order("utc_date")
        .execute()
        .data
    )
    match_ids = [mt["id"] for mt in matches]
    if not match_ids:
        return {"matchday": md, "matches": [], "ranking": []}

    # 5) Pronostici risultato dei membri
    preds = (
        supabase_admin.table("predictions")
        .select("user_id, match_id, home_score, away_score, points")
        .in_("match_id", match_ids)
        .in_("user_id", member_ids)
        .execute()
        .data
    )

    # 5b) Pronostici marcatore dei membri (lista nomi giocatori)
    scorer_preds = (
        supabase_admin.table("scorer_predictions")
        .select("user_id, match_id, player_ids, points")
        .in_("match_id", match_ids)
        .in_("user_id", member_ids)
        .execute()
        .data
    )
    all_pids = [pid for s in scorer_preds for pid in (s.get("player_ids") or [])]
    player_names: dict[int, str] = {}
    if all_pids:
        players = (
            supabase_admin.table("players")
            .select("id, name")
            .in_("id", list(set(all_pids)))
            .execute()
            .data
        )
        player_names = {p["id"]: p["name"] for p in players}
    # (match_id, user_id) -> {names[], points}
    scorer_by_key = {
        (s["match_id"], s["user_id"]): {
            "scorer_names": [player_names.get(pid, "?") for pid in (s.get("player_ids") or [])],
            "scorer_points": s["points"] or 0,
        }
        for s in scorer_preds
    }

    preds_by_match: dict[int, list] = {mid: [] for mid in match_ids}
    points_per_member: dict[str, int] = {uid: 0 for uid in member_ids}

    for p in preds:
        pts = p["points"] or 0
        points_per_member[p["user_id"]] = points_per_member.get(p["user_id"], 0) + pts
        scorer = scorer_by_key.get((p["match_id"], p["user_id"]))
        preds_by_match[p["match_id"]].append(
            {
                "user_id": p["user_id"],
                "display_name": names.get(p["user_id"], "?"),
                "home_score": p["home_score"],
                "away_score": p["away_score"],
                "points": pts,
                "scorer_names": scorer["scorer_names"] if scorer else None,
                "scorer_points": scorer["scorer_points"] if scorer else None,
            }
        )

    # I punti marcatore confluiscono nella classifica di giornata
    for s in scorer_preds:
        points_per_member[s["user_id"]] = (
            points_per_member.get(s["user_id"], 0) + (s["points"] or 0)
        )

    # 6) Output partite (pronostici ordinati per punti decrescenti)
    out_matches = []
    for mt in matches:
        rows = sorted(
            preds_by_match.get(mt["id"], []),
            key=lambda r: (-r["points"], r["display_name"].lower()),
        )
        out_matches.append(
            {
                "id": mt["id"],
                "home_team_name": mt["home_team_name"],
                "home_team_tla": mt["home_team_tla"],
                "home_team_crest": mt["home_team_crest"],
                "away_team_name": mt["away_team_name"],
                "away_team_tla": mt["away_team_tla"],
                "away_team_crest": mt["away_team_crest"],
                "home_score": mt["home_score"],
                "away_score": mt["away_score"],
                "stage": mt["stage"],
                "predictions": rows,
            }
        )

    # 7) Classifica di giornata (solo punti di questa matchday)
    ranking = sorted(
        (
            {"user_id": uid, "display_name": names.get(uid, "?"), "points": pts}
            for uid, pts in points_per_member.items()
        ),
        key=lambda r: (-r["points"], r["display_name"].lower()),
    )

    return {"matchday": md, "matches": out_matches, "ranking": ranking}


@router.get("/{league_id}/match/{match_id}/predictions")
def league_match_predictions(
    league_id: str,
    match_id: int,
    user: dict = Depends(get_current_user),
):
    """Pronostici di TUTTI i membri della lega su una singola partita.

    Privacy: 403 prima del calcio d'inizio (mai rivelare i pronostici altrui).
    Include la distribuzione segni e i risultati più giocati, ristretti alla lega.
    """
    # 1) Appartenenza alla lega
    is_member = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", league_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    if not is_member:
        raise HTTPException(403, "Non sei membro di questa lega")

    # 2) Partita + deadline
    mt = (
        supabase_admin.table("matches")
        .select("*")
        .eq("id", match_id)
        .limit(1)
        .execute()
        .data
    )
    if not mt:
        raise HTTPException(404, "Partita non trovata")
    match = mt[0]
    if not _kickoff_passed(match):
        raise HTTPException(
            403, "I pronostici sono visibili solo dopo l'inizio della partita"
        )

    # 3) Membri (id -> nome)
    members = (
        supabase_admin.table("league_members")
        .select("user_id, profiles(display_name)")
        .eq("league_id", league_id)
        .execute()
        .data
    )
    member_ids = [m["user_id"] for m in members]
    names = {
        m["user_id"]: (m.get("profiles") or {}).get("display_name", "?")
        for m in members
    }

    # 4) Pronostici risultato dei membri
    preds = (
        supabase_admin.table("predictions")
        .select("user_id, home_score, away_score, points")
        .eq("match_id", match_id)
        .in_("user_id", member_ids)
        .execute()
        .data
    )

    # 4b) Pronostici marcatore dei membri (nomi giocatori)
    scorer_preds = (
        supabase_admin.table("scorer_predictions")
        .select("user_id, player_ids, points")
        .eq("match_id", match_id)
        .in_("user_id", member_ids)
        .execute()
        .data
    )
    all_pids = [pid for s in scorer_preds for pid in (s.get("player_ids") or [])]
    player_names: dict[int, str] = {}
    if all_pids:
        rows = (
            supabase_admin.table("players")
            .select("id, name")
            .in_("id", list(set(all_pids)))
            .execute()
            .data
        )
        player_names = {p["id"]: p["name"] for p in rows}
    scorer_by_user = {
        s["user_id"]: {
            "scorer_names": [
                player_names.get(pid, "?") for pid in (s.get("player_ids") or [])
            ],
            "scorer_points": s["points"] or 0,
        }
        for s in scorer_preds
    }

    # 5) Righe pronostico + aggregati (solo sui membri)
    out_preds = []
    for p in preds:
        sc = scorer_by_user.get(p["user_id"])
        out_preds.append(
            {
                "user_id": p["user_id"],
                "display_name": names.get(p["user_id"], "?"),
                "home_score": p["home_score"],
                "away_score": p["away_score"],
                "points": p["points"] or 0,
                "outcome": _result_outcome(p, match),
                "scorer_names": sc["scorer_names"] if sc else None,
                "scorer_points": sc["scorer_points"] if sc else None,
            }
        )
    out_preds.sort(key=lambda r: (-r["points"], r["display_name"].lower()))

    total = len(preds)
    signs = {"home": 0.0, "draw": 0.0, "away": 0.0}
    top_scores: list[dict] = []
    if total:
        sign_counts = Counter(_sign(p["home_score"], p["away_score"]) for p in preds)
        signs = {
            "home": round(sign_counts.get("1", 0) / total * 100, 1),
            "draw": round(sign_counts.get("X", 0) / total * 100, 1),
            "away": round(sign_counts.get("2", 0) / total * 100, 1),
        }
        score_counts = Counter((p["home_score"], p["away_score"]) for p in preds)
        top_scores = [
            {"home_score": h, "away_score": a, "count": c}
            for (h, a), c in score_counts.most_common(3)
        ]

    return {
        "match_id": match_id,
        "status": match["status"],
        "home_score": match["home_score"],
        "away_score": match["away_score"],
        "total": total,
        "signs": signs,
        "top_scores": top_scores,
        "predictions": out_preds,
    }


@router.get("/{league_id}/special")
def league_special(league_id: str, user: dict = Depends(get_current_user)):
    """Pronostici di torneo (special) di TUTTI i membri della lega.

    Privacy: le risposte dei membri sono rivelate solo dopo la scadenza della
    domanda (deadline passata). Per le domande ancora aperte si espone solo il
    conteggio di chi ha già risposto, non le risposte.
    """
    # 1) Appartenenza alla lega
    is_member = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", league_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    if not is_member:
        raise HTTPException(403, "Non sei membro di questa lega")

    # 2) Membri (id -> nome)
    members = (
        supabase_admin.table("league_members")
        .select("user_id, profiles(display_name)")
        .eq("league_id", league_id)
        .execute()
        .data
    )
    member_ids = [m["user_id"] for m in members]
    names = {
        m["user_id"]: (m.get("profiles") or {}).get("display_name", "?")
        for m in members
    }

    # 3) Domande + risposte dei membri
    questions = (
        supabase_admin.table("special_questions")
        .select("*")
        .order("sort_order")
        .execute()
        .data
    )
    preds = (
        supabase_admin.table("special_predictions")
        .select("user_id, question_code, answer, points")
        .in_("user_id", member_ids)
        .execute()
        .data
    )
    by_question: dict[str, list] = {}
    for p in preds:
        by_question.setdefault(p["question_code"], []).append(p)

    now = datetime.now(timezone.utc)
    out_questions = []
    for q in questions:
        deadline = datetime.fromisoformat(q["deadline"].replace("Z", "+00:00"))
        is_open = now < deadline
        rows = by_question.get(q["code"], [])
        if is_open:
            # Domanda aperta: niente risposte, solo quanti hanno già risposto.
            answers = []
        else:
            answers = sorted(
                (
                    {
                        "user_id": r["user_id"],
                        "display_name": names.get(r["user_id"], "?"),
                        "answer": r["answer"],
                        "points": r["points"],
                    }
                    for r in rows
                ),
                key=lambda a: (-(a["points"] or 0), a["display_name"].lower()),
            )
        out_questions.append(
            {
                "code": q["code"],
                "title": q["title"],
                "qtype": q["qtype"],
                "points": q["points"],
                "deadline": q["deadline"],
                "resolved": q["resolved"],
                "correct_answer": q["correct_answer"] if q["resolved"] else None,
                "sort_order": q["sort_order"],
                "open": is_open,
                "answered_count": len(rows),
                "member_count": len(member_ids),
                "answers": answers,
            }
        )
    return {"questions": out_questions}
