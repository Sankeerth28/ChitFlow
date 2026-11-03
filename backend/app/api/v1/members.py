import csv
import io
import re
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Union, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from app.db.session import get_db
from app.api.deps import (
    get_current_user,
    get_current_active_organiser,
    require_role,
    verify_member_access,
)
from app.models.entities import (
    User,
    Organiser,
    Member,
    ChitScheme,
    SchemeMember,
    Instalment,
    Payment,
    Auction,
    Payout,
)
from app.schemas.member import (
    MemberCreate,
    MemberUpdate,
    MemberStatusUpdate,
    MemberResponse,
    MemberPaginatedResponse,
    MemberFullProfile,
    EnrolledSchemeDetail,
    MemberPaymentReceipt,
    MemberDueDetail,
    MemberDashboardSummary,
    CsvImportResult,
    CsvImportRowError,
)
from app.core.security import hash_password

router = APIRouter(prefix="/members", tags=["Members"])


class CsvImportPayload(BaseModel):
    csv_content: str


def _prize_month(db: Session, scheme: ChitScheme, member_id: str, has_prized: bool) -> Optional[int]:
    """Month in which the member won the auction, if any."""
    if not has_prized:
        return None
    auction = (
        db.query(Auction)
        .filter(
            Auction.scheme_id == scheme.id,
            Auction.winning_member_id == member_id,
            Auction.status == "confirmed",
        )
        .order_by(Auction.auction_number)
        .first()
    )
    return auction.auction_number if auction else None


def _completed_months(scheme: ChitScheme) -> int:
    """Number of auctions already confirmed for the scheme."""
    return sum(1 for a in (scheme.auctions or []) if a.status == "confirmed")


def _map_member_to_response(m: Member) -> MemberResponse:
    active_schemes = 0
    if hasattr(m, "enrolled_schemes") and m.enrolled_schemes:
        active_schemes = sum(1 for sm in m.enrolled_schemes if sm.is_active)
    
    return MemberResponse(
        id=m.id,
        organiser_id=m.organiser_id,
        member_code=m.member_code,
        full_name=m.full_name,
        mobile_number=m.user.mobile_number if m.user else None,
        email=getattr(m, "email", None),
        address_line1=m.address_line1,
        city=m.city,
        state=m.state,
        pincode=m.pincode,
        emergency_contact=m.emergency_contact,
        kyc_status=m.kyc_status or "verified",
        status=getattr(m, "status", "active") or "active",
        created_at=m.created_at,
        updated_at=getattr(m, "updated_at", None),
        active_schemes_count=active_schemes,
    )


# ==============================================================================
# 1. MEMBER CRUD & LISTING
# ==============================================================================

@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser", "accountant"])),
):
    """Register a new member subscriber under the authenticated Organiser."""
    # Auto-generate member code if not provided
    member_code = payload.member_code
    if not member_code or not member_code.strip():
        count = db.query(Member).filter(Member.organiser_id == organiser.id).count()
        member_code = f"MEM-{count + 1:04d}"

    member_code = member_code.strip()

    existing_code = db.query(Member).filter(
        Member.organiser_id == organiser.id,
        Member.member_code == member_code,
    ).first()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Member with code '{member_code}' already exists under your organisation.",
        )

    # Check if user account with mobile exists
    user = db.query(User).filter(User.mobile_number == payload.mobile_number).first()
    if not user:
        user = User(
            organiser_id=organiser.id,
            mobile_number=payload.mobile_number,
            password_hash=hash_password(f"Member@{payload.mobile_number[-4:]}!"),
            role="member",
            is_verified=True,
            is_active=(payload.status != "inactive" and payload.status != "suspended"),
        )
        db.add(user)
        db.flush()

    member = Member(
        user_id=user.id,
        organiser_id=organiser.id,
        member_code=member_code,
        full_name=payload.full_name.strip(),
        email=payload.email.strip() if payload.email else None,
        address_line1=payload.address_line1.strip(),
        city=payload.city.strip() if payload.city else "Hyderabad",
        state=payload.state.strip() if payload.state else "Telangana",
        pincode=payload.pincode.strip() if payload.pincode else "500081",
        emergency_contact=payload.emergency_contact.strip() if payload.emergency_contact else None,
        kyc_status=payload.kyc_status or "verified",
        status=payload.status or "active",
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return _map_member_to_response(member)


@router.get("", response_model=Union[MemberPaginatedResponse, List[MemberResponse]])
def list_members(
    search: Optional[str] = Query(None, description="Search by name, member code, mobile, or email"),
    status: Optional[str] = Query(None, description="Filter by status: active, inactive, suspended"),
    kyc_status: Optional[str] = Query(None, description="Filter by KYC status: verified, pending, rejected"),
    sort_by: str = Query("created_at", description="Sort field: created_at, full_name, member_code"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser", "accountant"])),
):
    """
    List members belonging to the caller's organisation.
    Supports real-time search, multi-field filtering, sorting, and pagination.
    """
    query = db.query(Member).filter(Member.organiser_id == organiser.id)

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.outerjoin(User, Member.user_id == User.id).filter(
            or_(
                Member.full_name.ilike(term),
                Member.member_code.ilike(term),
                Member.email.ilike(term),
                User.mobile_number.ilike(term),
            )
        )

    # Status filter
    if status and status.strip():
        query = query.filter(Member.status == status.strip().lower())

    # KYC filter
    if kyc_status and kyc_status.strip():
        query = query.filter(Member.kyc_status == kyc_status.strip().lower())

    # Sorting
    sort_column = Member.created_at
    if sort_by == "full_name":
        sort_column = Member.full_name
    elif sort_by == "member_code":
        sort_column = Member.member_code

    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    total = query.count()

    # If page is not specified, return all for backwards compatibility
    if page is None:
        members = query.all()
        return [_map_member_to_response(m) for m in members]

    offset = (page - 1) * page_size
    members = query.offset(offset).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    return MemberPaginatedResponse(
        items=[_map_member_to_response(m) for m in members],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{member_id}", response_model=MemberResponse)
def get_member(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get member details with strict tenant/identity ownership verification."""
    member = verify_member_access(member_id=member_id, current_user=current_user, db=db)
    return _map_member_to_response(member)


@router.put("/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: str,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser"])),
):
    """Update subscriber details (Admin/Organiser only)."""
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.organiser_id == organiser.id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with ID '{member_id}' not found under your organisation.",
        )

    if payload.full_name is not None:
        member.full_name = payload.full_name.strip()
    if payload.email is not None:
        member.email = payload.email.strip() if payload.email else None
    if payload.address_line1 is not None:
        member.address_line1 = payload.address_line1.strip()
    if payload.city is not None:
        member.city = payload.city.strip()
    if payload.state is not None:
        member.state = payload.state.strip()
    if payload.pincode is not None:
        member.pincode = payload.pincode.strip()
    if payload.emergency_contact is not None:
        member.emergency_contact = payload.emergency_contact.strip() if payload.emergency_contact else None
    if payload.kyc_status is not None:
        member.kyc_status = payload.kyc_status.strip().lower()
    if payload.status is not None:
        new_status = payload.status.strip().lower()
        member.status = new_status
        if member.user:
            member.user.is_active = (new_status == "active")

    # Update linked User mobile if provided and changed
    if payload.mobile_number and member.user and member.user.mobile_number != payload.mobile_number:
        existing_user = db.query(User).filter(
            User.mobile_number == payload.mobile_number,
            User.id != member.user_id,
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Mobile number '{payload.mobile_number}' is already assigned to another user.",
            )
        member.user.mobile_number = payload.mobile_number

    member.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(member)
    return _map_member_to_response(member)


@router.patch("/{member_id}/status", response_model=MemberResponse)
def update_member_status(
    member_id: str,
    payload: MemberStatusUpdate,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser"])),
):
    """Activate, deactivate, or suspend a member account."""
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.organiser_id == organiser.id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with ID '{member_id}' not found under your organisation.",
        )

    new_status = payload.status.lower()
    member.status = new_status
    member.updated_at = datetime.utcnow()

    if member.user:
        member.user.is_active = (new_status == "active")

    db.commit()
    db.refresh(member)
    return _map_member_to_response(member)


# ==============================================================================
# 2. 360-DEGREE MEMBER PROFILE & FINANCIAL HISTORY
# ==============================================================================

@router.get("/{member_id}/profile", response_model=MemberFullProfile)
def get_member_full_profile(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    360-Degree Member Profile:
    Comprehensive personal, enrolment, payment history, and outstanding dues report.
    """
    member = verify_member_access(member_id=member_id, current_user=current_user, db=db)

    # 1. Enrolled schemes
    enrolled = member.enrolled_schemes or []
    enrolled_details: List[EnrolledSchemeDetail] = []
    total_paid = Decimal('0.00')
    total_dues = Decimal('0.00')
    total_dividends = Decimal('0.00')

    for sm in enrolled:
        scheme = sm.scheme
        insts = sm.instalments or []
        sch_paid = sum(i.amount_paid for i in insts)
        sch_div = sum(i.dividend_credit for i in insts)
        sch_dues = sum(i.net_amount_due - i.amount_paid for i in insts if i.status != "paid")

        total_paid += sch_paid
        total_dividends += sch_div
        total_dues += sch_dues

        enrolled_details.append(
            EnrolledSchemeDetail(
                scheme_member_id=sm.id,
                scheme_id=scheme.id,
                scheme_code=scheme.scheme_code,
                scheme_name=scheme.scheme_name,
                chit_value=scheme.chit_value,
                monthly_subscription=scheme.monthly_subscription,
                duration_months=scheme.duration_months,
                chit_ticket_number=sm.chit_ticket_number,
                enrollment_date=sm.enrollment_date,
                has_prized=sm.has_prized,
                prize_month=_prize_month(db, scheme, member.id, sm.has_prized),
                scheme_status=scheme.status,
                current_month=min(scheme.duration_months, _completed_months(scheme) + 1),
                total_paid=sch_paid,
                total_dividend=sch_div,
                outstanding_balance=sch_dues,
            )
        )

    # 2. Recent payments
    payments = (
        db.query(Payment)
        .filter(Payment.member_id == member.id)
        .order_by(desc(Payment.payment_date), desc(Payment.created_at))
        .limit(20)
        .all()
    )
    receipts: List[MemberPaymentReceipt] = []
    for p in payments:
        inst = p.instalment
        scheme_code = "UNKNOWN"
        scheme_name = "Chit Scheme"
        if inst and inst.scheme_member and inst.scheme_member.scheme:
            scheme_code = inst.scheme_member.scheme.scheme_code
            scheme_name = inst.scheme_member.scheme.scheme_name

        receipts.append(
            MemberPaymentReceipt(
                payment_id=p.id,
                receipt_number=p.receipt_number,
                payment_date=p.payment_date,
                amount_received=p.amount_received,
                payment_method=p.payment_method,
                payment_reference_no=p.payment_reference_no,
                status=p.status,
                scheme_code=scheme_code,
                scheme_name=scheme_name,
                instalment_number=inst.instalment_number if inst else 1,
                gross_subscription=inst.gross_subscription if inst else Decimal('0.00'),
                dividend_credit=inst.dividend_credit if inst else Decimal('0.00'),
            )
        )

    # 3. Outstanding dues
    sm_ids = [sm.id for sm in enrolled]
    dues: List[MemberDueDetail] = []
    if sm_ids:
        unpaid_insts = (
            db.query(Instalment)
            .filter(
                Instalment.scheme_member_id.in_(sm_ids),
                Instalment.status != "paid",
            )
            .order_by(asc(Instalment.due_date))
            .all()
        )
        for ui in unpaid_insts:
            sch = ui.scheme_member.scheme if ui.scheme_member else None
            balance_due = ui.net_amount_due - ui.amount_paid
            dues.append(
                MemberDueDetail(
                    instalment_id=ui.id,
                    scheme_id=sch.id if sch else "",
                    scheme_code=sch.scheme_code if sch else "CHIT",
                    scheme_name=sch.scheme_name if sch else "Chit Scheme",
                    instalment_number=ui.instalment_number,
                    due_date=ui.due_date,
                    gross_subscription=ui.gross_subscription,
                    dividend_credit=ui.dividend_credit,
                    net_amount_due=ui.net_amount_due,
                    dividend_amount=ui.dividend_credit,
                    net_due=balance_due,
                    amount_paid=ui.amount_paid,
                    balance_due=balance_due,
                    status=ui.status,
                )
            )

    return MemberFullProfile(
        member=_map_member_to_response(member),
        enrolled_schemes=enrolled_details,
        recent_payments=receipts,
        outstanding_dues=dues,
        total_enrolled=len(enrolled),
        total_paid=total_paid,
        total_dues=total_dues,
        total_dividends=total_dividends,
    )


# ==============================================================================
# 3. DEDICATED MEMBER PORTAL ENDPOINTS
# ==============================================================================

@router.get("/{member_id}/enrolled-chits", response_model=List[EnrolledSchemeDetail])
def get_member_enrolled_chits(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dedicated endpoint for the 'My Enrolled Chits' member tab.
    Strictly scoped to the authenticated member.
    """
    member = verify_member_access(member_id=member_id, current_user=current_user, db=db)
    enrolled = member.enrolled_schemes or []
    results = []

    for sm in enrolled:
        scheme = sm.scheme
        insts = sm.instalments or []
        sch_paid = sum(i.amount_paid for i in insts)
        sch_div = sum(i.dividend_credit for i in insts)
        sch_dues = sum(i.net_amount_due - i.amount_paid for i in insts if i.status != "paid")

        results.append(
            EnrolledSchemeDetail(
                scheme_member_id=sm.id,
                scheme_id=scheme.id,
                scheme_code=scheme.scheme_code,
                scheme_name=scheme.scheme_name,
                chit_value=scheme.chit_value,
                monthly_subscription=scheme.monthly_subscription,
                duration_months=scheme.duration_months,
                chit_ticket_number=sm.chit_ticket_number,
                enrollment_date=sm.enrollment_date,
                has_prized=sm.has_prized,
                prize_month=_prize_month(db, scheme, member.id, sm.has_prized),
                scheme_status=scheme.status,
                current_month=min(scheme.duration_months, _completed_months(scheme) + 1),
                total_paid=sch_paid,
                total_dividend=sch_div,
                outstanding_balance=sch_dues,
            )
        )

    return results


@router.get("/{member_id}/receipts", response_model=List[MemberPaymentReceipt])
def get_member_receipts(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dedicated endpoint for the 'My Receipts & Dues' member tab.
    Fetches real payment receipts and financial vouchers for this member.
    """
    member = verify_member_access(member_id=member_id, current_user=current_user, db=db)

    payments = (
        db.query(Payment)
        .filter(Payment.member_id == member.id)
        .order_by(desc(Payment.payment_date), desc(Payment.created_at))
        .all()
    )

    results = []
    for p in payments:
        inst = p.instalment
        scheme_code = "UNKNOWN"
        scheme_name = "Chit Scheme"
        if inst and inst.scheme_member and inst.scheme_member.scheme:
            scheme_code = inst.scheme_member.scheme.scheme_code
            scheme_name = inst.scheme_member.scheme.scheme_name

        results.append(
            MemberPaymentReceipt(
                payment_id=p.id,
                receipt_number=p.receipt_number,
                payment_date=p.payment_date,
                amount_received=p.amount_received,
                payment_method=p.payment_method,
                payment_reference_no=p.payment_reference_no,
                status=p.status,
                scheme_code=scheme_code,
                scheme_name=scheme_name,
                instalment_number=inst.instalment_number if inst else 1,
                gross_subscription=inst.gross_subscription if inst else Decimal('0.00'),
                dividend_credit=inst.dividend_credit if inst else Decimal('0.00'),
            )
        )

    return results


@router.get("/{member_id}/dues", response_model=List[MemberDueDetail])
def get_member_dues(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dedicated endpoint for the 'My Receipts & Dues' member tab.
    Fetches pending/outstanding instalment dues for this member.
    """
    member = verify_member_access(member_id=member_id, current_user=current_user, db=db)

    enrolled = member.enrolled_schemes or []
    sm_ids = [sm.id for sm in enrolled]
    results = []

    if sm_ids:
        unpaid_insts = (
            db.query(Instalment)
            .filter(
                Instalment.scheme_member_id.in_(sm_ids),
                Instalment.status != "paid",
            )
            .order_by(asc(Instalment.due_date))
            .all()
        )
        for ui in unpaid_insts:
            sch = ui.scheme_member.scheme if ui.scheme_member else None
            balance_due = ui.net_amount_due - ui.amount_paid
            results.append(
                MemberDueDetail(
                    instalment_id=ui.id,
                    scheme_id=sch.id if sch else "",
                    scheme_code=sch.scheme_code if sch else "CHIT",
                    scheme_name=sch.scheme_name if sch else "Chit Scheme",
                    instalment_number=ui.instalment_number,
                    due_date=ui.due_date,
                    gross_subscription=ui.gross_subscription,
                    dividend_credit=ui.dividend_credit,
                    net_amount_due=ui.net_amount_due,
                    dividend_amount=ui.dividend_credit,
                    net_due=balance_due,
                    amount_paid=ui.amount_paid,
                    balance_due=balance_due,
                    status=ui.status,
                )
            )

    return results


@router.get("/{member_id}/dashboard", response_model=MemberDashboardSummary)
def get_member_10_second_dashboard(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PRD Module 2: The Member 10-Second Dashboard.
    Enforces zero-trust isolation: Member can ONLY query their own dashboard!
    """
    member = verify_member_access(member_id=member_id, current_user=current_user, db=db)

    enrolled = member.enrolled_schemes or []
    active_chits = len([sm for sm in enrolled if sm.is_active])
    has_prized_any = any(sm.has_prized for sm in enrolled)

    scheme_member_ids = [sm.id for sm in enrolled]
    instalments = (
        db.query(Instalment).filter(
            Instalment.scheme_member_id.in_(scheme_member_ids)
        ).all()
        if scheme_member_ids
        else []
    )

    pending_insts = [inst for inst in instalments if inst.status != "paid"]
    total_paid = sum(inst.amount_paid for inst in instalments) if instalments else Decimal('0.00')
    total_dividends = sum(inst.dividend_credit for inst in instalments) if instalments else Decimal('0.00')

    next_due_date = None
    next_due_amount = Decimal('0.00')

    if pending_insts:
        pending_insts.sort(key=lambda x: x.due_date)
        next_due_date = pending_insts[0].due_date
        next_due_amount = pending_insts[0].net_amount_due - pending_insts[0].amount_paid

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


# ==============================================================================
# 4. BULK CSV IMPORT
# ==============================================================================

@router.post("/import-csv", response_model=CsvImportResult)
def import_members_csv(
    payload: CsvImportPayload,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_active_organiser),
    current_user: User = Depends(require_role(["super_admin", "organiser"])),
):
    """
    Bulk import member subscribers from CSV with validation and duplicate detection.
    Expected CSV columns:
    full_name, mobile_number, email, address_line1, city, state, pincode, emergency_contact, member_code
    """
    if not payload.csv_content or not payload.csv_content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV content is empty.",
        )

    f = io.StringIO(payload.csv_content.strip())
    reader = csv.DictReader(f)

    # Normalize header names (lowercase, stripped)
    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV has no valid headers. Required headers: full_name, mobile_number, address_line1",
        )

    imported_count = 0
    skipped_count = 0
    errors: List[CsvImportRowError] = []

    mobile_regex = re.compile(r"^[6-9]\d{9}$")
    pincode_regex = re.compile(r"^\d{6}$")

    existing_members = db.query(Member).filter(Member.organiser_id == organiser.id).all()
    existing_codes = {m.member_code.lower() for m in existing_members}
    existing_mobiles = {m.user.mobile_number for m in existing_members if m.user}

    seen_batch_codes = set()
    seen_batch_mobiles = set()

    row_index = 1
    for raw_row in reader:
        row_index += 1
        row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}

        full_name = row.get("full_name") or row.get("name")
        mobile = row.get("mobile_number") or row.get("mobile") or row.get("phone")
        email = row.get("email")
        address = row.get("address_line1") or row.get("address") or "Hyderabad"
        city = row.get("city") or "Hyderabad"
        state = row.get("state") or "Telangana"
        pincode = row.get("pincode") or "500081"
        emergency_contact = row.get("emergency_contact") or row.get("emergency")
        member_code = row.get("member_code") or row.get("code")

        # 1. Validation: Name
        if not full_name or len(full_name) < 2:
            errors.append(CsvImportRowError(row=row_index, error="Invalid or missing full_name (min 2 chars).", raw_data=raw_row))
            skipped_count += 1
            continue

        # 2. Validation: Mobile
        if not mobile or not mobile_regex.match(mobile):
            errors.append(CsvImportRowError(row=row_index, error=f"Invalid mobile '{mobile}'. Must be 10 digits starting with 6-9.", raw_data=raw_row))
            skipped_count += 1
            continue

        # 3. Validation: Pincode
        if pincode and not pincode_regex.match(pincode):
            pincode = "500081"

        # 4. Duplicate Check: Mobile in batch or in DB
        if mobile in existing_mobiles or mobile in seen_batch_mobiles:
            errors.append(CsvImportRowError(row=row_index, error=f"Mobile '{mobile}' is already registered.", raw_data=raw_row))
            skipped_count += 1
            continue

        # 5. Member code assignment & duplicate check
        if not member_code:
            count = len(existing_codes) + len(seen_batch_codes) + 1
            member_code = f"MEM-{count:04d}"

        if member_code.lower() in existing_codes or member_code.lower() in seen_batch_codes:
            errors.append(CsvImportRowError(row=row_index, error=f"Member code '{member_code}' already exists.", raw_data=raw_row))
            skipped_count += 1
            continue

        seen_batch_codes.add(member_code.lower())
        seen_batch_mobiles.add(mobile)

        # Create user account
        user = db.query(User).filter(User.mobile_number == mobile).first()
        if not user:
            user = User(
                organiser_id=organiser.id,
                mobile_number=mobile,
                password_hash=hash_password(f"Member@{mobile[-4:]}!"),
                role="member",
                is_verified=True,
                is_active=True,
            )
            db.add(user)
            db.flush()

        member = Member(
            user_id=user.id,
            organiser_id=organiser.id,
            member_code=member_code,
            full_name=full_name,
            email=email if email else None,
            address_line1=address,
            city=city,
            state=state,
            pincode=pincode,
            emergency_contact=emergency_contact if emergency_contact else None,
            kyc_status="verified",
            status="active",
        )
        db.add(member)
        imported_count += 1

    if imported_count > 0:
        db.commit()

    return CsvImportResult(
        imported_count=imported_count,
        skipped_count=skipped_count,
        errors=errors,
    )
