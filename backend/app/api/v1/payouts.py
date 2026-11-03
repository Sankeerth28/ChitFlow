from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from decimal import Decimal

from app.db.session import get_db
from app.api.deps import get_current_organiser
from app.models.entities import (
    Organiser,
    Payout,
    Auction,
    ChitScheme,
    Member,
    LedgerAccount,
    JournalEntryRecord,
    JournalEntryLineRecord,
)
from app.schemas.payout import (
    PayoutResponse,
    PayoutSecurityVerifyRequest,
    PayoutDisburseRequest,
)
from app.core.ledger_engine import LedgerEngine, PaymentMethod

router = APIRouter(prefix="/payouts", tags=["Prize Payouts"])


@router.get("", response_model=List[PayoutResponse])
def list_payouts(
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    payouts = db.query(Payout).join(Auction).join(ChitScheme).filter(
        ChitScheme.organiser_id == organiser.id
    ).order_by(Payout.created_at.desc()).all()

    results = []
    for p in payouts:
        m = db.query(Member).filter(Member.id == p.member_id).first()
        results.append(
            PayoutResponse(
                id=p.id,
                auction_id=p.auction_id,
                member_id=p.member_id,
                member_name=m.full_name if m else "Unknown",
                member_code=m.member_code if m else "UNKNOWN",
                gross_prize_amount=p.gross_prize_amount,
                deductions_amount=p.deductions_amount,
                net_payout_amount=p.net_payout_amount,
                status=p.status,
                security_type=p.security_type,
                disbursement_date=p.disbursement_date,
                disbursement_method=p.disbursement_method,
                transaction_reference=p.transaction_reference,
                created_at=p.created_at,
            )
        )
    return results


@router.post("/{payout_id}/verify-security", response_model=PayoutResponse)
def verify_payout_security(
    payout_id: str,
    payload: PayoutSecurityVerifyRequest,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    payout = db.query(Payout).join(Auction).join(ChitScheme).filter(
        Payout.id == payout_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not payout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout record not found.")

    payout.security_type = payload.security_type
    payout.security_doc_url = payload.security_doc_url
    payout.status = "security_verified"
    db.commit()
    db.refresh(payout)

    m = db.query(Member).filter(Member.id == payout.member_id).first()
    return PayoutResponse(
        id=payout.id,
        auction_id=payout.auction_id,
        member_id=payout.member_id,
        member_name=m.full_name if m else "",
        member_code=m.member_code if m else "",
        gross_prize_amount=payout.gross_prize_amount,
        deductions_amount=payout.deductions_amount,
        net_payout_amount=payout.net_payout_amount,
        status=payout.status,
        security_type=payout.security_type,
        disbursement_date=payout.disbursement_date,
        disbursement_method=payout.disbursement_method,
        transaction_reference=payout.transaction_reference,
        created_at=payout.created_at,
    )


@router.post("/{payout_id}/disburse", response_model=PayoutResponse)
def disburse_payout(
    payout_id: str,
    payload: PayoutDisburseRequest,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    payout = db.query(Payout).join(Auction).join(ChitScheme).filter(
        Payout.id == payout_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not payout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout record not found.")

    if payout.status not in ["security_verified", "approved"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot disburse: Payout status is '{payout.status}'. Section 31 security must be verified first.",
        )

    auction = payout.auction
    scheme = auction.scheme
    m = db.query(Member).filter(Member.id == payout.member_id).first()

    payout.deductions_amount = payload.deductions_amount
    payout.net_payout_amount = payout.gross_prize_amount - payload.deductions_amount
    payout.disbursement_date = payload.disbursement_date
    payout.disbursement_method = payload.disbursement_method
    payout.transaction_reference = payload.transaction_reference
    payout.status = "paid"

    # Generate Double-Entry Event 4 Journal Entry
    je = LedgerEngine.create_payout_disbursed_entry(
        entry_number=f"JE-PO-{payout.id[:8].upper()}",
        payout_id=payout.id,
        scheme_code=scheme.scheme_code,
        member_id=m.id,
        member_code=m.member_code,
        net_payout_amount=payout.net_payout_amount,
        deductions_amount=payout.deductions_amount,
        payment_method=PaymentMethod.BANK_TRANSFER,
        transaction_date=payout.disbursement_date,
    )

    je_record = JournalEntryRecord(
        organiser_id=organiser.id,
        entry_number=je.entry_number,
        transaction_date=je.transaction_date,
        description=je.description,
        reference_entity_type="payout",
        reference_entity_id=payout.id,
        is_reversal=False,
    )
    db.add(je_record)
    db.flush()

    for line in je.lines:
        acc = db.query(LedgerAccount).filter(
            LedgerAccount.organiser_id == organiser.id,
            LedgerAccount.account_code == line.account_code,
        ).first()
        if not acc:
            acc_type = "expense" if line.account_code.startswith("5") else (
                "revenue" if line.account_code.startswith("4") else (
                    "liability" if line.account_code.startswith("2") else "asset"
                )
            )
            acc = LedgerAccount(
                organiser_id=organiser.id,
                scheme_id=scheme.id,
                account_code=line.account_code,
                account_name=line.account_name,
                account_type=acc_type,
            )
            db.add(acc)
            db.flush()

        line_rec = JournalEntryLineRecord(
            journal_entry_id=je_record.id,
            account_id=acc.id,
            debit_amount=line.debit_amount,
            credit_amount=line.credit_amount,
            memo=line.memo,
        )
        db.add(line_rec)

    db.commit()
    db.refresh(payout)

    return PayoutResponse(
        id=payout.id,
        auction_id=payout.auction_id,
        member_id=payout.member_id,
        member_name=m.full_name if m else "",
        member_code=m.member_code if m else "",
        gross_prize_amount=payout.gross_prize_amount,
        deductions_amount=payout.deductions_amount,
        net_payout_amount=payout.net_payout_amount,
        status=payout.status,
        security_type=payout.security_type,
        disbursement_date=payout.disbursement_date,
        disbursement_method=payout.disbursement_method,
        transaction_reference=payout.transaction_reference,
        created_at=payout.created_at,
    )
