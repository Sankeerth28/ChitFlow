from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional
from datetime import date, datetime
from enum import Enum


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    UNDER_VERIFICATION = "under_verification"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    REJECTED = "rejected"
    REFUNDED = "refunded"


class PaymentMethodEnum(str, Enum):
    CASH = "cash"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    DD = "dd"


class PaymentSubmit(BaseModel):
    instalment_id: str
    amount_received: Decimal = Field(..., gt=0, example=Decimal('7800.00'))
    payment_method: PaymentMethodEnum = Field(default=PaymentMethodEnum.UPI)
    payment_reference_no: Optional[str] = Field(None, example="UPI/432901928492")
    payment_date: date = Field(default_factory=date.today)
    proof_document_url: Optional[str] = None


class PaymentVerifyRequest(BaseModel):
    status: PaymentStatus = Field(default=PaymentStatus.PAID)
    verification_notes: Optional[str] = Field(None, example="Verified against HDFC Bank account credit on 2026-11-05.")


class PaymentReceiptResponse(BaseModel):
    receipt_number: str
    scheme_name: str
    scheme_code: str
    instalment_number: int
    member_name: str
    member_code: str
    gross_subscription: Decimal
    dividend_credit: Decimal
    net_amount_due: Decimal
    amount_received: Decimal
    payment_method: str
    payment_reference_no: Optional[str]
    payment_date: date
    verification_status: PaymentStatus
    verified_by_name: Optional[str] = None
    created_at: datetime


class InstalmentResponse(BaseModel):
    id: str
    scheme_member_id: str
    auction_id: str
    instalment_number: int
    due_date: date
    gross_subscription: Decimal
    dividend_credit: Decimal
    net_amount_due: Decimal
    amount_paid: Decimal
    status: PaymentStatus

    class Config:
        from_attributes = True
