from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.services.sync import sync_matches
from app.services.leaderboard import save_snapshot
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
    special,
    sync,
    users,
)

# timezone=UTC: lo snapshot deve girare alle 00:05 UTC ovunque, indipendentemente
# dal fuso dell'host (in locale sarebbe Europe/Rome).
scheduler = AsyncIOScheduler(timezone="UTC")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sync risultati: ogni 30 minuti (48 richieste/giorno, sotto la quota free di
    # football-data da 100/giorno). sync_matches è una coroutine + idempotente (upsert).
    scheduler.add_job(sync_matches, "interval", minutes=30, id="sync", replace_existing=True)
    # Snapshot classifica: ogni giorno alle 00:05 UTC (serve al trend). save_snapshot
    # è sincrona: AsyncIOScheduler la esegue comunque in un thread executor.
    scheduler.add_job(save_snapshot, "cron", hour=0, minute=5, id="snapshot", replace_existing=True)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="LMN World Cup API", version="1.0.0", lifespan=lifespan)

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
app.include_router(special.router)
app.include_router(sync.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"name": "LMN World Cup API", "docs": "/docs"}
