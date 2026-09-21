from fastapi import APIRouter

from api.schemas.simulation import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Check API health")
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="fly-brain-api",
        version="1.0.0",
    )
