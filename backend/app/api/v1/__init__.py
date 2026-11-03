from fastapi import APIRouter
from app.api.v1.schemes import router as schemes_router
from app.api.v1.auctions import router as auctions_router
from app.api.v1.payments import router as payments_router
from app.api.v1.payouts import router as payouts_router
from app.api.v1.members import router as members_router
from app.api.v1.reports import router as reports_router

api_router = APIRouter(prefix="/v1")

api_router.include_router(schemes_router)
api_router.include_router(auctions_router)
api_router.include_router(payments_router)
api_router.include_router(payouts_router)
api_router.include_router(members_router)
api_router.include_router(reports_router)
