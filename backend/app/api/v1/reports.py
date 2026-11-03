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
    SchemeMember,
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
    # Core PRD counters (backward-compatible)
    active_chits: int
    total_members: int
    monthly_collections: Decimal
    pending_collections: Decimal
    upcoming_auctions: int
    pending_payouts: int
    outstanding_amount: Decimal
    recorded_commission: Decimal

    # Extended operational KPIs for Admin / Organiser
    active_members: int = 0
    inactive_members: int = 0
    total_enrolled_tickets: int = 0
    total_active_schemes: int = 0
    pending_verification_count: int = 0
    pending_verification_amount: Decimal = Decimal('0.00')
    auctions_conducted: int = 0
    recent_transactions: List[Dict[str, Any]] = []
    recent_registrations: List[Dict[str, Any]] = []
    action_alerts: List[Dict[str, Any]] = []


@router.get("/dashboard/admin", response_model=OrganiserDashboardMetrics)
@router.get("/dashboard/organiser", response_model=OrganiserDashboardMetrics)
def get_organiser_dashboard(
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser", "accountant"])),
):
    """
    PRD Module 2 & Section 2/3: Complete Administrative & Organiser Dashboard
    Real database aggregations with actionable alerts and recent feeds.
    Strictly scoped to the caller's tenant organisation.
    """
    active_chits = db.query(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        ChitScheme.status == "active",
    ).count()

    total_members = db.query(Member).filter(Member.organiser_id == organiser.id).count()

    active_members = db.query(Member).filter(
        Member.organiser_id == organiser.id,
        Member.status == "active",
    ).count()

    inactive_members = total_members - active_members

    total_enrolled_tickets = (
        db.query(SchemeMember)
        .join(ChitScheme, SchemeMember.scheme_id == ChitScheme.id)
        .filter(ChitScheme.organiser_id == organiser.id)
        .count()
    )

    upcoming_auctions = db.query(Auction).join(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        Auction.status == "scheduled",
    ).count()

    auctions_conducted = db.query(Auction).join(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        Auction.status == "confirmed",
    ).count()

    pending_payouts = db.query(Payout).join(Auction).join(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        Payout.status.in_(["awaiting_security", "security_verified", "approved"]),
    ).count()

    # Sum collections for this organiser (paid payments)
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

    # Pending payment verification queue
    pending_verify_q = (
        db.query(Payment)
        .join(Instalment, Payment.instalment_id == Instalment.id)
        .join(Auction, Instalment.auction_id == Auction.id)
        .join(ChitScheme, Auction.scheme_id == ChitScheme.id)
        .filter(
            ChitScheme.organiser_id == organiser.id,
            Payment.status == "submitted",
        )
    )
    pending_verification_count = pending_verify_q.count()
    pending_verification_sum = db.query(func.coalesce(func.sum(Payment.amount_received), 0)).join(
        Instalment, Payment.instalment_id == Instalment.id
    ).join(
        Auction, Instalment.auction_id == Auction.id
    ).join(
        ChitScheme, Auction.scheme_id == ChitScheme.id
    ).filter(
        ChitScheme.organiser_id == organiser.id,
        Payment.status == "submitted",
    ).scalar()
    pending_verification_amount = Decimal(str(pending_verification_sum))

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

    # Recorded commission from confirmed auctions
    recorded_commission = db.query(func.coalesce(func.sum(Auction.foreman_commission), 0)).join(
        ChitScheme
    ).filter(
        ChitScheme.organiser_id == organiser.id,
        Auction.status == "confirmed",
    ).scalar()

    # Recent Transactions Feed (Latest payments and payouts)
    recent_transactions: List[Dict[str, Any]] = []

    latest_payments = (
        db.query(Payment)
        .join(Instalment, Payment.instalment_id == Instalment.id)
        .join(Auction, Instalment.auction_id == Auction.id)
        .join(ChitScheme, Auction.scheme_id == ChitScheme.id)
        .filter(ChitScheme.organiser_id == organiser.id)
        .order_by(Payment.created_at.desc())
        .limit(6)
        .all()
    )
    for p in latest_payments:
        mem_name = "Subscriber"
        m = db.query(Member).filter(Member.id == p.member_id).first()
        if m:
            mem_name = m.full_name
        recent_transactions.append({
            "id": p.id,
            "type": "collection",
            "title": f"Subscription Payment #{p.receipt_number}",
            "amount": float(p.amount_received),
            "date": p.payment_date.isoformat() if p.payment_date else p.created_at.date().isoformat(),
            "status": p.status,
            "party": mem_name,
            "method": p.payment_method,
        })

    # Recent Registrations Feed
    recent_members = (
        db.query(Member)
        .filter(Member.organiser_id == organiser.id)
        .order_by(Member.created_at.desc())
        .limit(6)
        .all()
    )
    recent_registrations: List[Dict[str, Any]] = []
    for m in recent_members:
        recent_registrations.append({
            "id": m.id,
            "member_code": m.member_code,
            "full_name": m.full_name,
            "mobile_number": m.user.mobile_number if m.user else None,
            "city": m.city,
            "status": getattr(m, "status", "active") or "active",
            "kyc_status": m.kyc_status or "verified",
            "created_at": m.created_at.strftime("%d %b %Y"),
        })

    # Actionable Compliance & Operational Alerts
    action_alerts: List[Dict[str, Any]] = []
    if pending_verification_count > 0:
        action_alerts.append({
            "id": "alert-verify-payments",
            "level": "warning",
            "title": f"{pending_verification_count} Pending Payment Verifications",
            "message": f"Payments totaling ₹{pending_verification_amount:,.2f} have been submitted by subscribers and await accountant verification and ledger posting.",
            "target_tab": "payments",
        })
    if upcoming_auctions > 0:
        action_alerts.append({
            "id": "alert-auctions",
            "level": "info",
            "title": f"{upcoming_auctions} Upcoming Statutory Auctions",
            "message": f"{upcoming_auctions} chit auctions are scheduled. Ensure bidding rosters and minutes of auction are ready.",
            "target_tab": "auctions",
        })
    if pending_payouts > 0:
        action_alerts.append({
            "id": "alert-payouts",
            "level": "warning",
            "title": f"{pending_payouts} Prize Money Disbursements Pending",
            "message": f"{pending_payouts} winning subscribers require Section 31 surety verification or payment release.",
            "target_tab": "payouts",
        })
    if active_chits == 0 and total_members > 0:
        action_alerts.append({
            "id": "alert-no-active-schemes",
            "level": "info",
            "title": "No Active Chit Schemes",
            "message": "You have registered subscribers. Create a chit scheme and enroll subscribers to initiate monthly auctions.",
            "target_tab": "schemes",
        })

    return OrganiserDashboardMetrics(
        active_chits=active_chits,
        total_members=total_members,
        monthly_collections=Decimal(str(monthly_collections)),
        pending_collections=Decimal(str(outstanding_amount)),
        upcoming_auctions=upcoming_auctions,
        pending_payouts=pending_payouts,
        outstanding_amount=Decimal(str(outstanding_amount)),
        recorded_commission=Decimal(str(recorded_commission)),
        active_members=active_members,
        inactive_members=inactive_members,
        total_enrolled_tickets=total_enrolled_tickets,
        total_active_schemes=active_chits,
        pending_verification_count=pending_verification_count,
        pending_verification_amount=pending_verification_amount,
        auctions_conducted=auctions_conducted,
        recent_transactions=recent_transactions,
        recent_registrations=recent_registrations,
        action_alerts=action_alerts,
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
