import os
import sys
import time
import pathlib
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

from database import init_db
from monitoring import monitoring_middleware
from feedback import router as feedback_router

from routers import (
    auth_router,
    profile_router,
    briefs_router,
    billing_router,
    system_router
)

# ══════════════════════════════════════════
# Lifespan
# ══════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Mizan.ai API starting...")
    init_db()
    yield
    logger.info("🛑 Mizan.ai API shutting down...")


# ── App ──
app = FastAPI(
    title="Mizan.ai API",
    version="6.0 (SaaS) Modular",
    lifespan=lifespan,
)


# ══════════════════════════════════════════
# CORS
# ══════════════════════════════════════════
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.66:3000", # Access from local network
]
_frontend_url = os.getenv("FRONTEND_URL", "")
if _frontend_url:
    _allowed_origins.append(_frontend_url)

# In development, also allow the local IP explicitly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════
# Rate Limiting Middleware
# ══════════════════════════════════════════
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 60
_rate_limit_db: dict = defaultdict(list)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path in ("/api/health", "/api/billing/webhook") or os.getenv("APP_STAGE") == "development":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    _rate_limit_db[client_ip] = [
        t for t in _rate_limit_db[client_ip]
        if now - t < RATE_LIMIT_WINDOW
    ]

    if len(_rate_limit_db[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Try again later."},
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )

    _rate_limit_db[client_ip].append(now)
    response = await call_next(request)
    return response


# Monitoring middleware
app.middleware("http")(monitoring_middleware)

# Include feedback router
app.include_router(feedback_router)

# Include modularized routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(briefs_router)
app.include_router(billing_router)
app.include_router(system_router)
