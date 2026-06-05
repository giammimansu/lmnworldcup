from fastapi import APIRouter

from app.database import check_connection

router = APIRouter(tags=["health"])


@router.get("/ping")
def ping():
    return {"status": "ok", "db": check_connection()}
