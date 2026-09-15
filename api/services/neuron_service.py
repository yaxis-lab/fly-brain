import asyncio
import logging

import pandas as pd
from typing import List, Optional
from pydantic import field_validator
from sqlmodel import SQLModel, Session, select, or_, case
from sqlalchemy import cast, String

from api.models.neurons import Neurons, NeuronSearchResult

logger = logging.getLogger(__name__)


async def search_neuron(
    session: Session, query: str, limit: int = 10
) -> List[NeuronSearchResult]:
    search_param = f"%{query}%"

    # 2. Define the synchronous query execution logic
    def _execute_query() -> List[NeuronSearchResult]:
        statement = (
            select(
                Neurons.bodyId,
                Neurons.type,
                Neurons.instance,
                Neurons.superclass,
                Neurons.status,
            )
            .where(
                or_(
                    cast(Neurons.bodyId, String).ilike(search_param),
                    Neurons.type.ilike(search_param),
                    Neurons.instance.ilike(search_param),
                    Neurons.synonyms.ilike(search_param),
                )
            )
            .order_by(
                # Prioritize exact matches at the top of the search dropdown
                case(
                    (cast(Neurons.bodyId, String) == search_param, 1),
                    (Neurons.type.ilike(search_param), 2),
                    else_=3,
                ),
                # Fallback to alphabetical sorting
                Neurons.type.asc(),
            )
            .limit(limit)
        )

        # Execute the query
        results = session.exec(statement).all()

        # Map the results directly to the lightweight Pydantic UI model
        return [
            NeuronSearchResult(
                bodyId=row.bodyId,
                type=row.type,
                instance=row.instance,
                superclass=row.superclass,
                status=row.status,
            )
            for row in results
        ]

    # 3. Await the execution in a separate thread
    return await asyncio.to_thread(_execute_query)
