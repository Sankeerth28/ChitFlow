import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Organiser(Base):
    __tablename__ = "organisers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_name = Column(String(255), nullable=False)
    trade_license_number = Column(String(100), nullable=True)
    chit_registrar_registration_no = Column(String(100), unique=True, nullable=True)
    state = Column(String(50), default="Telangana")
    contact_phone = Column(String(20), nullable=False)
    contact_email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schemes = relationship("ChitScheme", back_populates="organiser")
    members = relationship("Member", back_populates="organiser")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organiser_id = Column(String(36), ForeignKey("organisers.id"), nullable=True)
    mobile_number = Column(String(15), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    pin_hash = Column(String(255), nullable=True)
    role = Column(String(30), default="member")  # super_admin, organiser, accountant, member
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    member_profile = relationship("Member", back_populates="user", uselist=False)


class Member(Base):
    __tablename__ = "members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=True)
    organiser_id = Column(String(36), ForeignKey("organisers.id"), nullable=False)
    member_code = Column(String(50), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    address_line1 = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(50), default="Telangana", nullable=False)
    pincode = Column(String(10), nullable=False)
    emergency_contact = Column(String(20), nullable=True)
    kyc_status = Column(String(50), default="pending")  # verified, pending, rejected
    status = Column(String(30), default="active", nullable=False)  # active, inactive, suspended
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("organiser_id", "member_code", name="uq_organiser_member_code"),
    )

    organiser = relationship("Organiser", back_populates="members")
    user = relationship("User", back_populates="member_profile")
    enrolled_schemes = relationship("SchemeMember", back_populates="member")


class ChitScheme(Base):
    __tablename__ = "chit_schemes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organiser_id = Column(String(36), ForeignKey("organisers.id"), nullable=False)
    scheme_code = Column(String(50), nullable=False)
    scheme_name = Column(String(255), nullable=False)
    chit_value = Column(Numeric(14, 2), nullable=False)
    monthly_subscription = Column(Numeric(14, 2), nullable=False)
    duration_months = Column(Integer, nullable=False)
    total_members = Column(Integer, nullable=False)
    commission_percentage = Column(Numeric(5, 2), default=Decimal('5.00'), nullable=False)
    max_discount_percentage = Column(Numeric(5, 2), default=Decimal('30.00'), nullable=False)
    start_date = Column(Date, nullable=False)
    monthly_due_day = Column(Integer, nullable=False)
    auction_day = Column(Integer, nullable=False)
    pso_number = Column(String(100), nullable=True)
    fd_receipt_number = Column(String(100), nullable=True)
    status = Column(String(30), default="draft", nullable=False)
    rules_locked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("organiser_id", "scheme_code", name="uq_organiser_scheme_code"),
    )

    organiser = relationship("Organiser", back_populates="schemes")
    members = relationship("SchemeMember", back_populates="scheme")
    auctions = relationship("Auction", back_populates="scheme")


class SchemeMember(Base):
    __tablename__ = "scheme_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scheme_id = Column(String(36), ForeignKey("chit_schemes.id"), nullable=False)
    member_id = Column(String(36), ForeignKey("members.id"), nullable=False)
    chit_ticket_number = Column(Integer, nullable=False)
    enrollment_date = Column(Date, nullable=False)
    has_prized = Column(Boolean, default=False)
    prized_auction_id = Column(String(36), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("scheme_id", "chit_ticket_number", name="uq_scheme_ticket"),
        UniqueConstraint("scheme_id", "member_id", name="uq_scheme_member"),
    )

    scheme = relationship("ChitScheme", back_populates="members")
    member = relationship("Member", back_populates="enrolled_schemes")
    instalments = relationship("Instalment", back_populates="scheme_member")


class Auction(Base):
    __tablename__ = "auctions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scheme_id = Column(String(36), ForeignKey("chit_schemes.id"), nullable=False)
    auction_number = Column(Integer, nullable=False)
    scheduled_datetime = Column(DateTime, nullable=False)
    actual_datetime = Column(DateTime, nullable=True)
    status = Column(String(30), default="scheduled", nullable=False)
    winning_member_id = Column(String(36), ForeignKey("members.id"), nullable=True)
    winning_bid_discount = Column(Numeric(14, 2), default=Decimal('0.00'))
    winning_payout = Column(Numeric(14, 2), default=Decimal('0.00'))
    foreman_commission = Column(Numeric(14, 2), default=Decimal('0.00'))
    dividend_pool = Column(Numeric(14, 2), default=Decimal('0.00'))
    dividend_per_member = Column(Numeric(14, 2), default=Decimal('0.00'))
    rounding_residual = Column(Numeric(6, 2), default=Decimal('0.00'))
    minutes_of_auction = Column(Text, nullable=True)
    minutes_filed_with_registrar = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("scheme_id", "auction_number", name="uq_scheme_auction_number"),
    )

    scheme = relationship("ChitScheme", back_populates="auctions")
    bids = relationship("AuctionBid", back_populates="auction")
    payout = relationship("Payout", back_populates="auction", uselist=False)


class AuctionBid(Base):
    __tablename__ = "auction_bids"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    auction_id = Column(String(36), ForeignKey("auctions.id"), nullable=False)
    member_id = Column(String(36), ForeignKey("members.id"), nullable=False)
    bid_discount_amount = Column(Numeric(14, 2), nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    is_winning_bid = Column(Boolean, default=False)
    bid_source = Column(String(50), default="in_person")

    auction = relationship("Auction", back_populates="bids")


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    auction_id = Column(String(36), ForeignKey("auctions.id"), unique=True, nullable=False)
    member_id = Column(String(36), ForeignKey("members.id"), nullable=False)
    gross_prize_amount = Column(Numeric(14, 2), nullable=False)
    deductions_amount = Column(Numeric(14, 2), default=Decimal('0.00'))
    net_payout_amount = Column(Numeric(14, 2), nullable=False)
    status = Column(String(30), default="awaiting_security", nullable=False)
    security_verified_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    security_type = Column(String(100), nullable=True)
    security_doc_url = Column(Text, nullable=True)
    disbursement_date = Column(Date, nullable=True)
    disbursement_method = Column(String(30), nullable=True)
    transaction_reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    auction = relationship("Auction", back_populates="payout")


class Instalment(Base):
    __tablename__ = "instalments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    scheme_member_id = Column(String(36), ForeignKey("scheme_members.id"), nullable=False)
    auction_id = Column(String(36), ForeignKey("auctions.id"), nullable=False)
    instalment_number = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    gross_subscription = Column(Numeric(14, 2), nullable=False)
    dividend_credit = Column(Numeric(14, 2), default=Decimal('0.00'))
    net_amount_due = Column(Numeric(14, 2), nullable=False)
    amount_paid = Column(Numeric(14, 2), default=Decimal('0.00'))
    status = Column(String(30), default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("scheme_member_id", "instalment_number", name="uq_member_instalment"),
    )

    scheme_member = relationship("SchemeMember", back_populates="instalments")
    payments = relationship("Payment", back_populates="instalment")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    instalment_id = Column(String(36), ForeignKey("instalments.id"), nullable=False)
    member_id = Column(String(36), ForeignKey("members.id"), nullable=False)
    receipt_number = Column(String(100), unique=True, nullable=False)
    amount_received = Column(Numeric(14, 2), nullable=False)
    payment_method = Column(String(30), nullable=False)
    payment_reference_no = Column(String(100), nullable=True)
    payment_date = Column(Date, nullable=False)
    proof_document_url = Column(Text, nullable=True)
    status = Column(String(30), default="submitted", nullable=False)
    verified_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    verification_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    instalment = relationship("Instalment", back_populates="payments")


class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organiser_id = Column(String(36), ForeignKey("organisers.id"), nullable=False)
    scheme_id = Column(String(36), ForeignKey("chit_schemes.id"), nullable=True)
    account_code = Column(String(50), nullable=False)
    account_name = Column(String(255), nullable=False)
    account_type = Column(String(30), nullable=False)  # asset, liability, equity, revenue, expense
    current_balance = Column(Numeric(16, 2), default=Decimal('0.00'), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("organiser_id", "account_code", name="uq_organiser_account_code"),
    )


class JournalEntryRecord(Base):
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organiser_id = Column(String(36), ForeignKey("organisers.id"), nullable=False)
    entry_number = Column(String(100), unique=True, nullable=False)
    transaction_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    reference_entity_type = Column(String(50), nullable=False)
    reference_entity_id = Column(String(50), nullable=False)
    is_reversal = Column(Boolean, default=False)
    reversed_entry_id = Column(String(36), ForeignKey("journal_entries.id"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lines = relationship("JournalEntryLineRecord", back_populates="journal_entry")


class JournalEntryLineRecord(Base):
    __tablename__ = "journal_entry_lines"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(String(36), ForeignKey("ledger_accounts.id"), nullable=False)
    debit_amount = Column(Numeric(14, 2), default=Decimal('0.00'), nullable=False)
    credit_amount = Column(Numeric(14, 2), default=Decimal('0.00'), nullable=False)
    memo = Column(Text, nullable=True)

    journal_entry = relationship("JournalEntryRecord", back_populates="lines")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    jti = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


