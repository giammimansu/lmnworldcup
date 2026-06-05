from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import supabase_admin
from app.models.prediction import (
    MatchPredictionsSummary,
    PopularScore,
    PredictionCreate,
    PredictionOut,
    ScorerPlayer,
    ScorerPredictionCreate,
    ScorerPredictionOut,
    SignDistribution,
)
from app.services.scoring import _sign

router = APIRouter(prefix="/predictions", tags=["predictions"])


def _get_match_or_404(match_id: int) -> dict:
    result = (
        supabase_admin.table("matches").select("*").eq("id", match_id).limit(1).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    return result.data[0]


def _kickoff_passed(match: dict) -> bool:
    utc_date = datetime.fromisoformat(match["utc_date"].replace("Z", "+00:00"))
    return utc_date <= datetime.now(timezone.utc)


def _outcome(pred: dict, match: dict) -> str:
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


@router.post("", response_model=PredictionOut)
def upsert_prediction(body: PredictionCreate, user: dict = Depends(get_current_user)):
    """Crea o aggiorna il pronostico dell'utente sulla partita.

    VALIDAZIONE SERVER-SIDE: rifiuta con 403 se la partita è già iniziata.
    Mai fidarsi del client per la deadline.
    """
    match = _get_match_or_404(body.match_id)

    if _kickoff_passed(match):
        raise HTTPException(
            status_code=403, detail="Pronostici chiusi per questa partita"
        )

    now = datetime.now(timezone.utc).isoformat()
    result = (
        supabase_admin.table("predictions")
        .upsert(
            {
                "user_id": user["id"],
                "match_id": body.match_id,
                "home_score": body.home_score,
                "away_score": body.away_score,
                "updated_at": now,
            },
            on_conflict="user_id,match_id",
        )
        .execute()
    )
    pred = result.data[0]

    # Achievement "primo sangue": primo pronostico del torneo
    try:
        from app.services.achievements import check_primo_sangue

        check_primo_sangue(user["id"])
    except Exception:
        pass  # mai bloccare il pronostico per un achievement

    return PredictionOut(**{**pred, "outcome": _outcome(pred, match)})


@router.get("/me", response_model=list[PredictionOut])
def my_predictions(user: dict = Depends(get_current_user)):
    """Tutti i pronostici dell'utente con outcome calcolato."""
    preds = (
        supabase_admin.table("predictions")
        .select("*")
        .eq("user_id", user["id"])
        .execute()
    )
    if not preds.data:
        return []

    match_ids = [p["match_id"] for p in preds.data]
    matches = (
        supabase_admin.table("matches").select("*").in_("id", match_ids).execute()
    )
    matches_by_id = {m["id"]: m for m in matches.data}

    out = []
    for pred in preds.data:
        match = matches_by_id.get(pred["match_id"])
        outcome = _outcome(pred, match) if match else "pending"
        out.append(PredictionOut(**{**pred, "outcome": outcome}))
    return out


@router.get("/match/{match_id}/summary", response_model=MatchPredictionsSummary)
def match_summary(match_id: int, _user: dict = Depends(get_current_user)):
    """Statistiche aggregate dei pronostici sulla partita.

    SOLO dopo il kickoff (403 altrimenti): mai rivelare i pronostici altrui
    prima dell'inizio.
    """
    match = _get_match_or_404(match_id)

    if not _kickoff_passed(match):
        raise HTTPException(
            status_code=403,
            detail="Il summary è disponibile solo dopo l'inizio della partita",
        )

    preds = (
        supabase_admin.table("predictions")
        .select("home_score, away_score")
        .eq("match_id", match_id)
        .execute()
    )
    total = len(preds.data)

    if total == 0:
        return MatchPredictionsSummary(
            match_id=match_id,
            total=0,
            signs=SignDistribution(home=0, draw=0, away=0),
            top_scores=[],
        )

    sign_counts = Counter(_sign(p["home_score"], p["away_score"]) for p in preds.data)
    score_counts = Counter((p["home_score"], p["away_score"]) for p in preds.data)

    return MatchPredictionsSummary(
        match_id=match_id,
        total=total,
        signs=SignDistribution(
            home=round(sign_counts.get("1", 0) / total * 100, 1),
            draw=round(sign_counts.get("X", 0) / total * 100, 1),
            away=round(sign_counts.get("2", 0) / total * 100, 1),
        ),
        top_scores=[
            PopularScore(home_score=h, away_score=a, count=c)
            for (h, a), c in score_counts.most_common(3)
        ],
    )


def _scorer_outcome(points: int | None, match: dict) -> str:
    """hit | miss | pending. pending finché la partita non è FINISHED."""
    if match["status"] != "FINISHED":
        return "pending"
    return "hit" if (points or 0) > 0 else "miss"


def _players_by_id(player_ids: list[int]) -> dict:
    if not player_ids:
        return {}
    rows = (
        supabase_admin.table("players")
        .select("id, name, team_tla")
        .in_("id", list(set(player_ids)))
        .execute()
        .data
    )
    return {p["id"]: p for p in rows}


def _scorer_players(player_ids: list[int], by_id: dict) -> list[ScorerPlayer]:
    """Conserva l'ordine e i duplicati di player_ids."""
    return [
        ScorerPlayer(
            player_id=pid,
            player_name=by_id.get(pid, {}).get("name", "?"),
            team_tla=by_id.get(pid, {}).get("team_tla"),
        )
        for pid in player_ids
    ]


@router.post("/scorer", response_model=ScorerPredictionOut)
def upsert_scorer(
    body: ScorerPredictionCreate, user: dict = Depends(get_current_user)
):
    """Crea o aggiorna il pronostico marcatore (lista legata al risultato previsto).

    Regole:
    - 403 se la partita è già iniziata.
    - serve il pronostico risultato (per sapere quanti marcatori per squadra).
    - i marcatori devono essere giocatori delle due squadre, con conteggi pari ai
      gol previsti: #(casa) == gol_casa previsti, #(trasferta) == gol_trasferta.
      Duplicati ammessi (doppiette/triplette).
    """
    match = _get_match_or_404(body.match_id)

    if _kickoff_passed(match):
        raise HTTPException(
            status_code=403, detail="Pronostici chiusi per questa partita"
        )

    pred = (
        supabase_admin.table("predictions")
        .select("home_score, away_score")
        .eq("user_id", user["id"])
        .eq("match_id", body.match_id)
        .limit(1)
        .execute()
        .data
    )
    if not pred:
        raise HTTPException(
            status_code=400, detail="Inserisci prima il pronostico del risultato"
        )
    ph, pa = pred[0]["home_score"], pred[0]["away_score"]

    home_tla, away_tla = match["home_team_tla"], match["away_team_tla"]
    by_id = _players_by_id(body.player_ids)

    home_n = away_n = 0
    for pid in body.player_ids:
        p = by_id.get(pid)
        if not p:
            raise HTTPException(status_code=400, detail=f"Giocatore {pid} non trovato")
        if p["team_tla"] == home_tla:
            home_n += 1
        elif p["team_tla"] == away_tla:
            away_n += 1
        else:
            raise HTTPException(
                status_code=400,
                detail="Un marcatore non appartiene a questa partita",
            )

    if home_n != ph or away_n != pa:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Servono {ph} marcatori per {home_tla} e {pa} per {away_tla} "
                f"(ricevuti {home_n}/{away_n})"
            ),
        )

    now = datetime.now(timezone.utc).isoformat()
    result = (
        supabase_admin.table("scorer_predictions")
        .upsert(
            {
                "user_id": user["id"],
                "match_id": body.match_id,
                "player_ids": body.player_ids,
                "updated_at": now,
            },
            on_conflict="user_id,match_id",
        )
        .execute()
    )
    sp = result.data[0]
    return ScorerPredictionOut(
        id=sp["id"],
        match_id=sp["match_id"],
        players=_scorer_players(body.player_ids, by_id),
        points=sp.get("points"),
        outcome=_scorer_outcome(sp.get("points"), match),
    )


@router.get("/scorer/me", response_model=list[ScorerPredictionOut])
def my_scorer_predictions(user: dict = Depends(get_current_user)):
    """Tutti i pronostici marcatore dell'utente con esito calcolato."""
    sps = (
        supabase_admin.table("scorer_predictions")
        .select("*")
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    if not sps:
        return []

    match_ids = [s["match_id"] for s in sps]
    all_pids = [pid for s in sps for pid in (s.get("player_ids") or [])]
    matches = (
        supabase_admin.table("matches").select("*").in_("id", match_ids).execute().data
    )
    matches_by_id = {m["id"]: m for m in matches}
    by_id = _players_by_id(all_pids)

    out = []
    for s in sps:
        match = matches_by_id.get(s["match_id"])
        pids = s.get("player_ids") or []
        out.append(
            ScorerPredictionOut(
                id=s["id"],
                match_id=s["match_id"],
                players=_scorer_players(pids, by_id),
                points=s.get("points"),
                outcome=_scorer_outcome(s.get("points"), match)
                if match
                else "pending",
            )
        )
    return out
