import sys
import os

# Adds the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".."))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.api.endpoints import router as api_router

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Allow the local frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(title=settings.PROJECT_NAME)

# Add this block! 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In a real app, use ["https://madalyn-rebuffable-hilda.ngrok-free.dev"]
    allow_credentials=True,
    allow_methods=["*"], # Allows POST, GET, OPTIONS, etc.
    allow_headers=["*"], # Allows 'bypass-tunnel-reminder' and other custom headers
)

app.include_router(api_router, prefix="/api/v1")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

@app.get("/")
async def root():
    return {"message": "Welcome to AisleIQ API"}
