from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class SimulationState(StrEnum):
    IDLE = "idle"
    STARTING = "starting"
    RUNNING = "running"
    PAUSED = "paused"
    RESETTING = "resetting"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"


class SimulationStatus(BaseModel):
    state: SimulationState
    simulation_time: float = Field(ge=0)
    message: str
    error: str | None = None
    updated_at: datetime
    started_at: datetime | None = None


class SimulationCommandResponse(BaseModel):
    state: SimulationState
    message: str
    status_url: str = "/simulation/status"


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
