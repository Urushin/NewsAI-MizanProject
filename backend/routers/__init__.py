from .auth import router as auth_router
from .profile import router as profile_router
from .briefs import router as briefs_router
from .billing import router as billing_router
from .system import router as system_router

__all__ = [
    "auth_router",
    "profile_router",
    "briefs_router",
    "billing_router",
    "system_router"
]
