"""Client async per football-data.org v4 con gestione rate limit (free tier: 10 req/min)."""
import asyncio

import httpx

from app.config import settings

BASE_URL = "https://api.football-data.org/v4"
MAX_RETRIES = 3
TIMEOUT = httpx.Timeout(20.0)


class FootballAPIError(Exception):
    pass


async def get_world_cup_matches(season: int = 2026) -> list[dict]:
    """GET /competitions/WC/matches?season=... — ritorna la lista raw delle partite.

    Retry con backoff esponenziale su 429 (rate limit) e errori di rete transitori.
    """
    if not settings.football_data_api_key:
        raise FootballAPIError("FOOTBALL_DATA_API_KEY non configurata")

    headers = {"X-Auth-Token": settings.football_data_api_key}
    url = f"{BASE_URL}/competitions/WC/matches"
    params = {"season": season}

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(MAX_RETRIES + 1):
            try:
                resp = await client.get(url, headers=headers, params=params)
            except httpx.TransportError as exc:
                if attempt == MAX_RETRIES:
                    raise FootballAPIError(f"Errore di rete: {exc}")
                await asyncio.sleep(2**attempt)
                continue

            if resp.status_code == 429:
                if attempt == MAX_RETRIES:
                    raise FootballAPIError("Rate limit football-data.org superato")
                # Retry-After se presente, altrimenti backoff esponenziale
                wait = int(resp.headers.get("Retry-After", 2**attempt * 5))
                await asyncio.sleep(wait)
                continue

            if resp.status_code != 200:
                raise FootballAPIError(
                    f"football-data.org HTTP {resp.status_code}: {resp.text[:200]}"
                )

            return resp.json().get("matches", [])

    raise FootballAPIError("Retry esauriti")
