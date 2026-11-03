from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from decimal import Decimal

from app.db.session import get_db
from app.api.deps import get_current_organiser
from app.models.entities import Organiser, Member, SchemeMember, Instalment, Payment
from app.schemas.member import MemberCreate, MemberResponse, MemberDashboardSummary

router = APIRouter(prefix="/members", tags=["Members"])


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    existing = db.query(Member).filter(
        Member.organiser_id == organiser.id,
        Member.member_code == payload.member_code,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Member with code '{payload.member_code}' already exists.",
        )

    member = Member(
        organiser_id=organiser.id,
        member_code=payload.member_code,
        full_name=payload.full_name,
        address_line1=payload.address_line1,
        city=payload.city,
        state=payload.state,
        pincode=payload.pincode,
        emergency_contact=payload.emergency_contact,
        kyc_status="verified",
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return MemberResponse(
        id=member.id,
        organiser_id=member.organiser_id,
        member_code=member.member_code,
        full_name=member.full_name,
        mobile_number=payload.mobile_number,
        address_line1=member.address_line1,
        city=member.city,
        state=member.state,
        pincode=member.pincode,
        emergency_contact=member.emergency_contact,
        kyc_status=member.kyc_status,
        created_at=member.created_at,
    )


@router.get("", response_model=List[MemberResponse])
def list_members(
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    members = db.query(Member).filter(Member.organiser_id == organiser.id).order_by(Member.member_code).all()
    results = []
    for m in members:
        results.append(
            MemberResponse(
                id=m.id,
                organiser_id=m.organiser_id,
                member_code=m.member_code,
                full_name=m.full_name,
                address_line1=m.address_line1,
                city=m.city,
                state=m.state,
                pincode=m.pincode,
                emergency_contact=m.emergency_contact,
                kyc_status=m.kyc_status,
                created_at=m.created_at,
            )
        )
    return results


@router.get("/{member_id}", response_model=MemberResponse)
def get_member(
    member_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.organiser_id == organiser.id,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    return MemberResponse(
        id=member.id,
        organiser_id=member.organiser_id,
        member_code=member.member_code,
        full_name=member.full_name,
        address_line1=member.address_line1,
        city=member.city,
        state=member.state,
        pincode=member.pincode,
        emergency_contact=member.emergency_contact,
        kyc_status=member.kyc_status,
        created_at=member.created_at,
    )


@router.get("/{member_id}/dashboard", response_model=MemberDashboardSummary)
def get_member_10_second_dashboard(
    member_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    """
    PRD Module 2: The Member 10-Second Dashboard.
    Immediately answers:
    - Active Chits count
    - Monthly Payment Due
    - Total Amount Paid
    - Total Dividends Received
    - Pending Instalments
    - Next Payment Date
    - Prized Status
    """
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.organiser_id == organiser.id,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    enrolled = member.enrolled_schemes
    active_chits = len([sm for sm in enrolled if sm.is_active])
    has_prized_any = any(sm.has_prized for sm in enrolled)

    scheme_member_ids = [sm.id for sm in enrolled]
    instalments = db.query(Instalment).filter(
        Instalment.scheme_member_id.in_(scheme_member_ids)
    ).all() if scheme_member_ids else []

    pending_insts = [inst for inst in instalments if inst.status != "paid"]
    total_paid = sum(inst.amount_paid for inst in instalments) if instalments else Decimal('0.00')
    total_dividends = sum(inst.dividend_credit for inst in instalments) if instalments else Decimal('0.00')

    next_due_date = None
    next_due_amount = Decimal('0.00')

    if pending_insts:
        # Sort by due date
        pending_insts.sort(key=lambda x: x.due_date)
        next_due_date = pending_insts[0].due_date
        next_due_amount = pending_insts[0].net_amount_due

    return MemberDashboardSummary(
        member_id=member.id,
        member_name=member.full_name,
        member_code=member.member_code,
        active_chits_count=active_chits,
        monthly_due_amount=next_due_amount,
        total_amount_paid=total_paid,
        total_dividends_received=total_dividends,
        pending_instalments_count=len(pending_insts),
        next_payment_date=next_due_date,
        next_due_amount=next_due_amount,
        has_prized_any=has_prized_any,
    )
