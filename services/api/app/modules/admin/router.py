"""Admin module — placeholder router (filled out in V1+)."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def _index():
    return {"module": "admin", "status": "ok"}
