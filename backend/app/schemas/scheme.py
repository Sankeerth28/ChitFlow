from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from typing import Optional
from datetime import date, datetime
from enum import Enum


class SchemeStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ChitSchemeBase(BaseModel):
    scheme_code: str = Field(..., min_length=2, max_length=50, example="CHIT-10M-1L")
    scheme_name: str = Field(..., min_length=3, max_length=255, example="1 Lakh 10 Months Festive Chit")
    chit_value: Decimal = Field(..., gt=0, example=Decimal('100000.00'))
    monthly_subscription: Decimal = Field(..., gt=0, example=Decimal('10000.00'))
    duration_months: int = Field(..., gt=0, le=120, example=10)
    total_members: int = Field(..., gt=0, le=120, example=10)
    commission_percentage: Decimal = Field(default=Decimal('5.00'), ge=0, le=Decimal('5.00'))
    max_discount_percentage: Decimal = Field(default=Decimal('30.00'), ge=0, le=Decimal('30.00'))
    start_date: date
    monthly_due_day: int = Field(..., ge=1, le=31, example=5)
    auction_day: int = Field(..., ge=1, le=31, example=10)
    pso_number: Optional[str] = Field(None, description="Prior Sanction Order from Registrar of Chits")
    fd_receipt_number: Optional[str] = Field(None, description="100% Fixed Deposit Guarantee under Section 20")

    @field_validator("commission_percentage")
    @classmethod
    def validate_commission_cap(cls, v: Decimal) -> Decimal:
        if v > Decimal('5.00'):
            raise ValueError("Foreman commission cannot exceed statutory 5.00% cap (Section 21(1)(b) Chit Funds Act, 1982).")
        return v

    @field_validator("max_discount_percentage")
    @classmethod
    def validate_discount_cap(cls, v: Decimal) -> Decimal:
        if v > Decimal('30.00'):
            raise ValueError("Maximum auction discount cannot exceed statutory 30.00% ceiling (2019 Amendment).")
        return v


class ChitSchemeCreate(ChitSchemeBase):
    pass


class ChitSchemeUpdate(BaseModel):
    scheme_name: Optional[str] = None
    pso_number: Optional[str] = None
    fd_receipt_number: Optional[str] = None
    status: Optional[SchemeStatus] = None


class ChitSchemeResponse(ChitSchemeBase):
    id: str
    organiser_id: str
    status: SchemeStatus
    rules_locked: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SchemeMemberEnroll(BaseModel):
    member_id: str
    chit_ticket_number: int = Field(..., gt=0)
    enrollment_date: date = Field(default_factory=date.today)


class SchemeMemberResponse(BaseModel):
    id: str
    scheme_id: str
    member_id: str
    chit_ticket_number: int
    enrollment_date: date
    has_prized: bool
    prized_auction_id: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True
