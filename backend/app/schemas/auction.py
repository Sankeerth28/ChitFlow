from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AuctionStatus(str, Enum):
    SCHEDULED = "scheduled"
    BIDDING_OPEN = "bidding_open"
    BIDDING_CLOSED = "bidding_closed"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class AuctionBidCreate(BaseModel):
    member_id: str
    bid_discount_amount: Decimal = Field(..., ge=0, example=Decimal('26000.00'))
    bid_source: str = Field(default="mobile", example="mobile")


class AuctionBidResponse(BaseModel):
    id: str
    auction_id: str
    member_id: str
    bid_discount_amount: Decimal
    submitted_at: datetime
    is_winning_bid: bool
    bid_source: str

    class Config:
        from_attributes = True


class AuctionConfirmRequest(BaseModel):
    winning_member_id: str
    winning_bid_discount: Decimal = Field(..., ge=0, example=Decimal('26000.00'))
    custom_commission: Optional[Decimal] = Field(None, ge=0, description="Optional custom commission (max 5%)")
    custom_minutes_note: Optional[str] = Field(
        None,
        example="Auction conducted at registered office with 8 members present physically and 2 via mobile."
    )


class AuctionCalculationResponse(BaseModel):
    auction_id: str
    auction_number: int
    scheme_id: str
    chit_value: Decimal
    is_foreman_entitlement: bool
    winning_payout: Decimal
    auction_discount: Decimal
    foreman_commission: Decimal
    member_dividend_pool: Decimal
    eligible_members_count: int
    dividend_per_member: Decimal
    net_monthly_contribution: Decimal
    rounding_residual: Decimal
    discount_percentage: Decimal
    journal_entry_id: Optional[str] = None
    payout_record_id: Optional[str] = None


class AuctionResponse(BaseModel):
    id: str
    scheme_id: str
    auction_number: int
    scheduled_datetime: datetime
    actual_datetime: Optional[datetime] = None
    status: AuctionStatus
    winning_member_id: Optional[str] = None
    winning_bid_discount: Decimal
    winning_payout: Decimal
    foreman_commission: Decimal
    dividend_pool: Decimal
    dividend_per_member: Decimal
    rounding_residual: Decimal
    minutes_of_auction: Optional[str] = None

    class Config:
        from_attributes = True

