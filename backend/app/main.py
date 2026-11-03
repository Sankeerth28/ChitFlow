from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from decimal import Decimal

from app.db.session import engine, Base, SessionLocal
from app.models.entities import Organiser, LedgerAccount
from app.api.v1 import api_router
from app.core.ledger_engine import (
    COA_CASH,
    COA_BANK,
    COA_REGISTRAR_DEPOSIT,
    COA_MEMBER_RECEIVABLE,
    COA_PRIZE_PAYABLE,
    COA_ROUNDING_SUSPENSE,
    COA_FOREMAN_CAPITAL,
    COA_FOREMAN_COMMISSION,
    COA_MEMBER_DIVIDEND_EXPENSE,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # Seed default organiser and initial Chart of Accounts if empty
    db = SessionLocal()
    try:
        org = db.query(Organiser).first()
        if not org:
            org = Organiser(
                business_name="Sri Balaji Chit Funds Pvt. Ltd.",
                trade_license_number="TL/HYD/2026/8941",
                chit_registrar_registration_no="REG/TS/HYD/CHIT/2026/042",
                state="Telangana",
                contact_phone="9849012345",
                contact_email="accounts@sribalajichits.in",
            )
            db.add(org)
            db.flush()

            # Seed standard Chart of Accounts
            standard_coa = [
                (COA_CASH, "Cash on Hand", "asset"),
                (COA_BANK, "Bank Operating Account", "asset"),
                (COA_REGISTRAR_DEPOSIT, "Chit Guarantee Deposit (Registrar)", "asset"),
                (COA_MEMBER_RECEIVABLE, "Member Subscriptions Receivable", "asset"),
                (COA_PRIZE_PAYABLE, "Prize Money Payable", "liability"),
                (COA_ROUNDING_SUSPENSE, "Rounding Suspense Account", "liability"),
                (COA_FOREMAN_CAPITAL, "Foreman Capital / Equity", "equity"),
                (COA_FOREMAN_COMMISSION, "Foreman Commission Income", "revenue"),
                (COA_MEMBER_DIVIDEND_EXPENSE, "Member Dividend Pool Distributed", "expense"),
            ]
            for code, name, acc_type in standard_coa:
                acc = LedgerAccount(
                    organiser_id=org.id,
                    account_code=code,
                    account_name=name,
                    account_type=acc_type,
                    current_balance=Decimal('0.00'),
                )
                db.add(acc)
            db.commit()
    finally:
        db.close()

    yield


app = FastAPI(
    title="ChitFlow API",
    description="Statutory Chit Fund Management System Backend compliant with Chit Funds Act, 1982.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "system": "ChitFlow",
        "motto": "Every Chit. Every Member. Every Rupee. Accounted For.",
        "statutes": ["Chit Funds Act, 1982", "Chit Funds (Amendment) Act, 2019", "Telangana Chit Funds Rules, 2008"],
        "version": "1.0.0",
        "status": "online",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
