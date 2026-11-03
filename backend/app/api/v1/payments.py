from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime
from decimal import Decimal
import uuid

from app.db.session import get_db
from app.api.deps import get_current_organiser
from app.models.entities import (
    Organiser,
    Instalment,
    Payment,
    Member,
    SchemeMember,
    ChitScheme,
    LedgerAccount,
    JournalEntryRecord,
    JournalEntryLineRecord,
)
from app.schemas.payment import (
    PaymentSubmit,
    PaymentVerifyRequest,
    PaymentReceiptResponse,
    InstalmentResponse,
)
from app.core.ledger_engine import LedgerEngine, PaymentMethod

router = APIRouter(prefix="/payments", tags=["Payments & Receipts"])


@router.get("/instalments/member/{member_id}", response_model=List[InstalmentResponse])
def list_member_instalments(
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

    scheme_member_ids = [sm.id for sm in member.enrolled_schemes]
    if not scheme_member_ids:
        return []

    return db.query(Instalment).filter(
        Instalment.scheme_member_id.in_(scheme_member_ids)
    ).order_by(Instalment.due_date).all()


@router.post("/submit", response_model=PaymentReceiptResponse, status_code=status.HTTP_201_CREATED)
def submit_payment(
    payload: PaymentSubmit,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    instalment = db.query(Instalment).filter(Instalment.id == payload.instalment_id).first()
    if not instalment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalment record not found.")

    scheme_member = instalment.scheme_member
    scheme = scheme_member.scheme
    member = scheme_member.member

    if scheme.organiser_id != organiser.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    receipt_no = f"RCP-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    payment = Payment(
        instalment_id=instalment.id,
        member_id=member.id,
        receipt_number=receipt_no,
        amount_received=payload.amount_received,
        payment_method=payload.payment_method.value,
        payment_reference_no=payload.payment_reference_no,
        payment_date=payload.payment_date,
        proof_document_url=payload.proof_document_url,
        status="submitted",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return PaymentReceiptResponse(
        receipt_number=payment.receipt_number,
        scheme_name=scheme.scheme_name,
        scheme_code=scheme.scheme_code,
        instalment_number=instalment.instalment_number,
        member_name=member.full_name,
        member_code=member.member_code,
        gross_subscription=instalment.gross_subscription,
        dividend_credit=instalment.dividend_credit,
        net_amount_due=instalment.net_amount_due,
        amount_received=payment.amount_received,
        payment_method=payment.payment_method,
        payment_reference_no=payment.payment_reference_no,
        payment_date=payment.payment_date,
        verification_status=payment.status,
        created_at=payment.created_at,
    )


@router.post("/{payment_id}/verify", response_model=PaymentReceiptResponse)
def verify_payment(
    payment_id: str,
    payload: PaymentVerifyRequest,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    payment = db.query(Payment).join(Instalment).join(SchemeMember).join(ChitScheme).filter(
        Payment.id == payment_id,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found.")

    if payment.status == "paid":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment is already verified and paid.")

    instalment = payment.instalment
    scheme_member = instalment.scheme_member
    scheme = scheme_member.scheme
    member = scheme_member.member

    payment.status = payload.status.value
    payment.verification_notes = payload.verification_notes

    if payload.status.value == "paid":
        instalment.amount_paid = payment.amount_received
        instalment.status = "paid"

        # Map payment method enum
        method_map = {
            "cash": PaymentMethod.CASH,
            "upi": PaymentMethod.UPI,
            "bank_transfer": PaymentMethod.BANK_TRANSFER,
            "cheque": PaymentMethod.CHEQUE,
            "dd": PaymentMethod.DD,
        }
        pm = method_map.get(payment.payment_method, PaymentMethod.UPI)

        # Generate Double-Entry Event 2 Journal Entry
        je = LedgerEngine.create_payment_received_entry(
            entry_number=f"JE-PAY-{payment.receipt_number}",
            receipt_number=payment.receipt_number,
            scheme_code=scheme.scheme_code,
            member_id=member.id,
            member_code=member.member_code,
            net_amount_paid=payment.amount_received,
            dividend_applied=instalment.dividend_credit,
            payment_method=pm,
            transaction_date=payment.payment_date,
        )

        je_record = JournalEntryRecord(
            organiser_id=organiser.id,
            entry_number=je.entry_number,
            transaction_date=je.transaction_date,
            description=je.description,
            reference_entity_type="payment",
            reference_entity_id=payment.id,
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
    db.refresh(payment)

    return PaymentReceiptResponse(
        receipt_number=payment.receipt_number,
        scheme_name=scheme.scheme_name,
        scheme_code=scheme.scheme_code,
        instalment_number=instalment.instalment_number,
        member_name=member.full_name,
        member_code=member.member_code,
        gross_subscription=instalment.gross_subscription,
        dividend_credit=instalment.dividend_credit,
        net_amount_due=instalment.net_amount_due,
        amount_received=payment.amount_received,
        payment_method=payment.payment_method,
        payment_reference_no=payment.payment_reference_no,
        payment_date=payment.payment_date,
        verification_status=payment.status,
        created_at=payment.created_at,
    )


@router.get("/receipts/{receipt_number}", response_model=PaymentReceiptResponse)
def get_payment_receipt(
    receipt_number: str,
    db: Session = Depends(get_db),
    organiser: Organiser = Depends(get_current_organiser),
):
    payment = db.query(Payment).join(Instalment).join(SchemeMember).join(ChitScheme).filter(
        Payment.receipt_number == receipt_number,
        ChitScheme.organiser_id == organiser.id,
    ).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found.")

    instalment = payment.instalment
    scheme_member = instalment.scheme_member
    scheme = scheme_member.scheme
    member = scheme_member.member

    return PaymentReceiptResponse(
        receipt_number=payment.receipt_number,
        scheme_name=scheme.scheme_name,
        scheme_code=scheme.scheme_code,
        instalment_number=instalment.instalment_number,
        member_name=member.full_name,
        member_code=member.member_code,
        gross_subscription=instalment.gross_subscription,
        dividend_credit=instalment.dividend_credit,
        net_amount_due=instalment.net_amount_due,
        amount_received=payment.amount_received,
        payment_method=payment.payment_method,
        payment_reference_no=payment.payment_reference_no,
        payment_date=payment.payment_date,
        verification_status=payment.status,
        created_at=payment.created_at,
    )
