from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta, date, datetime
from decimal import Decimal

from app.db.session import get_db
from app.api.deps import get_current_organiser
from app.models.entities import Organiser, ChitScheme, SchemeMember, Member, Auction, LedgerAccount
from app.schemas.scheme import (
    ChitSchemeCreate,
    ChitSchemeResponse,
    SchemeMemberEnroll,
    SchemeMemberResponse,
)
from app.core.calc_engine import ChitSchemeConfig, CalculationValidationError, StatutoryComplianceError
from app.core.ledger_engine import (
    COA_COLLECTION_POOL,
    COA_PRIZE_PAYABLE,
    COA_MEMBER_RECEIVABLE,
)

router = APIRouter(prefix="/schemes", tags=["Chit Schemes"])


@router.post("", response_model=ChitSchemeResponse, status_code=status.HTTP_201_CREATED)
def create_scheme(
    payload: ChitSchemeCreate,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    # Validate via Deterministic Calculation Engine
    try:
        ChitSchemeConfig(
            chit_value=payload.chit_value,
            duration_months=payload.duration_months,
            total_members=payload.total_members,
            monthly_subscription=payload.monthly_subscription,
            commission_percentage=payload.commission_percentage,
            max_discount_percentage=payload.max_discount_percentage,
        )
    except (CalculationValidationError, StatutoryComplianceError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Check for duplicate scheme code
    existing = db.query(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        ChitScheme.scheme_code == payload.scheme_code,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Scheme with code '{payload.scheme_code}' already exists.",
        )

    scheme = ChitScheme(
        organiser_id=organiser.id,
        scheme_code=payload.scheme_code,
        scheme_name=payload.scheme_name,
        chit_value=payload.chit_value,
        monthly_subscription=payload.monthly_subscription,
        duration_months=payload.duration_months,
        total_members=payload.total_members,
        commission_percentage=payload.commission_percentage,
        max_discount_percentage=payload.max_discount_percentage,
        start_date=payload.start_date,
        monthly_due_day=payload.monthly_due_day,
        auction_day=payload.auction_day,
        pso_number=payload.pso_number,
        fd_receipt_number=payload.fd_receipt_number,
        status="draft",
        rules_locked=False,
    )
    db.add(scheme)
    db.flush()

    # Create scheme-specific pool ledger account
    pool_acc = db.query(LedgerAccount).filter(
        LedgerAccount.organiser_id == organiser.id,
        LedgerAccount.account_code == f"2010-{scheme.scheme_code}",
    ).first()
    if not pool_acc:
        pool_acc = LedgerAccount(
            organiser_id=organiser.id,
            scheme_id=scheme.id,
            account_code=f"2010-{scheme.scheme_code}",
            account_name=f"Chit Collection Pool ({scheme.scheme_code})",
            account_type="liability",
        )
        db.add(pool_acc)

    db.commit()
    db.refresh(scheme)
    return scheme


@router.get("", response_model=List[ChitSchemeResponse])
def list_schemes(
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    return db.query(ChitScheme).filter(ChitScheme.organiser_id == organiser.id).all()


@router.get("/{scheme_id}", response_model=ChitSchemeResponse)
def get_scheme(
    scheme_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    scheme = db.query(ChitScheme).filter(
        ChitScheme.id == scheme_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")
    return scheme


@router.post("/{scheme_id}/members", response_model=SchemeMemberResponse, status_code=status.HTTP_201_CREATED)
def enroll_member(
    scheme_id: str,
    payload: SchemeMemberEnroll,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    scheme = db.query(ChitScheme).filter(
        ChitScheme.id == scheme_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")

    if scheme.rules_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot enroll members: Scheme rules are locked and active.",
        )

    # Verify member exists
    member = db.query(Member).filter(
        Member.id == payload.member_id,
        Member.organiser_id == organiser.id,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    # Check ticket range
    if payload.chit_ticket_number < 1 or payload.chit_ticket_number > scheme.total_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ticket number must be between 1 and {scheme.total_members}.",
        )

    # Check ticket uniqueness in scheme
    existing_ticket = db.query(SchemeMember).filter(
        SchemeMember.scheme_id == scheme.id,
        SchemeMember.chit_ticket_number == payload.chit_ticket_number,
    ).first()
    if existing_ticket:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ticket #{payload.chit_ticket_number} is already allocated in this scheme.",
        )

    # Check member duplicate enrollment in same scheme
    existing_member_enrollment = db.query(SchemeMember).filter(
        SchemeMember.scheme_id == scheme.id,
        SchemeMember.member_id == member.id,
    ).first()
    if existing_member_enrollment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Member is already enrolled in this scheme.",
        )

    enrollment = SchemeMember(
        scheme_id=scheme.id,
        member_id=member.id,
        chit_ticket_number=payload.chit_ticket_number,
        enrollment_date=payload.enrollment_date,
        has_prized=False,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.get("/{scheme_id}/members", response_model=List[SchemeMemberResponse])
def list_scheme_members(
    scheme_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    scheme = db.query(ChitScheme).filter(
        ChitScheme.id == scheme_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")

    return db.query(SchemeMember).filter(SchemeMember.scheme_id == scheme.id).order_by(SchemeMember.chit_ticket_number).all()


@router.post("/{scheme_id}/activate", response_model=ChitSchemeResponse)
def activate_scheme(
    scheme_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    """
    Activate scheme and generate scheduled auction dates for all N months.
    Locks scheme parameters permanently.
    """
    scheme = db.query(ChitScheme).filter(
        ChitScheme.id == scheme_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")

    if scheme.status == "active":
        return scheme

    # Verify all members are enrolled
    enrolled_count = db.query(SchemeMember).filter(SchemeMember.scheme_id == scheme.id).count()
    if enrolled_count < scheme.total_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate scheme: only {enrolled_count}/{scheme.total_members} tickets are enrolled.",
        )

    scheme.status = "active"
    scheme.rules_locked = True

    # Pre-generate auctions if not already created
    existing_auctions_count = db.query(Auction).filter(Auction.scheme_id == scheme.id).count()
    if existing_auctions_count == 0:
        for m in range(1, scheme.duration_months + 1):
            # Calculate approximate monthly auction date
            # month m scheduled date:
            start = scheme.start_date
            year = start.year + (start.month + m - 2) // 12
            month = (start.month + m - 2) % 12 + 1
            day = min(scheme.auction_day, 28)
            auction_date = datetime(year, month, day, 11, 0, 0)

            auction = Auction(
                scheme_id=scheme.id,
                auction_number=m,
                scheduled_datetime=auction_date,
                status="scheduled",
            )
            db.add(auction)

    db.commit()
    db.refresh(scheme)
    return scheme
