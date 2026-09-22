from collections.abc import Mapping
from typing import Any

from api.schemas.simulation import SimulationStatus
from api.schemas.websocket import FlyState, SimulationRealtimeEvent


def status_event(
    status: SimulationStatus,
    previous: SimulationRealtimeEvent | None = None,
) -> SimulationRealtimeEvent:
    return SimulationRealtimeEvent(
        type="simulation_status",
        status=status.state,
        message=status.message,
        updated_at=status.updated_at,
        simulation_time=status.simulation_time,
        fly_state=previous.fly_state if previous is not None else None,
        total_spike_count=previous.total_spike_count if previous is not None else 0,
    )


def update_event(
    status: SimulationStatus,
    observation: Mapping[str, Any],
    previous: SimulationRealtimeEvent | None = None,
) -> SimulationRealtimeEvent:
    raw_spike_ids = observation.get("spike_ids", ())
    spike_ids = [int(neuron_id) for neuron_id in raw_spike_ids]
    raw_fly_state = observation.get("fly_state")
    fly_state = (
        FlyState.model_validate(raw_fly_state)
        if raw_fly_state is not None
        else previous.fly_state if previous is not None else None
    )

    return SimulationRealtimeEvent(
        type="simulation_update",
        status=status.state,
        message=status.message,
        updated_at=status.updated_at,
        simulation_time=float(observation.get("simulation_time", status.simulation_time)),
        fly_state=fly_state,
        spike_ids=spike_ids,
        spike_count=len(spike_ids),
        active_neuron_count=len(set(spike_ids)),
        total_spike_count=int(
            observation.get(
                "total_spike_count",
                previous.total_spike_count if previous is not None else 0,
            )
        ),
    )
