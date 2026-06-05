from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/bracket", tags=["bracket"])

KNOCKOUT_ORDER = [
    "LAST_32",
    "LAST_16",
    "QUARTER_FINALS",
    "SEMI_FINALS",
    "THIRD_PLACE",
    "FINAL",
]


def _winner(match: dict) -> str | None:
    """'home' | 'away' | None. Knockout: fullTime include i supplementari.

    In caso di pareggio dopo i supplementari (rigori) il vincitore non è
    deducibile dai soli score: None (football-data riporta comunque il
    qualificato nel turno successivo).
    """
    if (
        match["status"] != "FINISHED"
        or match["home_score"] is None
        or match["away_score"] is None
    ):
        return None
    if match["home_score"] > match["away_score"]:
        return "home"
    if match["home_score"] < match["away_score"]:
        return "away"
    return None


@router.get("")
def bracket(_user: dict = Depends(get_current_user)):
    """Tabellone knockout raggruppato per fase, in ordine di torneo."""
    rows = (
        supabase_admin.table("matches")
        .select("*")
        .neq("stage", "GROUP_STAGE")
        .order("utc_date")
        .execute()
        .data
    )

    stages: dict[str, list[dict]] = {s: [] for s in KNOCKOUT_ORDER}
    for m in rows:
        stage = m["stage"]
        if stage not in stages:
            continue
        stages[stage].append(
            {
                "match_id": m["id"],
                "utc_date": m["utc_date"],
                "status": m["status"],
                "home_team_name": m["home_team_name"],
                "home_team_tla": m["home_team_tla"],
                "home_team_crest": m["home_team_crest"],
                "away_team_name": m["away_team_name"],
                "away_team_tla": m["away_team_tla"],
                "away_team_crest": m["away_team_crest"],
                "home_score": m["home_score"],
                "away_score": m["away_score"],
                "winner": _winner(m),
            }
        )

    return {
        "stages": [
            {"stage": s, "matches": stages[s]} for s in KNOCKOUT_ORDER if stages[s]
        ]
    }
