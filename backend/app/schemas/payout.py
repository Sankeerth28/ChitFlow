from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional
from datetime import date, datetime
from enum import Enum


class PayoutStatus(str, Enum):
    AWAITING_SECURITY = "awaiting_security"
    SECURITY_VERIFIED = "security_verified"
    APPROVED = "approved"
    PROCESSING = "processing"
    PAID = "paid"
    ON_HOLD = "on_hold"
    FAILED = "failed"


class PayoutSecurityVerifyRequest(BaseModel):
    security_type: str = Field(..., example="Guarantor_Salary_Certificate_and_Promissory_Note")
    security_doc_url: Optional[str] = Field(None, example="https://s3.chitflow.in/docs/surety-492.pdf")
    notes: Optional[str] = Field(None, example="Two government employee guarantors verified under Section 31.")


class PayoutDisburseRequest(BaseModel):
    deductions_amount: Decimal = Field(default=Decimal('0.00'), ge=0)
    disbursement_method: str = Field(default="bank_transfer", example="bank_transfer")
    transaction_reference: str = Field(..., example="NEFT/CMS/2026110500412")
    disbursement_date: date = Field(default_factory=date.today)


class PayoutResponse(BaseModel):
    id: str
    auction_id: str
    member_id: str
    member_name: Optional[str] = None
    member_code: Optional[str] = None
    gross_prize_amount: Decimal
    deductions_amount: Decimal
    net_payout_amount: Decimal
    status: PayoutStatus
    security_type: Optional[str] = None
    disbursement_date: Optional[date] = None
    disbursement_method: Optional[str] = None
    transaction_reference: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
