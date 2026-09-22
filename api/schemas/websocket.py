from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from api.schemas.simulation import SimulationState


class FlyState(BaseModel):
    body_positions: list[list[float]] = Field(default_factory=list)
    body_rotations: list[list[float]] = Field(default_factory=list)
    joint_angles: list[float] = Field(default_factory=list)


class SimulationRealtimeEvent(BaseModel):
    type: Literal["simulation_status", "simulation_update"]
    status: SimulationState
    message: str
    updated_at: datetime
    simulation_time: float = Field(ge=0)
    fly_state: FlyState | None = None
    spike_ids: list[int] = Field(default_factory=list)
    spike_count: int = Field(default=0, ge=0)
    active_neuron_count: int = Field(default=0, ge=0)
    total_spike_count: int = Field(default=0, ge=0)
