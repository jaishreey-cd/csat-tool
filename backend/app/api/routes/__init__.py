from app.api.routes.auth import router as auth_router
from app.api.routes.clients import router as clients_router
from app.api.routes.data_sync import router as data_sync_router
from app.api.routes.surveys import router as surveys_router
from app.api.routes.analytics import router as analytics_router

__all__ = ["auth_router", "clients_router", "data_sync_router", "surveys_router", "analytics_router"]
