"""
Importa le rose ufficiali FIFA (PDF) nella tabella `players`.

USO:
    cd backend
    uv add pdfplumber            # dipendenza una-tantum
    # scarica il PDF in locale, es. in backend/data/SquadLists-English.pdf
    uv run python -m scripts.import_squads_from_fifa data/SquadLists-English.pdf

Cosa fa:
  1. Legge il PDF FIFA (una pagina per nazionale, 26 giocatori).
  2. Estrae per ogni giocatore: nome, ruolo, numero di maglia.
  3. Mappa il nome FIFA della nazionale al `team_name` presente nella tabella `matches`
     (per recuperare team_tla e team_id già allineati col resto dell'app).
  4. Scrive `data/squads.json` per ispezione E popola la tabella `players`.
  5. Stampa diagnostica: squadre abbinate, non abbinate, giocatori per squadra.

Nota: il PDF è "Versione 1". Se FIFA pubblica un aggiornamento, riscarica e rilancia:
lo script fa un full refresh (svuota e ricarica `players`).
"""
import sys
import re
import json
import unicodedata
from pathlib import Path

import pdfplumber

from app.database import supabase_admin

POSITIONS = {"GK": "Goalkeeper", "DF": "Defender", "MF": "Midfielder", "FW": "Forward"}

# Mappa i nomi FIFA (normalizzati) -> team_name come appare nella tabella `matches`.
# Aggiungi/correggi qui se lo script segnala squadre "non abbinate".
NAME_OVERRIDES = {
    "korea republic": "South Korea",
    "bosnia and herzegovina": "Bosnia-Herzegovina",
    "cote d ivoire": "Ivory Coast",
    "ivory coast": "Ivory Coast",
    "cabo verde": "Cape Verde Islands",
    "cape verde": "Cape Verde Islands",
    "turkiye": "Turkey",
    "turkey": "Turkey",
    "dr congo": "Congo DR",
    "congo dr": "Congo DR",
    "united states of america": "United States",
    "usa": "United States",
    "iran islamic republic of": "Iran",
    "ir iran": "Iran",
}

PDF_DATA = Path(__file__).parent.parent / "data"
OUT_JSON = PDF_DATA / "squads.json"

DOB_RE = re.compile(r"\d{2}/\d{2}/\d{4}")
TEAM_HEADER_RE = re.compile(r"^([A-Za-zÀ-ÿ'’.\- ]+?)\s+\(([A-Z]{3})\)\s*$")
PLAYER_LINE_RE = re.compile(
    r"^(\d+)\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{2}/\d{2}/\d{4})\s+.*\(([A-Z]{3})\)\s+\d+\s*$"
)


def norm(s: str) -> str:
    """Normalizza: niente accenti, minuscolo, solo alfanumerico e spazi singoli."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-zA-Z0-9 ]", " ", s).lower()
    return re.sub(r"\s+", " ", s).strip()


def clean_text(s: str) -> str:
    """Rimuove NUL e caratteri di controllo che pdfplumber a volte inietta
    (Postgres rifiuta \\u0000 nelle colonne text)."""
    return "".join(c for c in s if c == " " or unicodedata.category(c)[0] != "C")


def display_name(name_cols: str) -> str:
    """Dal blocco-nome FIFA ('COGNOME Nome ... nome-maglia') ricava 'COGNOME Nome'.
    Euristica: prende i token finché non incontra il primo token in Title case
    (la parte iniziale è il cognome in MAIUSCOLO)."""
    name_cols = clean_text(name_cols)
    tokens = name_cols.split()
    out = []
    for t in tokens:
        out.append(t)
        # token Title case = inizia maiuscolo, non è tutto maiuscolo -> è il nome proprio
        if t[:1].isupper() and not t.isupper():
            break
    return " ".join(out) if out else name_cols.strip()


def parse_pdf(path: Path) -> list[dict]:
    """Ritorna [{fifa_name, fifa_code, players:[{name, position, shirt_number}]}]."""
    squads: list[dict] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

            current = None
            shirt = 0
            for ln in lines:
                header = TEAM_HEADER_RE.match(ln)
                if header and "SQUAD LIST" not in ln and "FIFA World Cup" not in ln:
                    current = {
                        "fifa_name": header.group(1).strip(),
                        "fifa_code": header.group(2),
                        "players": [],
                    }
                    squads.append(current)
                    shirt = 0
                    continue

                m = PLAYER_LINE_RE.match(ln)
                if m and current is not None:
                    shirt = int(m.group(1))
                    pos = m.group(2)
                    name = display_name(m.group(3))
                    current["players"].append({
                        "name": name,
                        "position": POSITIONS.get(pos, pos),
                        "shirt_number": shirt,
                    })

    # tieni solo squadre con un numero plausibile di giocatori
    return [s for s in squads if len(s["players"]) >= 20]


def load_matches_teams() -> dict[str, tuple]:
    """team_name normalizzato -> (team_name, team_tla, team_id) dalla tabella matches."""
    rows = supabase_admin.table("matches").select(
        "home_team_name, home_team_tla, home_team_id, "
        "away_team_name, away_team_tla, away_team_id"
    ).execute().data
    teams: dict[str, tuple] = {}
    for r in rows:
        for side in ("home", "away"):
            name = r.get(f"{side}_team_name")
            if name:
                teams[norm(name)] = (name, r.get(f"{side}_team_tla"), r.get(f"{side}_team_id"))
    return teams


def main(pdf_path: str):
    # Console Windows usa cp1252: forza utf-8 per emoji/accenti nei print.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    path = Path(pdf_path)
    if not path.exists():
        sys.exit(f"PDF non trovato: {path}")

    parsed = parse_pdf(path)
    print(f"Squadre lette dal PDF: {len(parsed)}")

    teams = load_matches_teams()
    print(f"Squadre trovate in matches: {len(teams)}")

    squads_json = []
    db_rows = []
    unmatched = []

    for s in parsed:
        key = norm(s["fifa_name"])
        target = NAME_OVERRIDES.get(key)
        if target:
            tinfo = teams.get(norm(target))
        else:
            tinfo = teams.get(key)

        if not tinfo:
            unmatched.append(f"{s['fifa_name']} ({s['fifa_code']})")
            continue

        team_name, team_tla, team_id = tinfo
        squads_json.append({
            "team_tla": team_tla,
            "team_name": team_name,
            "team_id": team_id,
            "players": s["players"],
        })
        for p in s["players"]:
            db_rows.append({
                "team_id": team_id,
                "team_tla": team_tla,
                "team_name": team_name,
                "name": p["name"],
                "position": p["position"],
                "shirt_number": p["shirt_number"],
            })

    # Salva il JSON per ispezione
    OUT_JSON.parent.mkdir(exist_ok=True)
    OUT_JSON.write_text(json.dumps(squads_json, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Scritto {OUT_JSON} con {len(squads_json)} squadre, {len(db_rows)} giocatori.")

    if unmatched:
        print("\n⚠️  Squadre NON abbinate (aggiungi un override in NAME_OVERRIDES):")
        for u in unmatched:
            print(f"   - {u}")
        print("   Correggi la mappa e rilancia. Niente è stato scritto su `players`.")
        return

    # Full refresh della tabella players
    supabase_admin.table("players").delete().neq("id", 0).execute()
    # insert a blocchi per non superare i limiti di payload
    for i in range(0, len(db_rows), 500):
        supabase_admin.table("players").insert(db_rows[i:i + 500]).execute()

    print(f"\n✅ Importati {len(db_rows)} giocatori in `players`.")
    print("Riepilogo per squadra:")
    for sq in squads_json:
        print(f"   {sq['team_tla']:>4}  {sq['team_name']:<22} {len(sq['players'])} giocatori")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Uso: uv run python -m scripts.import_squads_from_fifa <percorso_pdf>")
    main(sys.argv[1])
