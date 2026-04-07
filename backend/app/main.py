import sys
import os

# Adds the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".."))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
import logging
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.api.endpoints import router as api_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# Serve the built mobile React app via ngrok HTTPS (camera-safe)
MOBILE_DIST = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "..", "mobile", "dist"
))

if os.path.isdir(MOBILE_DIST):
    # Mount /assets so index.html's absolute /assets/... references resolve correctly
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(MOBILE_DIST, "assets")),
        name="assets",
    )

    @app.get("/mobile")
    async def serve_mobile():
        """Serve the React SPA — phone opens this URL via ngrok HTTPS."""
        return FileResponse(os.path.join(MOBILE_DIST, "index.html"))


@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

@app.get("/")
async def root():
    return RedirectResponse(url="/mobile")
