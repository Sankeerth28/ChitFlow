from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date
from decimal import Decimal

from app.db.session import get_db
from app.api.deps import get_current_organiser
from app.models.entities import (
    Organiser,
    ChitScheme,
    SchemeMember,
    Auction,
    AuctionBid,
    Payout,
    Instalment,
    Member,
    JournalEntryRecord,
    JournalEntryLineRecord,
    LedgerAccount,
)
from app.schemas.auction import (
    AuctionResponse,
    AuctionBidCreate,
    AuctionBidResponse,
    AuctionConfirmRequest,
    AuctionCalculationResponse,
)
from app.core.calc_engine import (
    ChitSchemeConfig,
    calculate_auction,
    generate_auction_journal_entry,
    CalculationValidationError,
    StatutoryComplianceError,
)

router = APIRouter(prefix="/auctions", tags=["Auctions"])


@router.get("/schemes/{scheme_id}", response_model=List[AuctionResponse])
def list_scheme_auctions(
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

    return db.query(Auction).filter(Auction.scheme_id == scheme.id).order_by(Auction.auction_number).all()


@router.get("/{auction_id}", response_model=AuctionResponse)
def get_auction(
    auction_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    auction = db.query(Auction).join(ChitScheme).filter(
        Auction.id == auction_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not auction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")
    return auction


@router.get("/{auction_id}/bids", response_model=List[AuctionBidResponse])
def list_auction_bids(
    auction_id: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    auction = db.query(Auction).join(ChitScheme).filter(
        Auction.id == auction_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not auction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")

    return db.query(AuctionBid).filter(AuctionBid.auction_id == auction.id).order_by(AuctionBid.bid_discount_amount.desc()).all()


@router.post("/{auction_id}/bids", response_model=AuctionBidResponse, status_code=status.HTTP_201_CREATED)
def submit_auction_bid(
    auction_id: str,
    payload: AuctionBidCreate,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    auction = db.query(Auction).join(ChitScheme).filter(
        Auction.id == auction_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not auction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")

    scheme = auction.scheme

    # Section 15 check: Month 1 is reserved for Foreman
    if auction.auction_number == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section 15 violation: Auction #1 is reserved for the foreman without auction bidding.",
        )

    if auction.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auction is already confirmed. Bidding is closed.",
        )

    # Check member enrollment
    enrollment = db.query(SchemeMember).filter(
        SchemeMember.scheme_id == scheme.id,
        SchemeMember.member_id == payload.member_id,
    ).first()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member is not enrolled in this chit scheme.",
        )

    # Check if member has already prized
    if enrollment.has_prized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member has already won a prior auction in this scheme and cannot bid again.",
        )

    # Check discount cap (max 30% of chit value)
    max_discount = scheme.chit_value * (scheme.max_discount_percentage / Decimal('100.00'))
    if payload.bid_discount_amount > max_discount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bid discount (₹{payload.bid_discount_amount:,.2f}) exceeds the statutory 30% cap (₹{max_discount:,.2f}).",
        )

    bid = AuctionBid(
        auction_id=auction.id,
        member_id=payload.member_id,
        bid_discount_amount=payload.bid_discount_amount,
        bid_source=payload.bid_source,
    )
    db.add(bid)
    db.commit()
    db.refresh(bid)
    return bid


@router.post("/{auction_id}/confirm", response_model=AuctionCalculationResponse)
def confirm_auction(
    auction_id: str,
    payload: AuctionConfirmRequest,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    auction = db.query(Auction).join(ChitScheme).filter(
        Auction.id == auction_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not auction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")

    if auction.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auction is already confirmed and locked.",
        )

    scheme = auction.scheme

    # Ensure eligible member
    winning_member = db.query(Member).filter(
        Member.id == payload.winning_member_id,
        Member.organiser_id == organiser.id,
    ).first()
    if not winning_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Winning member not found.")

    scheme_member = db.query(SchemeMember).filter(
        SchemeMember.scheme_id == scheme.id,
        SchemeMember.member_id == winning_member.id,
    ).first()
    if not scheme_member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Winning member is not enrolled in scheme.")

    if scheme_member.has_prized and auction.auction_number > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Winning member has already prized in an earlier auction.",
        )

    # Initialize calculation engine config
    config = ChitSchemeConfig(
        chit_value=Decimal(str(scheme.chit_value)),
        duration_months=scheme.duration_months,
        total_members=scheme.total_members,
        monthly_subscription=Decimal(str(scheme.monthly_subscription)),
        commission_percentage=Decimal(str(scheme.commission_percentage)),
        max_discount_percentage=Decimal(str(scheme.max_discount_percentage)),
    )

    try:
        calc_result = calculate_auction(
            scheme=config,
            auction_number=auction.auction_number,
            winning_bid_discount=Decimal(str(payload.winning_bid_discount)),
            custom_commission=payload.custom_commission,
        )
    except (CalculationValidationError, StatutoryComplianceError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Update Auction Record
    auction.status = "confirmed"
    auction.actual_datetime = datetime.utcnow()
    auction.winning_member_id = winning_member.id
    auction.winning_bid_discount = calc_result.winning_bid_discount
    auction.winning_payout = calc_result.winning_payout
    auction.foreman_commission = calc_result.foreman_commission
    auction.dividend_pool = calc_result.member_dividend_pool
    auction.dividend_per_member = calc_result.dividend_per_member
    auction.rounding_residual = calc_result.rounding_residual
    auction.minutes_of_auction = payload.custom_minutes_note or f"Auction #{auction.auction_number} confirmed."

    # Mark member as prized
    scheme_member.has_prized = True
    scheme_member.prized_auction_id = auction.id

    # Create Payout Record
    payout = Payout(
        auction_id=auction.id,
        member_id=winning_member.id,
        gross_prize_amount=calc_result.winning_payout,
        deductions_amount=Decimal('0.00'),
        net_payout_amount=calc_result.winning_payout,
        status="awaiting_security" if not calc_result.is_foreman_entitlement_auction else "approved",
    )
    db.add(payout)
    db.flush()

    # Generate Double-Entry General Ledger Journal Entry
    je_data = generate_auction_journal_entry(
        scheme_code=scheme.scheme_code,
        result=calc_result,
        winning_member_code=winning_member.member_code,
    )

    # Save Journal Entry in Database
    je_record = JournalEntryRecord(
        organiser_id=organiser.id,
        entry_number=f"JE-AUC-{scheme.scheme_code}-{auction.auction_number:02d}",
        transaction_date=date.today(),
        description=je_data.description,
        reference_entity_type="auction",
        reference_entity_id=auction.id,
        is_reversal=False,
    )
    db.add(je_record)
    db.flush()

    # Map Lines to Database Accounts
    for line in je_data.lines:
        account = db.query(LedgerAccount).filter(
            LedgerAccount.organiser_id == organiser.id,
            LedgerAccount.account_code == line.account_code,
        ).first()

        if not account:
            # Auto-create standard COA account if missing
            acc_type = "expense" if line.account_code.startswith("5") else (
                "revenue" if line.account_code.startswith("4") else (
                    "liability" if line.account_code.startswith("2") else "asset"
                )
            )
            account = LedgerAccount(
                organiser_id=organiser.id,
                scheme_id=scheme.id,
                account_code=line.account_code,
                account_name=line.account_name,
                account_type=acc_type,
            )
            db.add(account)
            db.flush()

        line_record = JournalEntryLineRecord(
            journal_entry_id=je_record.id,
            account_id=account.id,
            debit_amount=line.debit_amount,
            credit_amount=line.credit_amount,
            memo=line.memo,
        )
        db.add(line_record)

    # Generate Member Instalment Dues for Next Month (if not last auction)
    next_m = auction.auction_number + 1
    if next_m <= scheme.duration_months:
        all_scheme_members = db.query(SchemeMember).filter(SchemeMember.scheme_id == scheme.id).all()
        # Compute due date
        start = scheme.start_date
        year = start.year + (start.month + next_m - 2) // 12
        month = (start.month + next_m - 2) % 12 + 1
        day = min(scheme.monthly_due_day, 28)
        due_date = date(year, month, day)

        for sm in all_scheme_members:
            # Check if instalment already exists
            existing_inst = db.query(Instalment).filter(
                Instalment.scheme_member_id == sm.id,
                Instalment.instalment_number == next_m,
            ).first()
            if not existing_inst:
                inst = Instalment(
                    scheme_member_id=sm.id,
                    auction_id=auction.id,
                    instalment_number=next_m,
                    due_date=due_date,
                    gross_subscription=scheme.monthly_subscription,
                    dividend_credit=calc_result.dividend_per_member,
                    net_amount_due=calc_result.net_monthly_contribution,
                    amount_paid=Decimal('0.00'),
                    status="pending",
                )
                db.add(inst)

    db.commit()
    db.refresh(auction)

    return AuctionCalculationResponse(
        auction_id=auction.id,
        auction_number=auction.auction_number,
        scheme_id=scheme.id,
        chit_value=calc_result.chit_value,
        is_foreman_entitlement=calc_result.is_foreman_entitlement_auction,
        winning_payout=calc_result.winning_payout,
        auction_discount=calc_result.winning_bid_discount,
        foreman_commission=calc_result.foreman_commission,
        member_dividend_pool=calc_result.member_dividend_pool,
        eligible_members_count=calc_result.eligible_members_count,
        dividend_per_member=calc_result.dividend_per_member,
        net_monthly_contribution=calc_result.net_monthly_contribution,
        rounding_residual=calc_result.rounding_residual,
        discount_percentage=calc_result.discount_percentage,
        journal_entry_id=je_record.id,
        payout_record_id=payout.id,
    )
