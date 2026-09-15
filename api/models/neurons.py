from typing import Optional, List
from sqlmodel import SQLModel, Field
from pydantic import field_validator


class NeuronBase(SQLModel):
    neuronClass: Optional[str] = Field(default=None, sa_column_kwargs={"name": "class"})

    type: Optional[str] = None
    group: Optional[float] = None
    instance: Optional[str] = None
    flywireType: Optional[str] = None
    hemibrainType: Optional[str] = None
    mancType: Optional[str] = None
    superclass: Optional[str] = None
    subclass: Optional[str] = None
    status: Optional[str] = None
    statusLabel: Optional[str] = None
    somaSide: Optional[str] = None
    rootSide: Optional[str] = None
    somaNeuromere: Optional[str] = None
    vfbId: Optional[str] = None
    itoleeHl: Optional[str] = None
    supertype: Optional[str] = None
    birthtime: Optional[str] = None
    dimorphism: Optional[str] = None
    matchingNotes: Optional[str] = None
    entryNerve: Optional[str] = None
    exitNerve: Optional[str] = None
    serialMotif: Optional[str] = None
    fruDsx: Optional[str] = None
    receptorType: Optional[str] = None
    trumanHl: Optional[str] = None
    synonyms: Optional[str] = None
    mancBodyid: Optional[float] = None
    mancGroup: Optional[float] = None
    mancSerial: Optional[float] = None
    mcnsSerial: Optional[float] = None


class Neurons(NeuronBase, table=True):
    bodyId: int = Field(primary_key=True)

    somaLocation: Optional[List[int]] = None
    tosomaLocation: Optional[List[int]] = None


class NeuronSearchResult(SQLModel):
    """Compact model optimized for the UI Search Bar."""

    bodyId: str
    type: Optional[str] = None
    instance: Optional[str] = None
    superclass: Optional[str] = None
    status: Optional[str] = None

    @field_validator("bodyId", mode="before")
    @classmethod
    def serialize_body_id(cls, v):
        return str(v) if v is not None else ""
