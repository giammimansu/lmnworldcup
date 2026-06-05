from datetime import datetime

from pydantic import BaseModel


class Match(BaseModel):
    id: int
    utc_date: datetime
    status: str
    stage: str
    matchday: int | None = None
    group_name: str | None = None
    home_team_id: int | None = None
    home_team_name: str | None = None
    home_team_tla: str | None = None
    home_team_crest: str | None = None
    away_team_id: int | None = None
    away_team_name: str | None = None
    away_team_tla: str | None = None
    away_team_crest: str | None = None
    home_score: int | None = None
    away_score: int | None = None
    last_synced: datetime | None = None
