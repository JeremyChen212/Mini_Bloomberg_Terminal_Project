"""
OpenBB Terminal Backend — Main FastAPI Application
Bloomberg-alternative data platform
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import equity, filings, executives, search, health, aligned_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print(f"Starting {settings.APP_NAME} v{settings.VERSION}")
    print(f"OpenBB provider: {settings.DEFAULT_PROVIDER}")
    yield
    print("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Open-source Bloomberg alternative — financial data platform for analysts & AI agents.",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, tags=["Health"])
app.include_router(equity.router,       prefix="/api/v1/equity",     tags=["Equity"])
app.include_router(filings.router,      prefix="/api/v1/filings",    tags=["SEC Filings"])
app.include_router(executives.router,   prefix="/api/v1/executives", tags=["Executives"])
app.include_router(search.router,       prefix="/api/v1/search",     tags=["Search"])
app.include_router(aligned_data.router, prefix="/api/v1/data",       tags=["Aligned Data"])


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "status": "online",
    }
