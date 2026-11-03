"""
ChitFlow Double-Entry Accounting Ledger Engine
Governing Principles:
- Strict double-entry general ledger.
- Every financial event generates balanced debits and credits: sum(DR) == sum(CR).
- Immutable ledger: records cannot be edited or deleted in-place.
- Reversals must be executed via auditable reversing journal entries.
- Standard Chart of Accounts (COA) mapped per Section 4 of TAD v1.0.
"""

from decimal import Decimal
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import date, datetime

from app.core.calc_engine import quantize_currency, CalculationValidationError


class AccountType(str, Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class PaymentMethod(str, Enum):
    CASH = "cash"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    DD = "dd"


# Standard Chart of Accounts (COA) Codes
COA_CASH = "1010"
COA_BANK = "1020"
COA_REGISTRAR_DEPOSIT = "1030"
COA_MEMBER_RECEIVABLE = "1100"
COA_PRIZE_PAYABLE = "2010"
COA_COLLECTION_POOL = "2010-POOL"
COA_ADVANCE_SUBSCRIPTIONS = "2020"
COA_ROUNDING_SUSPENSE = "2030"
COA_FOREMAN_CAPITAL = "3010"
COA_FOREMAN_COMMISSION = "4010"
COA_LATE_FEE_INCOME = "4020"
COA_MEMBER_DIVIDEND_EXPENSE = "5010"
COA_STATUTORY_FEES = "5020"


@dataclass(frozen=True)
class JournalLine:
    account_code: str
    account_name: str
    debit_amount: Decimal = Decimal('0.00')
    credit_amount: Decimal = Decimal('0.00')
    member_id: Optional[str] = None
    memo: Optional[str] = None

    def __post_init__(self):
        dr = quantize_currency(self.debit_amount)
        cr = quantize_currency(self.credit_amount)
        if dr > Decimal('0') and cr > Decimal('0'):
            raise CalculationValidationError("A journal line cannot have both debit and credit amounts.")
        if dr == Decimal('0') and cr == Decimal('0'):
            raise CalculationValidationError("A journal line must have either a debit or a credit amount.")


@dataclass
class JournalEntry:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entry_number: str = ""
    transaction_date: date = field(default_factory=date.today)
    description: str = ""
    reference_entity_type: str = ""  # 'subscription_billing', 'payment', 'auction', 'payout', 'reversal'
    reference_entity_id: str = ""
    lines: List[JournalLine] = field(default_factory=list)
    is_reversal: bool = False
    reversed_entry_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def total_debits(self) -> Decimal:
        return quantize_currency(sum(line.debit_amount for line in self.lines))

    @property
    def total_credits(self) -> Decimal:
        return quantize_currency(sum(line.credit_amount for line in self.lines))

    @property
    def is_balanced(self) -> bool:
        return self.total_debits == self.total_credits

    def validate_balance(self):
        if not self.is_balanced:
            raise CalculationValidationError(
                f"Unbalanced Journal Entry '{self.entry_number}': Total Debits (₹{self.total_debits}) "
                f"!= Total Credits (₹{self.total_credits}). Difference: ₹{abs(self.total_debits - self.total_credits)}."
            )


class LedgerEngine:
    """
    Factory for producing standard double-entry journal entries for ChitFlow events.
    """

    @staticmethod
    def create_subscription_billing_entry(
        entry_number: str,
        scheme_code: str,
        instalment_number: int,
        member_dues: List[Dict[str, Any]],  # List of {member_id, member_code, gross_subscription}
        transaction_date: Optional[date] = None,
    ) -> JournalEntry:
        """
        EVENT 1: Monthly Subscription Billed (Gross dues generated)
        DR 1100 Member Subscriptions Receivable (per member)
            CR 2010-POOL Chit Scheme Collection Pool (Gross Total)
        """
        t_date = transaction_date or date.today()
        lines: List[JournalLine] = []
        total_gross = Decimal('0.00')

        for item in member_dues:
            sub = quantize_currency(item["gross_subscription"])
            total_gross += sub
            lines.append(
                JournalLine(
                    account_code=COA_MEMBER_RECEIVABLE,
                    account_name=f"Member Subscriptions Receivable ({item['member_code']})",
                    debit_amount=sub,
                    credit_amount=Decimal('0.00'),
                    member_id=item["member_id"],
                    memo=f"Due for {scheme_code} M#{instalment_number}",
                )
            )

        lines.append(
            JournalLine(
                account_code=COA_COLLECTION_POOL,
                account_name=f"Chit Scheme Collection Pool ({scheme_code})",
                debit_amount=Decimal('0.00'),
                credit_amount=quantize_currency(total_gross),
                memo=f"Gross subscription billing for {scheme_code} Month #{instalment_number}",
            )
        )

        entry = JournalEntry(
            entry_number=entry_number,
            transaction_date=t_date,
            description=f"Monthly subscription billing for {scheme_code} Instalment #{instalment_number}",
            reference_entity_type="subscription_billing",
            reference_entity_id=f"{scheme_code}-M{instalment_number}",
            lines=lines,
        )
        entry.validate_balance()
        return entry

    @staticmethod
    def create_payment_received_entry(
        entry_number: str,
        receipt_number: str,
        scheme_code: str,
        member_id: str,
        member_code: str,
        net_amount_paid: Decimal,
        dividend_applied: Decimal,
        payment_method: PaymentMethod,
        transaction_date: Optional[date] = None,
    ) -> JournalEntry:
        """
        EVENT 2: Member Payment Received
        DR 1020 Bank / 1010 Cash (Net Amount Paid)
        DR 5010 Member Dividend Expense (Dividend Applied)
            CR 1100 Member Subscriptions Receivable (Total Settled = Net + Dividend)
        """
        t_date = transaction_date or date.today()
        net_paid = quantize_currency(net_amount_paid)
        div = quantize_currency(dividend_applied)
        total_settled = quantize_currency(net_paid + div)

        target_asset_account = COA_CASH if payment_method == PaymentMethod.CASH else COA_BANK
        target_account_name = "Cash on Hand" if payment_method == PaymentMethod.CASH else "Bank Operating Account"

        lines: List[JournalLine] = [
            JournalLine(
                account_code=target_asset_account,
                account_name=target_account_name,
                debit_amount=net_paid,
                credit_amount=Decimal('0.00'),
                memo=f"Subscription payment via {payment_method.value.upper()} (Receipt: {receipt_number})",
            ),
        ]

        if div > Decimal('0.00'):
            lines.append(
                JournalLine(
                    account_code=COA_MEMBER_DIVIDEND_EXPENSE,
                    account_name="Member Dividend Applied",
                    debit_amount=div,
                    credit_amount=Decimal('0.00'),
                    member_id=member_id,
                    memo=f"Dividend discount credit applied for {member_code}",
                )
            )

        lines.append(
            JournalLine(
                account_code=COA_MEMBER_RECEIVABLE,
                account_name=f"Member Subscriptions Receivable ({member_code})",
                debit_amount=Decimal('0.00'),
                credit_amount=total_settled,
                member_id=member_id,
                memo=f"Settlement of receivable for {scheme_code} (Receipt: {receipt_number})",
            )
        )

        entry = JournalEntry(
            entry_number=entry_number,
            transaction_date=t_date,
            description=f"Payment settlement from {member_code} for {scheme_code} (Receipt: {receipt_number})",
            reference_entity_type="payment",
            reference_entity_id=receipt_number,
            lines=lines,
        )
        entry.validate_balance()
        return entry

    @staticmethod
    def create_payout_disbursed_entry(
        entry_number: str,
        payout_id: str,
        scheme_code: str,
        member_id: str,
        member_code: str,
        net_payout_amount: Decimal,
        deductions_amount: Decimal = Decimal('0.00'),
        payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER,
        transaction_date: Optional[date] = None,
    ) -> JournalEntry:
        """
        EVENT 4: Prize Money Disbursed (Post Surety / Security Verification)
        DR 2010 Prize Money Payable (Gross Prize = Net + Deductions)
            CR 1020 Bank Operating Account (Net Released)
            CR 1100 Member Subscriptions Receivable (if any pending dues were deducted)
        """
        t_date = transaction_date or date.today()
        net_release = quantize_currency(net_payout_amount)
        deductions = quantize_currency(deductions_amount)
        gross_prize = quantize_currency(net_release + deductions)

        target_asset_account = COA_CASH if payment_method == PaymentMethod.CASH else COA_BANK
        target_account_name = "Cash on Hand" if payment_method == PaymentMethod.CASH else "Bank Operating Account"

        lines: List[JournalLine] = [
            JournalLine(
                account_code=COA_PRIZE_PAYABLE,
                account_name=f"Prize Money Payable ({member_code})",
                debit_amount=gross_prize,
                credit_amount=Decimal('0.00'),
                member_id=member_id,
                memo=f"Disbursement of prize money for {scheme_code}",
            ),
            JournalLine(
                account_code=target_asset_account,
                account_name=target_account_name,
                debit_amount=Decimal('0.00'),
                credit_amount=net_release,
                memo=f"Prize money released to {member_code} via {payment_method.value.upper()}",
            ),
        ]

        if deductions > Decimal('0.00'):
            lines.append(
                JournalLine(
                    account_code=COA_MEMBER_RECEIVABLE,
                    account_name=f"Member Subscriptions Receivable ({member_code})",
                    debit_amount=Decimal('0.00'),
                    credit_amount=deductions,
                    member_id=member_id,
                    memo=f"Deduction of pending dues from prize disbursement",
                )
            )

        entry = JournalEntry(
            entry_number=entry_number,
            transaction_date=t_date,
            description=f"Prize money disbursement to {member_code} for {scheme_code}",
            reference_entity_type="payout",
            reference_entity_id=payout_id,
            lines=lines,
        )
        entry.validate_balance()
        return entry

    @staticmethod
    def create_reversal_entry(
        original_entry: JournalEntry,
        reversal_entry_number: str,
        reason: str,
        authorizer_id: str,
        transaction_date: Optional[date] = None,
    ) -> JournalEntry:
        """
        EVENT 5: Transaction Reversal
        Creates an exact offsetting journal entry where original debits become credits
        and original credits become debits.
        """
        t_date = transaction_date or date.today()
        offsetting_lines: List[JournalLine] = []

        for line in original_entry.lines:
            # Swap debit and credit
            offsetting_lines.append(
                JournalLine(
                    account_code=line.account_code,
                    account_name=line.account_name,
                    debit_amount=line.credit_amount,
                    credit_amount=line.debit_amount,
                    member_id=line.member_id,
                    memo=f"REVERSAL of JE #{original_entry.entry_number}: {reason}",
                )
            )

        entry = JournalEntry(
            entry_number=reversal_entry_number,
            transaction_date=t_date,
            description=f"Reversal of JE #{original_entry.entry_number}. Reason: {reason}",
            reference_entity_type="reversal",
            reference_entity_id=original_entry.id,
            lines=offsetting_lines,
            is_reversal=True,
            reversed_entry_id=original_entry.id,
            created_by=authorizer_id,
        )
        entry.validate_balance()
        return entry

