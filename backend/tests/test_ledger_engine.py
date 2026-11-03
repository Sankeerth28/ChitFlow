"""
Unit Tests for Double-Entry Accounting Ledger Engine
Verifies Section 4 of Technical Architecture Document:
- Event 1: Monthly Subscription Billing
- Event 2: Member Payment Received
- Event 4: Prize Money Disbursed
- Event 5: Transaction Reversal
- Invariant & balance enforcement
"""

import unittest
from decimal import Decimal
import sys
import os
from datetime import date

# Never let the test suite drop/recreate the development database.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_chitflow.db")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.ledger_engine import (
    LedgerEngine,
    JournalLine,
    JournalEntry,
    PaymentMethod,
    COA_BANK,
    COA_MEMBER_RECEIVABLE,
    COA_MEMBER_DIVIDEND_EXPENSE,
    COA_PRIZE_PAYABLE,
    COA_COLLECTION_POOL,
)
from app.core.calc_engine import CalculationValidationError


class TestLedgerEngine(unittest.TestCase):

    def test_event_1_subscription_billing(self):
        """Event 1: 10 members billed ₹10,000 each for Month #1."""
        member_dues = [
            {"member_id": f"mem-{i}", "member_code": f"M{i:03d}", "gross_subscription": Decimal('10000.00')}
            for i in range(1, 11)
        ]

        entry = LedgerEngine.create_subscription_billing_entry(
            entry_number="JE-SUB-001",
            scheme_code="CHIT-10M-1L",
            instalment_number=1,
            member_dues=member_dues,
            transaction_date=date(2026, 11, 1),
        )

        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.total_debits, Decimal('100000.00'))
        self.assertEqual(entry.total_credits, Decimal('100000.00'))
        self.assertEqual(len(entry.lines), 11)  # 10 DR receivables + 1 CR pool

    def test_event_2_payment_received(self):
        """Event 2: Member pays net ₹7,800 + ₹2,200 dividend applied = ₹10,000 settled."""
        entry = LedgerEngine.create_payment_received_entry(
            entry_number="JE-PAY-001",
            receipt_number="RCP-2026-0001",
            scheme_code="CHIT-10M-1L",
            member_id="mem-1",
            member_code="M001",
            net_amount_paid=Decimal('7800.00'),
            dividend_applied=Decimal('2200.00'),
            payment_method=PaymentMethod.UPI,
            transaction_date=date(2026, 11, 5),
        )

        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.total_debits, Decimal('100000.00') / Decimal('10'))  # 10,000.00
        self.assertEqual(entry.total_credits, Decimal('10000.00'))

        # Verify lines
        bank_line = [l for l in entry.lines if l.account_code == COA_BANK][0]
        div_line = [l for l in entry.lines if l.account_code == COA_MEMBER_DIVIDEND_EXPENSE][0]
        rec_line = [l for l in entry.lines if l.account_code == COA_MEMBER_RECEIVABLE][0]

        self.assertEqual(bank_line.debit_amount, Decimal('7800.00'))
        self.assertEqual(div_line.debit_amount, Decimal('2200.00'))
        self.assertEqual(rec_line.credit_amount, Decimal('10000.00'))

    def test_event_4_payout_disbursed_with_deductions(self):
        """Event 4: Payout ₹74,000 disbursed, ₹4,000 pending dues deducted, ₹70,000 bank release."""
        entry = LedgerEngine.create_payout_disbursed_entry(
            entry_number="JE-PO-001",
            payout_id="payout-999",
            scheme_code="CHIT-10M-1L",
            member_id="mem-3",
            member_code="M003",
            net_payout_amount=Decimal('70000.00'),
            deductions_amount=Decimal('4000.00'),
            payment_method=PaymentMethod.BANK_TRANSFER,
            transaction_date=date(2026, 11, 15),
        )

        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.total_debits, Decimal('74000.00'))
        self.assertEqual(entry.total_credits, Decimal('74000.00'))

        prize_line = [l for l in entry.lines if l.account_code == COA_PRIZE_PAYABLE][0]
        bank_line = [l for l in entry.lines if l.account_code == COA_BANK][0]
        ded_line = [l for l in entry.lines if l.account_code == COA_MEMBER_RECEIVABLE][0]

        self.assertEqual(prize_line.debit_amount, Decimal('74000.00'))
        self.assertEqual(bank_line.credit_amount, Decimal('70000.00'))
        self.assertEqual(ded_line.credit_amount, Decimal('4000.00'))

    def test_event_5_reversal_entry(self):
        """Event 5: Dishonoured payment reversed."""
        original_entry = LedgerEngine.create_payment_received_entry(
            entry_number="JE-PAY-002",
            receipt_number="RCP-2026-0002",
            scheme_code="CHIT-10M-1L",
            member_id="mem-2",
            member_code="M002",
            net_amount_paid=Decimal('7800.00'),
            dividend_applied=Decimal('2200.00'),
            payment_method=PaymentMethod.CHEQUE,
        )

        reversal_entry = LedgerEngine.create_reversal_entry(
            original_entry=original_entry,
            reversal_entry_number="JE-REV-001",
            reason="Dishonoured Cheque #4921",
            authorizer_id="admin-user-1",
            transaction_date=date(2026, 11, 8),
        )

        self.assertTrue(reversal_entry.is_reversal)
        self.assertEqual(reversal_entry.reversed_entry_id, original_entry.id)
        self.assertTrue(reversal_entry.is_balanced)
        self.assertEqual(reversal_entry.total_debits, Decimal('10000.00'))
        self.assertEqual(reversal_entry.total_credits, Decimal('10000.00'))

        # In original, Bank was debited 7800; in reversal, Bank must be credited 7800
        rev_bank_line = [l for l in reversal_entry.lines if l.account_code == COA_BANK][0]
        self.assertEqual(rev_bank_line.credit_amount, Decimal('7800.00'))
        self.assertEqual(rev_bank_line.debit_amount, Decimal('0.00'))

    def test_invalid_unbalanced_entry_rejected(self):
        """Unbalanced journal entry raises CalculationValidationError."""
        entry = JournalEntry(
            entry_number="JE-BAD",
            lines=[
                JournalLine(account_code="1020", account_name="Bank", debit_amount=Decimal('100.00')),
                JournalLine(account_code="1100", account_name="Receivable", credit_amount=Decimal('90.00')),
            ]
        )
        self.assertFalse(entry.is_balanced)
        with self.assertRaises(CalculationValidationError):
            entry.validate_balance()


if __name__ == '__main__':
    unittest.main()

