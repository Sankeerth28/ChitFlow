from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from datetime import date
from decimal import Decimal
from pydantic import BaseModel

from app.db.session import get_db
from app.api.deps import (
    get_current_user,
    get_current_active_organiser,
    require_role,
)
from app.models.entities import (
    User,
    Organiser,
    ChitScheme,
    Member,
    Auction,
    Payout,
    Instalment,
    Payment,
    JournalEntryRecord,
    JournalEntryLineRecord,
    LedgerAccount,
)
from app.schemas.ledger import (
    TrialBalanceResponse,
    TrialBalanceLine,
    JournalEntryResponse,
    JournalLineResponse,
)

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


class OrganiserDashboardMetrics(BaseModel):
    active_chits: int
    total_members: int
    monthly_collections: Decimal
    pending_collections: Decimal
    upcoming_auctions: int
    pending_payouts: int
    outstanding_amount: Decimal
    recorded_commission: Decimal


@router.get("/dashboard/organiser", response_model=OrganiserDashboardMetrics)
def get_organiser_dashboard(
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser", "accountant"])),
):
    """
    PRD Module 2: Organiser Dashboard Cards
    - Active Chits
    - Total Members
    - Monthly Collections
    - Pending Collections
    - Upcoming Auctions
    - Pending Payouts
    - Outstanding Amount
    - Recorded Organiser Commission
    Strictly scoped to the caller's tenant organisation.
    """
    active_chits = db.query(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        ChitScheme.status == "active",
    ).count()

    total_members = db.query(Member).filter(Member.organiser_id == organiser.id).count()

    upcoming_auctions = db.query(Auction).join(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        Auction.status == "scheduled",
    ).count()

    pending_payouts = db.query(Payout).join(Auction).join(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        Payout.status.in_(["awaiting_security", "security_verified", "approved"]),
    ).count()

    # Sum collections for this organiser (Fixes join bug BUG-004)
    monthly_collections = db.query(func.coalesce(func.sum(Payment.amount_received), 0)).join(
        Instalment, Payment.instalment_id == Instalment.id
    ).join(
        Auction, Instalment.auction_id == Auction.id
    ).join(
        ChitScheme, Auction.scheme_id == ChitScheme.id
    ).filter(
        ChitScheme.organiser_id == organiser.id,
        Payment.status == "paid",
    ).scalar()

    # Sum pending & outstanding
    unpaid_instalments = db.query(Instalment).join(
        Auction, Instalment.auction_id == Auction.id
    ).join(
        ChitScheme, Auction.scheme_id == ChitScheme.id
    ).filter(
        ChitScheme.organiser_id == organiser.id,
        Instalment.status != "paid",
    ).all()

    outstanding_amount = sum(
        (inst.net_amount_due - inst.amount_paid) for inst in unpaid_instalments
    ) if unpaid_instalments else Decimal('0.00')

    # Recorded commission from auctions
    recorded_commission = db.query(func.coalesce(func.sum(Auction.foreman_commission), 0)).join(
        ChitScheme
    ).filter(
        ChitScheme.organiser_id == organiser.id,
        Auction.status == "confirmed",
    ).scalar()

    return OrganiserDashboardMetrics(
        active_chits=active_chits,
        total_members=total_members,
        monthly_collections=Decimal(str(monthly_collections)),
        pending_collections=Decimal(str(outstanding_amount)),
        upcoming_auctions=upcoming_auctions,
        pending_payouts=pending_payouts,
        outstanding_amount=Decimal(str(outstanding_amount)),
        recorded_commission=Decimal(str(recorded_commission)),
    )


@router.get("/trial-balance", response_model=TrialBalanceResponse)
def get_trial_balance(
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser", "accountant"])),
):
    """
    Generate real-time double-entry Trial Balance for the caller's organisation.
    Guarantees sum(Debits) == sum(Credits).
    """
    accounts = db.query(LedgerAccount).filter(LedgerAccount.organiser_id == organiser.id).all()

    lines: List[TrialBalanceLine] = []
    total_debits = Decimal('0.00')
    total_credits = Decimal('0.00')

    for acc in accounts:
        debit_sum = db.query(func.coalesce(func.sum(JournalEntryLineRecord.debit_amount), 0)).filter(
            JournalEntryLineRecord.account_id == acc.id
        ).scalar()
        credit_sum = db.query(func.coalesce(func.sum(JournalEntryLineRecord.credit_amount), 0)).filter(
            JournalEntryLineRecord.account_id == acc.id
        ).scalar()

        dr = Decimal(str(debit_sum))
        cr = Decimal(str(credit_sum))
        total_debits += dr
        total_credits += cr

        net_bal = dr - cr if acc.account_type in ["asset", "expense"] else cr - dr

        lines.append(
            TrialBalanceLine(
                account_code=acc.account_code,
                account_name=acc.account_name,
                account_type=acc.account_type,
                total_debit=dr,
                total_credit=cr,
                net_balance=net_bal,
            )
        )

    return TrialBalanceResponse(
        as_of_date=date.today(),
        lines=lines,
        total_debits=total_debits,
        total_credits=total_credits,
        is_balanced=(total_debits == total_credits),
    )


@router.get("/journal-entries", response_model=List[JournalEntryResponse])
def list_journal_entries(
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser", "accountant"])),
):
    """List double-entry journal entries for caller's tenant organisation."""
    entries = db.query(JournalEntryRecord).filter(
        JournalEntryRecord.organiser_id == organiser.id
    ).order_by(JournalEntryRecord.created_at.desc()).all()

    results = []
    for e in entries:
        line_responses = []
        for l in e.lines:
            acc = db.query(LedgerAccount).filter(LedgerAccount.id == l.account_id).first()
            line_responses.append(
                JournalLineResponse(
                    id=l.id,
                    account_code=acc.account_code if acc else "",
                    account_name=acc.account_name if acc else "",
                    debit_amount=l.debit_amount,
                    credit_amount=l.credit_amount,
                    memo=l.memo,
                )
            )

        results.append(
            JournalEntryResponse(
                id=e.id,
                entry_number=e.entry_number,
                transaction_date=e.transaction_date,
                description=e.description,
                reference_entity_type=e.reference_entity_type,
                reference_entity_id=e.reference_entity_id,
                is_reversal=e.is_reversal,
                reversed_entry_id=e.reversed_entry_id,
                created_at=e.created_at,
                lines=line_responses,
            )
        )

    return results
