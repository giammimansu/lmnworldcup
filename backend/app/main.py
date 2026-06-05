from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    admin,
    auth,
    bracket,
    health,
    leaderboard,
    leagues,
    matches,
    players,
    predictions,
    recap,
    scoring,
    sync,
    users,
)

app = FastAPI(title="LMN World Cup API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(bracket.router)
app.include_router(matches.router)
app.include_router(players.router)
app.include_router(leaderboard.router)
app.include_router(leagues.router)
app.include_router(predictions.router)
app.include_router(recap.router)
app.include_router(scoring.router)
app.include_router(sync.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"name": "LMN World Cup API", "docs": "/docs"}
