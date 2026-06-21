from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Outcome = Literal["exact", "sign", "wrong", "pending"]


class PredictionCreate(BaseModel):
    match_id: int
    home_score: int = Field(ge=0, le=99)
    away_score: int = Field(ge=0, le=99)


class PredictionOut(BaseModel):
    id: str
    match_id: int
    home_score: int
    away_score: int
    points: int | None = None
    outcome: Outcome
    created_at: datetime
    updated_at: datetime


ScorerOutcome = Literal["hit", "miss", "pending"]


class ScorerPredictionCreate(BaseModel):
    match_id: int
    player_ids: list[int]  # H marcatori casa + A marcatori trasferta (duplicati ok)


class ScorerPlayer(BaseModel):
    player_id: int
    player_name: str
    team_id: int | None = None
    team_tla: str | None = None


class ScorerPredictionOut(BaseModel):
    id: str
    match_id: int
    players: list[ScorerPlayer]
    points: int | None = None
    outcome: ScorerOutcome


class SignDistribution(BaseModel):
    home: float  # % segno 1
    draw: float  # % segno X
    away: float  # % segno 2


class PopularScore(BaseModel):
    home_score: int
    away_score: int
    count: int


class MatchPredictionsSummary(BaseModel):
    match_id: int
    total: int
    signs: SignDistribution
    top_scores: list[PopularScore]
