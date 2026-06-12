"""One-off: forza i pronostici di torneo (special) per un utente.

Bypassa RLS e deadline usando il client service-role. Upsert su (user_id, question_code).
Uso: python -m scripts.force_special
"""
from datetime import datetime, timezone

from app.database import supabase_admin

USER_ID = "8fae6333-f48c-4912-88eb-ef279c8fef11"

ANSWERS = {
    "most_goals_team": {"team_tla": "ENG"},
    "top_scorer": {"player_id": 1699},
    "most_conceded_team": {"team_tla": "PAN"},
    "podium": {"podium": ["ESP", "FRA", "ENG"]},
}


def main() -> None:
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        {
            "user_id": USER_ID,
            "question_code": code,
            "answer": answer,
            "updated_at": now,
        }
        for code, answer in ANSWERS.items()
    ]
    res = (
        supabase_admin.table("special_predictions")
        .upsert(rows, on_conflict="user_id,question_code")
        .execute()
    )
    print(f"Upserted {len(res.data)} predictions for {USER_ID}:")
    for r in res.data:
        print(f"  {r['question_code']}: {r['answer']}")


if __name__ == "__main__":
    main()
