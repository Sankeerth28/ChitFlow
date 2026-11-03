"""
Deterministic Unit Tests for ChitFlow Calculation Engine
Directly verifies Acceptance Criteria 1, 2, 4, 6, 7, 8, 14, 18 of PRD v1.0.
"""

import unittest
from decimal import Decimal
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.calc_engine import (
    ChitSchemeConfig,
    calculate_auction,
    generate_auction_journal_entry,
    CalculationValidationError,
    StatutoryComplianceError,
    MAX_STATUTORY_COMMISSION_PERCENT,
    MAX_STATUTORY_DISCOUNT_PERCENT,
)


class TestChitFlowCalculationEngine(unittest.TestCase):

    def setUp(self):
        # PRD Reference Scheme A: 10 Months, ₹1,00,000 Chit Value, 10 Members, ₹10,000 Subscription
        self.scheme_a = ChitSchemeConfig(
            chit_value=Decimal('100000.00'),
            duration_months=10,
            total_members=10,
            monthly_subscription=Decimal('10000.00'),
            commission_percentage=Decimal('4.00'),
            max_discount_percentage=Decimal('30.00'),
        )

        # PRD Reference Scheme B: 20 Months, ₹1,00,000 Chit Value, 20 Members, ₹5,000 Subscription
        self.scheme_b = ChitSchemeConfig(
            chit_value=Decimal('100000.00'),
            duration_months=20,
            total_members=20,
            monthly_subscription=Decimal('5000.00'),
            commission_percentage=Decimal('4.00'),
            max_discount_percentage=Decimal('30.00'),
        )

    def test_prd_scheme_a_canonical_case(self):
        """
        Verify PRD Scheme A (10 Months):
        - Chit Value: ₹1,00,000
        - Winning Payout: ₹74,000
        - Auction Discount: ₹26,000
        - Organiser Commission: ₹4,000 (4%)
        - Member Dividend Pool: ₹22,000
        - Dividend per Member: ₹2,200
        - Net Monthly Contribution: ₹7,800
        - Rounding Residual: ₹0.00
        """
        result = calculate_auction(
            scheme=self.scheme_a,
            auction_number=2,
            winning_bid_discount=Decimal('26000.00'),
        )

        self.assertEqual(result.auction_number, 2)
        self.assertEqual(result.chit_value, Decimal('100000.00'))
        self.assertEqual(result.winning_bid_discount, Decimal('26000.00'))
        self.assertEqual(result.winning_payout, Decimal('74000.00'))
        self.assertEqual(result.foreman_commission, Decimal('4000.00'))
        self.assertEqual(result.member_dividend_pool, Decimal('22000.00'))
        self.assertEqual(result.eligible_members_count, 10)
        self.assertEqual(result.dividend_per_member, Decimal('2200.00'))
        self.assertEqual(result.net_monthly_contribution, Decimal('7800.00'))
        self.assertEqual(result.rounding_residual, Decimal('0.00'))
        self.assertEqual(result.discount_percentage, Decimal('26.00'))

        # Verify Journal Entry Generation
        je = generate_auction_journal_entry("SCHEME-A", result, "M-005")
        self.assertTrue(je.is_balanced)
        self.assertEqual(je.total_debit, Decimal('100000.00'))
        self.assertEqual(je.total_credit, Decimal('100000.00'))

    def test_prd_scheme_b_canonical_case(self):
        """
        Verify PRD Scheme B (20 Months):
        - Chit Value: ₹1,00,000
        - Winning Payout: ₹71,000
        - Auction Discount: ₹29,000
        - Organiser Commission: ₹4,000 (4%)
        - Member Dividend Pool: ₹25,000
        - Dividend per Member: ₹1,250
        - Net Monthly Contribution: ₹3,750
        - Rounding Residual: ₹0.00
        """
        result = calculate_auction(
            scheme=self.scheme_b,
            auction_number=2,
            winning_bid_discount=Decimal('29000.00'),
        )

        self.assertEqual(result.auction_number, 2)
        self.assertEqual(result.chit_value, Decimal('100000.00'))
        self.assertEqual(result.winning_bid_discount, Decimal('29000.00'))
        self.assertEqual(result.winning_payout, Decimal('71000.00'))
        self.assertEqual(result.foreman_commission, Decimal('4000.00'))
        self.assertEqual(result.member_dividend_pool, Decimal('25000.00'))
        self.assertEqual(result.eligible_members_count, 20)
        self.assertEqual(result.dividend_per_member, Decimal('1250.00'))
        self.assertEqual(result.net_monthly_contribution, Decimal('3750.00'))
        self.assertEqual(result.rounding_residual, Decimal('0.00'))
        self.assertEqual(result.discount_percentage, Decimal('29.00'))

        # Verify Journal Entry Generation
        je = generate_auction_journal_entry("SCHEME-B", result, "M-012")
        self.assertTrue(je.is_balanced)
        self.assertEqual(je.total_debit, Decimal('100000.00'))
        self.assertEqual(je.total_credit, Decimal('100000.00'))

    def test_foreman_first_month_entitlement_section_15(self):
        """
        Under Section 15 of Chit Funds Act, 1982:
        Auction #1 is reserved for the Foreman without auction or discount.
        Payout = 100% of Chit Value.
        """
        result = calculate_auction(
            scheme=self.scheme_a,
            auction_number=1,
        )

        self.assertTrue(result.is_foreman_entitlement_auction)
        self.assertEqual(result.winning_payout, Decimal('100000.00'))
        self.assertEqual(result.winning_bid_discount, Decimal('0.00'))
        self.assertEqual(result.foreman_commission, Decimal('0.00'))
        self.assertEqual(result.member_dividend_pool, Decimal('0.00'))
        self.assertEqual(result.dividend_per_member, Decimal('0.00'))
        self.assertEqual(result.net_monthly_contribution, Decimal('10000.00'))
        self.assertEqual(result.rounding_residual, Decimal('0.00'))

        je = generate_auction_journal_entry("SCHEME-A", result, "FOREMAN")
        self.assertTrue(je.is_balanced)
        self.assertEqual(je.total_debit, Decimal('100000.00'))
        self.assertEqual(je.total_credit, Decimal('100000.00'))

    def test_statutory_commission_ceiling_section_21(self):
        """
        Under Section 21(1)(b) of the Chit Funds Act, 1982:
        Foreman commission cannot exceed 5% of chit value.
        """
        # Commission at exactly 5% is valid
        valid_scheme = ChitSchemeConfig(
            chit_value=Decimal('100000.00'),
            duration_months=10,
            total_members=10,
            monthly_subscription=Decimal('10000.00'),
            commission_percentage=Decimal('5.00'),
        )
        self.assertEqual(valid_scheme.commission_percentage, Decimal('5.00'))

        # Commission at 5.01% must raise StatutoryComplianceError
        with self.assertRaises(StatutoryComplianceError):
            ChitSchemeConfig(
                chit_value=Decimal('100000.00'),
                duration_months=10,
                total_members=10,
                monthly_subscription=Decimal('10000.00'),
                commission_percentage=Decimal('5.01'),
            )

    def test_statutory_discount_ceiling_2019_amendment(self):
        """
        Under Section 6 of the Chit Funds (Amendment) Act, 2019:
        The maximum discount allowed in any auction cannot exceed 30% of chit value.
        """
        # Scheme configuration exceeding 30% must fail
        with self.assertRaises(StatutoryComplianceError):
            ChitSchemeConfig(
                chit_value=Decimal('100000.00'),
                duration_months=10,
                total_members=10,
                monthly_subscription=Decimal('10000.00'),
                max_discount_percentage=Decimal('30.01'),
            )

        # Bid discount of ₹30,000 (30%) is valid
        result_max = calculate_auction(
            scheme=self.scheme_a,
            auction_number=3,
            winning_bid_discount=Decimal('30000.00'),
        )
        self.assertEqual(result_max.winning_bid_discount, Decimal('30000.00'))
        self.assertEqual(result_max.winning_payout, Decimal('70000.00'))

        # Bid discount of ₹30,000.01 (30.00001%) must be rejected
        with self.assertRaises(StatutoryComplianceError):
            calculate_auction(
                scheme=self.scheme_a,
                auction_number=3,
                winning_bid_discount=Decimal('30000.01'),
            )

    def test_rounding_residual_handling(self):
        """
        Test explicit tracking of fractional paise residual into Rounding Suspense Account.
        Example: 17 members sharing a dividend pool of ₹25,000.
        ₹25,000 / 17 = 1470.588235... -> ₹1,470.58 per member.
        17 * ₹1,470.58 = ₹24,999.86.
        Residual Delta = ₹25,000.00 - ₹24,999.86 = ₹0.14.
        """
        scheme_odd = ChitSchemeConfig(
            chit_value=Decimal('85000.00'),
            duration_months=17,
            total_members=17,
            monthly_subscription=Decimal('5000.00'),
            commission_percentage=Decimal('4.00'),
        )

        result = calculate_auction(
            scheme=scheme_odd,
            auction_number=2,
            winning_bid_discount=Decimal('25000.00'),
        )

        # Commission: 4% of 85,000 = 3,400.00
        self.assertEqual(result.foreman_commission, Decimal('3400.00'))
        # Dividend Pool: 25,000 - 3,400 = 21,600.00
        self.assertEqual(result.member_dividend_pool, Decimal('21600.00'))
        # 21,600 / 17 = 1270.588235... -> floor to 1270.58
        self.assertEqual(result.dividend_per_member, Decimal('1270.58'))
        # Distributed: 17 * 1270.58 = 21,599.86
        # Residual: 21,600.00 - 21,599.86 = 0.14
        self.assertEqual(result.rounding_residual, Decimal('0.14'))
        # Net Contribution: 5000 - 1270.58 = 3729.42
        self.assertEqual(result.net_monthly_contribution, Decimal('3729.42'))

        # Verify Journal Entry is strictly balanced despite odd rounding
        je = generate_auction_journal_entry("SCHEME-ODD", result, "M-007")
        self.assertTrue(je.is_balanced)
        self.assertEqual(je.total_debit, Decimal('85000.00'))
        self.assertEqual(je.total_credit, Decimal('85000.00'))

    def test_invalid_scheme_configuration_rejected(self):
        """Verify mismatched subscription and negative values are rejected."""
        # 10 members * 9,000 = 90,000 != 100,000
        with self.assertRaises(CalculationValidationError):
            ChitSchemeConfig(
                chit_value=Decimal('100000.00'),
                duration_months=10,
                total_members=10,
                monthly_subscription=Decimal('9000.00'),
            )

        # Negative chit value
        with self.assertRaises(CalculationValidationError):
            ChitSchemeConfig(
                chit_value=Decimal('-100000.00'),
                duration_months=10,
                total_members=10,
                monthly_subscription=Decimal('-10000.00'),
            )


if __name__ == '__main__':
    unittest.main()

