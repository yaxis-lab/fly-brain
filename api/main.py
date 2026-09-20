from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI(
    title="MaleCNS Explorer API",
    version="1.0.0",
    description=(
        "Local API for exploring the MaleCNS v1.0 " "connectome and morphology."
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


