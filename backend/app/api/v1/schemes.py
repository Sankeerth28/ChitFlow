from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date
from decimal import Decimal

from app.db.session import get_db
from app.api.deps import (
    get_current_user,
    get_current_active_organiser,
    require_role,
)
from app.models.entities import User, Organiser, ChitScheme, SchemeMember, Member, Auction, Instalment, LedgerAccount
from app.schemas.scheme import (
    ChitSchemeCreate,
    ChitSchemeResponse,
    SchemeMemberEnroll,
    SchemeMemberResponse,
)
from app.core.calc_engine import ChitSchemeConfig, CalculationValidationError, StatutoryComplianceError

router = APIRouter(prefix="/schemes", tags=["Chit Schemes"])


@router.post("", response_model=ChitSchemeResponse, status_code=status.HTTP_201_CREATED)
def create_scheme(
    payload: ChitSchemeCreate,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["organiser"])),
):
    """Create a new chit scheme. Restricted strictly to Organisers."""
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

    existing = db.query(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id,
        ChitScheme.scheme_code == payload.scheme_code,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Scheme with code '{payload.scheme_code}' already exists under your organisation.",
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
    current_user: User = Depends(get_current_user),
):
    """
    List chit schemes.
    - If Organiser/Accountant: returns all schemes owned by their tenant.
    - If Member: returns ONLY schemes where the member is enrolled.
    """
    if current_user.role in ["super_admin", "organiser", "accountant"]:
        if current_user.role == "super_admin" and not current_user.organiser_id:
            return db.query(ChitScheme).all()
        return db.query(ChitScheme).filter(ChitScheme.organiser_id == current_user.organiser_id).all()

    # Member role: filter by enrollment
    if not current_user.member_profile:
        return []

    return db.query(ChitScheme).join(SchemeMember).filter(
        SchemeMember.member_id == current_user.member_profile.id
    ).all()


@router.get("/{scheme_id}", response_model=ChitSchemeResponse)
def get_scheme(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve single scheme with tenant isolation check."""
    scheme = db.query(ChitScheme).filter(ChitScheme.id == scheme_id).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")

    if current_user.role in ["super_admin", "organiser", "accountant"]:
        if current_user.role != "super_admin" and scheme.organiser_id != current_user.organiser_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    else:
        # Member role
        if not current_user.member_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
        enrolled = db.query(SchemeMember).filter(
            SchemeMember.scheme_id == scheme.id,
            SchemeMember.member_id == current_user.member_profile.id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Not enrolled in this scheme.")

    return scheme


@router.post("/{scheme_id}/members", response_model=SchemeMemberResponse, status_code=status.HTTP_201_CREATED)
def enroll_member(
    scheme_id: str,
    payload: SchemeMemberEnroll,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser", "accountant"])),
):
    """Enrol a member to a ticket. Scoped to caller's organiser."""
    scheme = db.query(ChitScheme).filter(
        ChitScheme.id == scheme_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found under your organisation.")

    if scheme.rules_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot enroll members: Scheme rules are locked and active.",
        )

    # Verify member belongs to same organiser
    member = db.query(Member).filter(
        Member.id == payload.member_id,
        Member.organiser_id == organiser.id,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in your organisation.")

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

    # Check duplicate member enrollment
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
    current_user: User = Depends(get_current_user),
):
    scheme = db.query(ChitScheme).filter(ChitScheme.id == scheme_id).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found.")

    if current_user.role in ["super_admin", "organiser", "accountant"]:
        if current_user.role != "super_admin" and scheme.organiser_id != current_user.organiser_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    else:
        # Member can view tickets list of scheme they belong to
        enrolled = db.query(SchemeMember).filter(
            SchemeMember.scheme_id == scheme.id,
            SchemeMember.member_id == current_user.member_profile.id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return db.query(SchemeMember).filter(SchemeMember.scheme_id == scheme.id).order_by(SchemeMember.chit_ticket_number).all()


@router.post("/{scheme_id}/activate", response_model=ChitSchemeResponse)
def activate_scheme(
    scheme_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["organiser"])),
):
    """
    Activate scheme and lock parameters permanently.
    - Pre-generates all N monthly auctions.
    - Automatically generates Month 1 subscription dues (Instalments) for all members (Fixes BUG-003).
    """
    scheme = db.query(ChitScheme).filter(
        ChitScheme.id == scheme_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found under your organisation.")

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

    # 1. Pre-generate auctions if not already created
    existing_auctions = db.query(Auction).filter(Auction.scheme_id == scheme.id).order_by(Auction.auction_number).all()
    if not existing_auctions:
        for m in range(1, scheme.duration_months + 1):
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
        db.flush()
        existing_auctions = db.query(Auction).filter(Auction.scheme_id == scheme.id).order_by(Auction.auction_number).all()

    # 2. Fix BUG-003: Generate Month 1 Instalment Dues for ALL members
    auction_1 = existing_auctions[0]
    all_members = db.query(SchemeMember).filter(SchemeMember.scheme_id == scheme.id).all()

    due_day = min(scheme.monthly_due_day, 28)
    m1_due_date = date(scheme.start_date.year, scheme.start_date.month, due_day)

    for sm in all_members:
        existing_inst = db.query(Instalment).filter(
            Instalment.scheme_member_id == sm.id,
            Instalment.instalment_number == 1,
        ).first()
        if not existing_inst:
            inst = Instalment(
                scheme_member_id=sm.id,
                auction_id=auction_1.id,
                instalment_number=1,
                due_date=m1_due_date,
                gross_subscription=scheme.monthly_subscription,
                dividend_credit=Decimal('0.00'),
                net_amount_due=scheme.monthly_subscription,
                amount_paid=Decimal('0.00'),
                status="pending",
            )
            db.add(inst)

    db.commit()
    db.refresh(scheme)
    return scheme
