"""Logica di sblocco achievements.

Valutata dopo ogni score_match (via evaluate_achievements_for_match) e
on-demand. "primo_sangue" viene valutato anche alla creazione del pronostico.
"""
from app.database import supabase_admin
from app.services.scoring import _sign


def _achievement_ids() -> dict[str, int]:
    rows = supabase_admin.table("achievements").select("id, code").execute().data
    return {r["code"]: r["id"] for r in rows}


def _unlocked_codes(user_id: str, ids_by_code: dict[str, int]) -> set[str]:
    rows = (
        supabase_admin.table("user_achievements")
        .select("achievement_id")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    unlocked_ids = {r["achievement_id"] for r in rows}
    return {code for code, aid in ids_by_code.items() if aid in unlocked_ids}


def _unlock(user_id: str, code: str, ids_by_code: dict[str, int]) -> bool:
    aid = ids_by_code.get(code)
    if aid is None:
        return False
    supabase_admin.table("user_achievements").upsert(
        {"user_id": user_id, "achievement_id": aid},
        on_conflict="user_id,achievement_id",
    ).execute()
    return True


def check_primo_sangue(user_id: str) -> None:
    """Primo in assoluto a inserire un pronostico nel torneo.

    Chiamata alla creazione di ogni pronostico: se il totale è 1 ed è
    dell'utente, sblocca.
    """
    ids_by_code = _achievement_ids()
    if not ids_by_code:
        return
    # qualcuno l'ha già sbloccato?
    existing = (
        supabase_admin.table("user_achievements")
        .select("user_id")
        .eq("achievement_id", ids_by_code["primo_sangue"])
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return
    first = (
        supabase_admin.table("predictions")
        .select("user_id")
        .order("created_at")
        .limit(1)
        .execute()
        .data
    )
    if first and first[0]["user_id"] == user_id:
        _unlock(user_id, "primo_sangue", ids_by_code)


def evaluate_achievements_for_match(match_id: int) -> int:
    """Valuta gli achievement per tutti gli utenti con un pronostico sulla partita.

    Da chiamare dopo score_match. Ritorna il numero di sblocchi nuovi.
    """
    preds = (
        supabase_admin.table("predictions")
        .select("user_id")
        .eq("match_id", match_id)
        .execute()
        .data
    )
    user_ids = {p["user_id"] for p in preds}
    unlocked = 0
    for uid in user_ids:
        unlocked += evaluate_achievements_for_user(uid)
    return unlocked


def evaluate_achievements_for_user(user_id: str) -> int:
    """Valuta cecchino, veggente, en_plein, comeback per un utente."""
    ids_by_code = _achievement_ids()
    if not ids_by_code:
        return 0
    already = _unlocked_codes(user_id, ids_by_code)
    new_unlocks = 0

    preds = (
        supabase_admin.table("predictions")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not preds:
        return 0

    match_ids = [p["match_id"] for p in preds]
    matches = (
        supabase_admin.table("matches").select("*").in_("id", match_ids).execute().data
    )
    matches_by_id = {m["id"]: m for m in matches}

    # Pronostici su partite finite, ordinati per data partita
    scored = []
    for p in preds:
        m = matches_by_id.get(p["match_id"])
        if m and m["status"] == "FINISHED" and m["home_score"] is not None:
            exact = (
                p["home_score"] == m["home_score"] and p["away_score"] == m["away_score"]
            )
            correct = exact or _sign(p["home_score"], p["away_score"]) == _sign(
                m["home_score"], m["away_score"]
            )
            scored.append(
                {
                    "utc_date": m["utc_date"],
                    "matchday": m.get("matchday"),
                    "stage": m["stage"],
                    "exact": exact,
                    "correct": correct,
                }
            )
    scored.sort(key=lambda s: s["utc_date"])

    # cecchino: 3 risultati esatti totali
    if "cecchino" not in already and sum(1 for s in scored if s["exact"]) >= 3:
        if _unlock(user_id, "cecchino", ids_by_code):
            new_unlocks += 1

    # veggente: 5 pronostici corretti (esatto o segno) di fila
    if "veggente" not in already:
        streak = best = 0
        for s in scored:
            streak = streak + 1 if s["correct"] else 0
            best = max(best, streak)
        if best >= 5:
            if _unlock(user_id, "veggente", ids_by_code):
                new_unlocks += 1

    # en_plein: tutti esatti in una giornata (gironi), con tutte le partite
    # della giornata finite e pronosticate
    if "en_plein" not in already:
        all_matches = (
            supabase_admin.table("matches")
            .select("id, matchday, status, home_score")
            .eq("stage", "GROUP_STAGE")
            .execute()
            .data
        )
        by_md: dict[int, list[dict]] = {}
        for m in all_matches:
            if m.get("matchday") is not None:
                by_md.setdefault(m["matchday"], []).append(m)
        preds_by_match = {p["match_id"]: p for p in preds}
        for md, md_matches in by_md.items():
            if not md_matches or any(m["status"] != "FINISHED" for m in md_matches):
                continue
            results = []
            for m in md_matches:
                p = preds_by_match.get(m["id"])
                if p is None:
                    results = []
                    break
                full = matches_by_id.get(m["id"])
                if full is None:
                    # ricarica non in cache (pronostico mancante su quel match)
                    results = []
                    break
                results.append(
                    p["home_score"] == full["home_score"]
                    and p["away_score"] == full["away_score"]
                )
            if results and all(results):
                if _unlock(user_id, "en_plein", ids_by_code):
                    new_unlocks += 1
                break

    # comeback: +3 posizioni rispetto all'ultimo snapshot
    if "comeback" not in already:
        from app.services.leaderboard import compute_leaderboard

        board = compute_leaderboard()
        row = next((r for r in board if r["user_id"] == user_id), None)
        if row and row["trend"] >= 3:
            if _unlock(user_id, "comeback", ids_by_code):
                new_unlocks += 1

    return new_unlocks


def get_user_achievements(user_id: str) -> dict:
    """Badge sbloccati + da sbloccare."""
    all_achievements = (
        supabase_admin.table("achievements").select("*").order("id").execute().data
    )
    unlocked_rows = (
        supabase_admin.table("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    unlocked_at = {r["achievement_id"]: r["unlocked_at"] for r in unlocked_rows}

    return {
        "achievements": [
            {
                "code": a["code"],
                "name": a["name"],
                "description": a["description"],
                "icon": a["icon"],
                "unlocked": a["id"] in unlocked_at,
                "unlocked_at": unlocked_at.get(a["id"]),
            }
            for a in all_achievements
        ]
    }
