"""
ChitFlow Deterministic Financial Calculation Engine
Governing Statutes:
- Chit Funds Act, 1982 (Act No. 40 of 1982)
- Chit Funds (Amendment) Act, 2019
- Telangana Chit Funds Rules, 2008

Strict Mandate:
- Fixed-point decimal arithmetic (Decimal). ZERO floating-point operations.
- Explicit Rounding Suspense accounting for any fractional paise.
- Hard statutory constraints: max 30% discount ceiling, max 5% foreman commission ceiling.
"""

from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional, List, Dict, Any


TWO_PLACES = Decimal('0.01')
FOUR_PLACES = Decimal('0.0001')

# Statutory Constants
MAX_STATUTORY_DISCOUNT_PERCENT = Decimal('30.00')
MAX_STATUTORY_COMMISSION_PERCENT = Decimal('5.00')


def quantize_currency(value: Decimal, rounding: str = ROUND_HALF_UP) -> Decimal:
    """Quantize decimal value to 2 decimal places (Indian Paise)."""
    return value.quantize(TWO_PLACES, rounding=rounding)


class CalculationValidationError(ValueError):
    """Raised when calculation parameters violate scheme rules or statutory limits."""
    pass


class StatutoryComplianceError(CalculationValidationError):
    """Raised when calculation parameters violate Chit Funds Act, 1982 or 2019 Amendment."""
    pass


@dataclass(frozen=True)
class ChitSchemeConfig:
    """
    Configuration parameters for a Chit Scheme.
    All monetary and percentage fields must be Decimal instances.
    """
    chit_value: Decimal
    duration_months: int
    total_members: int
    monthly_subscription: Decimal
    commission_percentage: Decimal = Decimal('5.00')
    max_discount_percentage: Decimal = Decimal('30.00')

    def __post_init__(self):
        # Validate chit value
        if self.chit_value <= Decimal('0'):
            raise CalculationValidationError("Chit value must be greater than zero.")
        
        # Validate duration and members
        if self.duration_months <= 0:
            raise CalculationValidationError("Duration in months must be positive.")
        if self.total_members <= 0:
            raise CalculationValidationError("Total members must be positive.")
        
        # Validate subscription consistency: chit_value must equal total_members * monthly_subscription
        expected_chit_value = quantize_currency(Decimal(self.total_members) * self.monthly_subscription)
        if quantize_currency(self.chit_value) != expected_chit_value:
            raise CalculationValidationError(
                f"Chit value mismatch: Total Members ({self.total_members}) * "
                f"Monthly Subscription ({self.monthly_subscription}) = {expected_chit_value}, "
                f"which does not match Chit Value ({self.chit_value})."
            )
        
        # Statutory check: Commission cannot exceed 5% under Section 21(1)(b) of Chit Funds Act, 1982
        if self.commission_percentage > MAX_STATUTORY_COMMISSION_PERCENT:
            raise StatutoryComplianceError(
                f"Commission percentage ({self.commission_percentage}%) exceeds the statutory ceiling "
                f"of {MAX_STATUTORY_COMMISSION_PERCENT}% as mandated by Section 21(1)(b) of the Chit Funds Act, 1982."
            )
        if self.commission_percentage < Decimal('0'):
            raise CalculationValidationError("Commission percentage cannot be negative.")

        # Statutory check: Maximum auction discount cannot exceed 30% under the Chit Funds (Amendment) Act, 2019
        if self.max_discount_percentage > MAX_STATUTORY_DISCOUNT_PERCENT:
            raise StatutoryComplianceError(
                f"Maximum discount percentage ({self.max_discount_percentage}%) exceeds the statutory ceiling "
                f"of {MAX_STATUTORY_DISCOUNT_PERCENT}% under Section 6 of the Chit Funds (Amendment) Act, 2019."
            )
        if self.max_discount_percentage < Decimal('0'):
            raise CalculationValidationError("Maximum discount percentage cannot be negative.")


@dataclass(frozen=True)
class AuctionCalculationResult:
    """
    Deterministic result of an auction calculation.
    All monetary fields are strictly quantized to 2 decimal places (paise).
    """
    auction_number: int
    chit_value: Decimal
    is_foreman_entitlement_auction: bool
    winning_bid_discount: Decimal
    winning_payout: Decimal
    foreman_commission: Decimal
    member_dividend_pool: Decimal
    eligible_members_count: int
    dividend_per_member: Decimal
    net_monthly_contribution: Decimal
    rounding_residual: Decimal
    discount_percentage: Decimal

    def to_dict(self) -> Dict[str, Any]:
        return {
            "auction_number": self.auction_number,
            "chit_value": str(self.chit_value),
            "is_foreman_entitlement_auction": self.is_foreman_entitlement_auction,
            "winning_bid_discount": str(self.winning_bid_discount),
            "winning_payout": str(self.winning_payout),
            "foreman_commission": str(self.foreman_commission),
            "member_dividend_pool": str(self.member_dividend_pool),
            "eligible_members_count": self.eligible_members_count,
            "dividend_per_member": str(self.dividend_per_member),
            "net_monthly_contribution": str(self.net_monthly_contribution),
            "rounding_residual": str(self.rounding_residual),
            "discount_percentage": str(self.discount_percentage),
        }


def calculate_auction(
    scheme: ChitSchemeConfig,
    auction_number: int,
    winning_bid_discount: Optional[Decimal] = None,
    eligible_members_count: Optional[int] = None,
    custom_commission: Optional[Decimal] = None,
) -> AuctionCalculationResult:
    """
    Execute deterministic auction calculation in strict accordance with the
    Chit Funds Act, 1982 and the scheme configuration.

    Rules:
    1. Auction 1: Reserved for Foreman (Section 15).
       - Winning payout = Chit Value.
       - Discount = 0.
       - Commission = 0 (foreman receives full chit pool).
       - Dividend = 0.
       - Net monthly contribution = Full monthly subscription.
    2. Subsequent Auctions (m >= 2):
       - winning_bid_discount (D) is provided.
       - D must be between 0 and (max_discount_percentage / 100) * chit_value.
       - Winning Payout (P) = Chit Value - D.
       - Foreman Commission (C) = min(chit_value * (commission_percentage / 100), D).
       - Member Dividend Pool (Pool) = D - C.
       - Dividend Per Member (Div) = floor(Pool / N_eligible) to 2 decimals.
       - Rounding Residual (Delta) = Pool - (Div * N_eligible).
       - Net Contribution (NetContr) = Monthly Subscription - Div.
    """
    if auction_number < 1 or auction_number > scheme.duration_months:
        raise CalculationValidationError(
            f"Auction number {auction_number} is out of bounds for a {scheme.duration_months}-month scheme."
        )

    # Determine eligible dividend members count (default to total_members)
    n_eligible = eligible_members_count if eligible_members_count is not None else scheme.total_members
    if n_eligible <= 0:
        raise CalculationValidationError("Eligible dividend members count must be greater than zero.")

    # Section 15: Foreman 1st Month Entitlement
    if auction_number == 1:
        chit_v = quantize_currency(scheme.chit_value)
        zero = Decimal('0.00')
        monthly_sub = quantize_currency(scheme.monthly_subscription)

        return AuctionCalculationResult(
            auction_number=1,
            chit_value=chit_v,
            is_foreman_entitlement_auction=True,
            winning_bid_discount=zero,
            winning_payout=chit_v,
            foreman_commission=zero,
            member_dividend_pool=zero,
            eligible_members_count=n_eligible,
            dividend_per_member=zero,
            net_monthly_contribution=monthly_sub,
            rounding_residual=zero,
            discount_percentage=zero,
        )

    # Subsequent auctions (m >= 2)
    if winning_bid_discount is None:
        raise CalculationValidationError(
            f"Winning bid discount is required for auction #{auction_number}."
        )

    discount = quantize_currency(winning_bid_discount)
    if discount < Decimal('0'):
        raise CalculationValidationError("Winning bid discount cannot be negative.")

    # Calculate statutory and scheme ceiling on discount
    max_allowed_discount = quantize_currency(
        scheme.chit_value * (scheme.max_discount_percentage / Decimal('100.00'))
    )

    if discount > max_allowed_discount:
        discount_pct = quantize_currency((discount / scheme.chit_value) * Decimal('100.00'))
        raise StatutoryComplianceError(
            f"Bid discount ₹{discount:,.2f} ({discount_pct}%) exceeds maximum allowed discount "
            f"of ₹{max_allowed_discount:,.2f} ({scheme.max_discount_percentage}% of chit value)."
        )

    # Winning Payout: P = V - D
    winning_payout = quantize_currency(scheme.chit_value - discount)

    # Foreman Commission Calculation
    if custom_commission is not None:
        commission = quantize_currency(custom_commission)
        # Verify custom commission does not exceed statutory cap (5%)
        statutory_max_commission = quantize_currency(
            scheme.chit_value * (MAX_STATUTORY_COMMISSION_PERCENT / Decimal('100.00'))
        )
        if commission > statutory_max_commission:
            raise StatutoryComplianceError(
                f"Foreman commission ₹{commission:,.2f} exceeds statutory 5% cap of ₹{statutory_max_commission:,.2f}."
            )
        if commission > discount:
            raise CalculationValidationError(
                f"Foreman commission ₹{commission:,.2f} cannot exceed the auction discount ₹{discount:,.2f}."
            )
    else:
        # Standard Commission: C = min(chit_value * (commission_percentage / 100), discount)
        calculated_comm = quantize_currency(
            scheme.chit_value * (scheme.commission_percentage / Decimal('100.00'))
        )
        commission = min(calculated_comm, discount)

    # Member Dividend Pool: Pool = D - C
    dividend_pool = quantize_currency(discount - commission)
    if dividend_pool < Decimal('0'):
        raise CalculationValidationError(
            f"Calculated dividend pool cannot be negative: D ({discount}) - C ({commission}) = {dividend_pool}."
        )

    # Dividend Per Member: Div = floor(Pool / N_eligible) quantized to paise
    # We round DOWN to ensure the total distributed dividend never exceeds the available pool
    raw_div_per_member = dividend_pool / Decimal(n_eligible)
    div_per_member = quantize_currency(raw_div_per_member, rounding=ROUND_DOWN)

    # Rounding Residual: Delta = Pool - (Div * N_eligible)
    total_distributed_dividend = quantize_currency(div_per_member * Decimal(n_eligible))
    rounding_residual = quantize_currency(dividend_pool - total_distributed_dividend)

    # Net Monthly Contribution: NetContr = S - Div
    net_contribution = quantize_currency(scheme.monthly_subscription - div_per_member)

    # Discount Percentage of Chit Value
    discount_percentage = quantize_currency((discount / scheme.chit_value) * Decimal('100.00'))

    return AuctionCalculationResult(
        auction_number=auction_number,
        chit_value=quantize_currency(scheme.chit_value),
        is_foreman_entitlement_auction=False,
        winning_bid_discount=discount,
        winning_payout=winning_payout,
        foreman_commission=commission,
        member_dividend_pool=dividend_pool,
        eligible_members_count=n_eligible,
        dividend_per_member=div_per_member,
        net_monthly_contribution=net_contribution,
        rounding_residual=rounding_residual,
        discount_percentage=discount_percentage,
    )


@dataclass(frozen=True)
class JournalEntryLineData:
    account_code: str
    account_name: str
    debit_amount: Decimal
    credit_amount: Decimal
    memo: str


@dataclass(frozen=True)
class GeneratedJournalEntryData:
    entry_type: str
    description: str
    lines: List[JournalEntryLineData]

    @property
    def total_debit(self) -> Decimal:
        return quantize_currency(sum(line.debit_amount for line in self.lines))

    @property
    def total_credit(self) -> Decimal:
        return quantize_currency(sum(line.credit_amount for line in self.lines))

    @property
    def is_balanced(self) -> bool:
        return self.total_debit == self.total_credit


def generate_auction_journal_entry(
    scheme_code: str,
    result: AuctionCalculationResult,
    winning_member_code: str,
) -> GeneratedJournalEntryData:
    """
    Generate double-entry ledger journal entry lines for a finalized auction.
    Guarantees that sum(Debits) == sum(Credits).
    """
    lines: List[JournalEntryLineData] = []
    zero = Decimal('0.00')

    if result.is_foreman_entitlement_auction:
        # Month 1 Foreman Entitlement:
        # DR 2010 Chit Scheme Collection Pool (chit_value)
        #   CR 2010 Prize Money Payable (Foreman) (chit_value)
        lines.append(
            JournalEntryLineData(
                account_code="2010-POOL",
                account_name=f"Chit Scheme Collection Pool ({scheme_code})",
                debit_amount=result.chit_value,
                credit_amount=zero,
                memo=f"Auction #{result.auction_number} collection pool for foreman entitlement",
            )
        )
        lines.append(
            JournalEntryLineData(
                account_code="2010-PRIZE",
                account_name="Prize Money Payable (Foreman)",
                debit_amount=zero,
                credit_amount=result.chit_value,
                memo=f"Auction #{result.auction_number} 100% chit value entitlement under Section 15",
            )
        )
        return GeneratedJournalEntryData(
            entry_type="auction_foreman_entitlement",
            description=f"Auction #{result.auction_number} foreman entitlement for {scheme_code}",
            lines=lines,
        )

    # DR 2010 Chit Scheme Collection Pool: Total Chit Value
    lines.append(
        JournalEntryLineData(
            account_code="2010-POOL",
            account_name=f"Chit Scheme Collection Pool ({scheme_code})",
            debit_amount=result.chit_value,
            credit_amount=zero,
            memo=f"Auction #{result.auction_number} collection pool",
        )
    )

    # CR 2010 Prize Money Payable (Winning Member): winning_payout
    lines.append(
        JournalEntryLineData(
            account_code="2010-PRIZE",
            account_name=f"Prize Money Payable (Member {winning_member_code})",
            debit_amount=zero,
            credit_amount=result.winning_payout,
            memo=f"Prize payable to winning member {winning_member_code}",
        )
    )

    # CR 4010 Foreman Commission Income: foreman_commission
    if result.foreman_commission > zero:
        lines.append(
            JournalEntryLineData(
                account_code="4010",
                account_name="Foreman Commission Income",
                debit_amount=zero,
                credit_amount=result.foreman_commission,
                memo=f"Auction #{result.auction_number} foreman commission earned",
            )
        )

    # CR 5010 Member Dividend Pool (Distributed): (div_per_member * eligible_members)
    distributed_dividend = quantize_currency(result.dividend_per_member * Decimal(result.eligible_members_count))
    if distributed_dividend > zero:
        lines.append(
            JournalEntryLineData(
                account_code="5010",
                account_name="Member Dividend Pool Distributed",
                debit_amount=zero,
                credit_amount=distributed_dividend,
                memo=f"Dividend distributed to {result.eligible_members_count} members @ ₹{result.dividend_per_member}",
            )
        )

    # CR 2030 Rounding Suspense Account: rounding_residual
    if result.rounding_residual > zero:
        lines.append(
            JournalEntryLineData(
                account_code="2030",
                account_name="Rounding Suspense Account",
                debit_amount=zero,
                credit_amount=result.rounding_residual,
                memo=f"Auction #{result.auction_number} undistributed paise residual",
            )
        )

    entry = GeneratedJournalEntryData(
        entry_type="auction_finalization",
        description=f"Finalized Auction #{result.auction_number} for {scheme_code} - Winner {winning_member_code}",
        lines=lines,
    )

    # Invariant assertion
    if not entry.is_balanced:
        raise CalculationValidationError(
            f"Internal Accounting Invariant Violation: Debits (₹{entry.total_debit}) != Credits (₹{entry.total_credit})."
        )

    return entry

