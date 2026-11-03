from pydantic import BaseModel, Field, EmailStr
from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import date, datetime


class MemberCreate(BaseModel):
    member_code: Optional[str] = Field(None, min_length=2, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=255)
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
    email: Optional[str] = Field(None, max_length=255)
    address_line1: str = Field(..., min_length=3)
    city: str = Field(default="Hyderabad")
    state: str = Field(default="Telangana")
    pincode: str = Field(default="500081")
    emergency_contact: Optional[str] = None
    kyc_status: Optional[str] = Field(default="verified")
    status: Optional[str] = Field(default="active")


class MemberUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    mobile_number: Optional[str] = Field(None, pattern=r"^[6-9]\d{9}$")
    email: Optional[str] = Field(None, max_length=255)
    address_line1: Optional[str] = Field(None, min_length=3)
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact: Optional[str] = None
    kyc_status: Optional[str] = None
    status: Optional[str] = None


class MemberStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(active|inactive|suspended)$")
    reason: Optional[str] = None


class MemberResponse(BaseModel):
    id: str
    organiser_id: str
    member_code: str
    full_name: str
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    address_line1: str
    city: str
    state: str
    pincode: str
    emergency_contact: Optional[str] = None
    kyc_status: str
    status: str = "active"
    created_at: datetime
    updated_at: Optional[datetime] = None
    active_schemes_count: Optional[int] = 0

    class Config:
        from_attributes = True


class MemberPaginatedResponse(BaseModel):
    items: List[MemberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class EnrolledSchemeDetail(BaseModel):
    scheme_member_id: str
    scheme_id: str
    scheme_code: str
    scheme_name: str
    chit_value: Decimal
    monthly_subscription: Decimal
    duration_months: int
    chit_ticket_number: int
    enrollment_date: date
    has_prized: bool
    scheme_status: str
    current_month: int
    total_paid: Decimal
    total_dividend: Decimal
    outstanding_balance: Decimal


class MemberPaymentReceipt(BaseModel):
    payment_id: str
    receipt_number: str
    payment_date: date
    amount_received: Decimal
    payment_method: str
    payment_reference_no: Optional[str] = None
    status: str
    scheme_code: str
    instalment_number: int
    gross_subscription: Decimal
    dividend_credit: Decimal


class MemberDueDetail(BaseModel):
    instalment_id: str
    scheme_code: str
    scheme_name: str
    instalment_number: int
    due_date: date
    gross_subscription: Decimal
    dividend_credit: Decimal
    net_amount_due: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    status: str


class MemberFullProfile(BaseModel):
    member: MemberResponse
    enrolled_schemes: List[EnrolledSchemeDetail]
    recent_payments: List[MemberPaymentReceipt]
    outstanding_dues: List[MemberDueDetail]
    total_enrolled: int
    total_paid: Decimal
    total_dues: Decimal
    total_dividends: Decimal


class MemberDashboardSummary(BaseModel):
    member_id: str
    member_name: str
    member_code: str
    active_chits_count: int
    monthly_due_amount: Decimal
    total_amount_paid: Decimal
    total_dividends_received: Decimal
    pending_instalments_count: int
    next_payment_date: Optional[date] = None
    next_due_amount: Decimal = Decimal('0.00')
    has_prized_any: bool = False


class CsvImportRowError(BaseModel):
    row: int
    error: str
    raw_data: Optional[Dict[str, Any]] = None


class CsvImportResult(BaseModel):
    imported_count: int
    skipped_count: int
    errors: List[CsvImportRowError]
