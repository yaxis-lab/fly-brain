from fastapi import APIRouter, Depends, HTTPException, Request, status

from api.schemas.simulation import SimulationCommandResponse, SimulationStatus
from api.simulation.manager import SimulationManager, SimulationTransitionError

router = APIRouter(prefix="/simulation", tags=["simulation"])


def get_manager(request: Request) -> SimulationManager:
    return request.app.state.simulation_manager


def _command_response(result: SimulationStatus) -> SimulationCommandResponse:
    return SimulationCommandResponse(
        state=result.state,
        message=result.message,
    )


def _transition_error(exc: SimulationTransitionError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=exc.detail,
    )


@router.post(
    "/start",
    response_model=SimulationCommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start the simulation",
)
def start(manager: SimulationManager = Depends(get_manager)) -> SimulationCommandResponse:
    try:
        return _command_response(manager.start())
    except SimulationTransitionError as exc:
        raise _transition_error(exc) from exc


@router.get(
    "/status",
    response_model=SimulationStatus,
    summary="Read simulation lifecycle status",
)
def simulation_status(
    manager: SimulationManager = Depends(get_manager),
) -> SimulationStatus:
    return manager.status()


@router.post(
    "/pause",
    response_model=SimulationCommandResponse,
    summary="Pause the simulation",
)
def pause(manager: SimulationManager = Depends(get_manager)) -> SimulationCommandResponse:
    try:
        return _command_response(manager.pause())
    except SimulationTransitionError as exc:
        raise _transition_error(exc) from exc


@router.post(
    "/resume",
    response_model=SimulationCommandResponse,
    summary="Resume the simulation",
)
def resume(manager: SimulationManager = Depends(get_manager)) -> SimulationCommandResponse:
    try:
        return _command_response(manager.resume())
    except SimulationTransitionError as exc:
        raise _transition_error(exc) from exc


@router.post(
    "/reset",
    response_model=SimulationCommandResponse,
    summary="Reset the simulation state",
)
def reset(manager: SimulationManager = Depends(get_manager)) -> SimulationCommandResponse:
    try:
        return _command_response(manager.reset())
    except SimulationTransitionError as exc:
        raise _transition_error(exc) from exc


@router.post(
    "/stop",
    response_model=SimulationCommandResponse,
    summary="Stop the simulation",
)
def stop(manager: SimulationManager = Depends(get_manager)) -> SimulationCommandResponse:
    try:
        return _command_response(manager.stop())
    except SimulationTransitionError as exc:
        raise _transition_error(exc) from exc
