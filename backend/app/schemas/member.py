from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional, List
from datetime import date, datetime


class MemberCreate(BaseModel):
    member_code: str = Field(..., min_length=2, max_length=50, example="M-001")
    full_name: str = Field(..., min_length=2, max_length=255, example="K. Venkat Rao")
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$", example="9876543210")
    address_line1: str = Field(..., example="Flat 302, Sri Sai Nilayam, Madhapur")
    city: str = Field(default="Hyderabad", example="Hyderabad")
    state: str = Field(default="Telangana", example="Telangana")
    pincode: str = Field(default="500081", example="500081")
    emergency_contact: Optional[str] = Field(None, example="9876543211")


class MemberResponse(BaseModel):
    id: str
    organiser_id: str
    member_code: str
    full_name: str
    mobile_number: Optional[str] = None
    address_line1: str
    city: str
    state: str
    pincode: str
    emergency_contact: Optional[str] = None
    kyc_status: str
    created_at: datetime

    class Config:
        from_attributes = True


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
