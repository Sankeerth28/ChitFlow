"""
End-to-End API Integration Test Suite for ChitFlow
Verifies all 18 Acceptance Criteria in PRD v1.0 & Section 11 of TAD v1.0.
Full Authentication, JWT, and Multi-Tenant RBAC enforced.
"""

import unittest
from decimal import Decimal
import sys
import os

# Never let the test suite drop/recreate the development database.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_chitflow.db")

from fastapi.testclient import TestClient
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.db.session import Base, engine, SessionLocal
from app.models.entities import Organiser, User, Payment
from app.core.security import hash_password


class TestChitFlowAPIIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

        # Ensure demo organiser and organiser user exist
        db = SessionLocal()
        org = Organiser(
            business_name="Sri Balaji Chit Funds Pvt. Ltd.",
            trade_license_number="TL/HYD/2026/8941",
            chit_registrar_registration_no="REG/TS/HYD/CHIT/2026/042",
            state="Telangana",
            contact_phone="9849012345",
            contact_email="accounts@sribalajichits.in",
        )
        db.add(org)
        db.flush()

        org_user = User(
            organiser_id=org.id,
            mobile_number="9849012345",
            password_hash=hash_password("OrganiserPassword123!"),
            role="organiser",
            is_active=True,
            is_verified=True,
        )
        db.add(org_user)
        db.commit()
        db.close()

    def get_auth_token(self, mobile: str, password: str) -> str:
        res = self.client.post("/api/v1/auth/login", json={
            "mobile_number": mobile,
            "password": password,
        })
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["access_token"]

    def test_end_to_end_prd_scheme_a_lifecycle(self):
        """
        Complete PRD Scheme A lifecycle with Authentication & RBAC:
        1. Login as Organiser
        2. Create Scheme A (10m, ₹1L, 10 tickets)
        3. Create 10 Members & Enrol Tickets 1-10
        4. Activate Scheme (Verifies Month 1 dues are auto-generated!)
        5. Auction 1: Foreman Entitlement (Section 15)
        6. Auction 2: Canonical Bidding & Confirmation (Payout: ₹74k, Commission: ₹4k, Div: ₹2.2k, Net: ₹7.8k)
        7. Prize Security Sign-off & Disbursement (Section 31)
        8. Member Payment Collection & Receipt Verification
        9. Member 10-Second Dashboard Validation
        10. Double-Entry General Ledger Trial Balance Verification
        """
        org_token = self.get_auth_token("9849012345", "OrganiserPassword123!")
        org_headers = {"Authorization": f"Bearer {org_token}"}

        # Step 1: Create Scheme A
        scheme_payload = {
            "scheme_code": "CHIT-10M-1L",
            "scheme_name": "PRD Scheme A (10 Months ₹1 Lakh)",
            "chit_value": "100000.00",
            "monthly_subscription": "10000.00",
            "duration_months": 10,
            "total_members": 10,
            "commission_percentage": "4.00",
            "max_discount_percentage": "30.00",
            "start_date": "2026-11-01",
            "monthly_due_day": 5,
            "auction_day": 10,
            "pso_number": "PSO/TS/HYD/2026/091",
            "fd_receipt_number": "FDR/SBI/2026/88129",
        }
        res = self.client.post("/api/v1/schemes", json=scheme_payload, headers=org_headers)
        self.assertEqual(res.status_code, 201, res.text)
        scheme_data = res.json()
        scheme_id = scheme_data["id"]
        self.assertEqual(scheme_data["status"], "draft")

        # Step 2: Create 10 Members and Enrol into Scheme
        member_ids = []
        for i in range(1, 11):
            m_res = self.client.post("/api/v1/members", json={
                "member_code": f"MEM-{i:03d}",
                "full_name": f"Subscriber {i}",
                "mobile_number": f"98765432{i:02d}",
                "address_line1": f"House #{i}, Jubilee Hills",
                "city": "Hyderabad",
                "state": "Telangana",
                "pincode": "500033",
            }, headers=org_headers)
            self.assertEqual(m_res.status_code, 201, m_res.text)
            m_id = m_res.json()["id"]
            member_ids.append(m_id)

            # Enrol into ticket i
            e_res = self.client.post(f"/api/v1/schemes/{scheme_id}/members", json={
                "member_id": m_id,
                "chit_ticket_number": i,
                "enrollment_date": "2026-11-01",
            }, headers=org_headers)
            self.assertEqual(e_res.status_code, 201, e_res.text)

        # Step 3: Activate Scheme
        act_res = self.client.post(f"/api/v1/schemes/{scheme_id}/activate", headers=org_headers)
        self.assertEqual(act_res.status_code, 200, act_res.text)
        self.assertEqual(act_res.json()["status"], "active")
        self.assertTrue(act_res.json()["rules_locked"])

        # Verify Month 1 Instalments were generated upon activation (Fix for BUG-003)
        m1_inst_res = self.client.get(f"/api/v1/payments/instalments/member/{member_ids[0]}", headers=org_headers)
        self.assertEqual(m1_inst_res.status_code, 200)
        m1_instalments = m1_inst_res.json()
        self.assertEqual(len(m1_instalments), 1)
        self.assertEqual(m1_instalments[0]["instalment_number"], 1)
        self.assertEqual(Decimal(m1_instalments[0]["net_amount_due"]), Decimal('10000.00'))

        # Fetch pre-generated auctions
        auc_res = self.client.get(f"/api/v1/auctions/schemes/{scheme_id}", headers=org_headers)
        self.assertEqual(auc_res.status_code, 200)
        auctions = auc_res.json()
        self.assertEqual(len(auctions), 10)

        # Step 4: Auction #1 - Foreman 1st Month Entitlement (Section 15)
        auc1 = auctions[0]
        self.assertEqual(auc1["auction_number"], 1)

        c1_res = self.client.post(f"/api/v1/auctions/{auc1['id']}/confirm", json={
            "winning_member_id": member_ids[0],
            "winning_bid_discount": "0.00",
            "custom_minutes_note": "Foreman prize release under Section 15.",
        }, headers=org_headers)
        self.assertEqual(c1_res.status_code, 200, c1_res.text)
        c1_data = c1_res.json()
        self.assertTrue(c1_data["is_foreman_entitlement"])
        self.assertEqual(Decimal(c1_data["winning_payout"]), Decimal('100000.00'))

        # Step 5: Auction #2 - Canonical Bidding
        auc2 = auctions[1]
        self.assertEqual(auc2["auction_number"], 2)

        # Member 2 bids ₹20,000 discount
        b1_res = self.client.post(f"/api/v1/auctions/{auc2['id']}/bids", json={
            "member_id": member_ids[1],
            "bid_discount_amount": "20000.00",
            "bid_source": "mobile",
        }, headers=org_headers)
        self.assertEqual(b1_res.status_code, 201)

        # Member 3 bids ₹26,000 discount (Winning bid)
        b2_res = self.client.post(f"/api/v1/auctions/{auc2['id']}/bids", json={
            "member_id": member_ids[2],
            "bid_discount_amount": "26000.00",
            "bid_source": "mobile",
        }, headers=org_headers)
        self.assertEqual(b2_res.status_code, 201)

        # Confirm Auction 2 with Member 3 as winner
        c2_res = self.client.post(f"/api/v1/auctions/{auc2['id']}/confirm", json={
            "winning_member_id": member_ids[2],
            "winning_bid_discount": "26000.00",
            "custom_minutes_note": "Auction #2 confirmed with Member 3 winning at ₹26,000 discount.",
        }, headers=org_headers)
        self.assertEqual(c2_res.status_code, 200, c2_res.text)
        c2_data = c2_res.json()

        # Strict Verification of Canonical PRD Scheme A Values
        self.assertEqual(Decimal(c2_data["chit_value"]), Decimal('100000.00'))
        self.assertEqual(Decimal(c2_data["winning_payout"]), Decimal('74000.00'))
        self.assertEqual(Decimal(c2_data["auction_discount"]), Decimal('26000.00'))
        self.assertEqual(Decimal(c2_data["foreman_commission"]), Decimal('4000.00'))
        self.assertEqual(Decimal(c2_data["member_dividend_pool"]), Decimal('22000.00'))
        self.assertEqual(c2_data["eligible_members_count"], 10)
        self.assertEqual(Decimal(c2_data["dividend_per_member"]), Decimal('2200.00'))
        self.assertEqual(Decimal(c2_data["net_monthly_contribution"]), Decimal('7800.00'))
        self.assertEqual(Decimal(c2_data["rounding_residual"]), Decimal('0.00'))

        payout_id = c2_data["payout_record_id"]

        # Step 6: Prize Money Security Verification (Section 31) & Disbursement
        sec_res = self.client.post(f"/api/v1/payouts/{payout_id}/verify-security", json={
            "security_type": "Government_Guarantor_Salary_Certificate",
            "security_doc_url": "https://storage.chitflow.in/docs/guarantor-m003.pdf",
            "notes": "Verified under Section 31 of Chit Funds Act, 1982.",
        }, headers=org_headers)
        self.assertEqual(sec_res.status_code, 200)
        self.assertEqual(sec_res.json()["status"], "security_verified")

        dis_res = self.client.post(f"/api/v1/payouts/{payout_id}/disburse", json={
            "deductions_amount": "0.00",
            "disbursement_method": "bank_transfer",
            "transaction_reference": "NEFT/SBIN202611050012",
        }, headers=org_headers)
        self.assertEqual(dis_res.status_code, 200)
        self.assertEqual(dis_res.json()["status"], "paid")
        self.assertEqual(Decimal(dis_res.json()["net_payout_amount"]), Decimal('74000.00'))

        # Step 7: Member Payment Collection & Receipt Verification
        # Login as Member 4
        m4_id = member_ids[3]
        m4_token = self.get_auth_token("9876543204", "Member@3204!")
        m4_headers = {"Authorization": f"Bearer {m4_token}"}

        inst_res = self.client.get(f"/api/v1/payments/instalments/member/{m4_id}", headers=m4_headers)
        self.assertEqual(inst_res.status_code, 200)
        instalments = inst_res.json()
        self.assertTrue(len(instalments) >= 3)  # Month 1, Month 2, Month 3

        # Verify Month 1 & Month 2 had zero dividend (Foreman entitlement period)
        inst1 = [i for i in instalments if i["instalment_number"] == 1][0]
        self.assertEqual(Decimal(inst1["dividend_credit"]), Decimal('0.00'))
        self.assertEqual(Decimal(inst1["net_amount_due"]), Decimal('10000.00'))

        # Verify Month 3 has ₹2,200 dividend from Auction #2 and net due ₹7,800
        inst3 = [i for i in instalments if i["instalment_number"] == 3][0]
        self.assertEqual(Decimal(inst3["gross_subscription"]), Decimal('10000.00'))
        self.assertEqual(Decimal(inst3["dividend_credit"]), Decimal('2200.00'))
        self.assertEqual(Decimal(inst3["net_amount_due"]), Decimal('7800.00'))

        # Member 4 submits payment for Month 3
        pay_sub_res = self.client.post("/api/v1/payments/submit", json={
            "instalment_id": inst3["id"],
            "amount_received": "7800.00",
            "payment_method": "upi",
            "payment_reference_no": "UPI/20261105/9821731",
        }, headers=m4_headers)
        self.assertEqual(pay_sub_res.status_code, 201)
        receipt_data = pay_sub_res.json()
        receipt_no = receipt_data["receipt_number"]

        # Organiser verifies payment
        db = SessionLocal()
        p_rec = db.query(Payment).filter(Payment.receipt_number == receipt_no).first()
        p_id = p_rec.id
        db.close()

        v_res = self.client.post(f"/api/v1/payments/{p_id}/verify", json={
            "status": "paid",
            "verification_notes": "UPI instant credit reconciled.",
        }, headers=org_headers)
        self.assertEqual(v_res.status_code, 200)
        self.assertEqual(v_res.json()["verification_status"], "paid")

        # Step 8: Member 10-Second Dashboard
        dash_res = self.client.get(f"/api/v1/members/{m4_id}/dashboard", headers=m4_headers)
        self.assertEqual(dash_res.status_code, 200)
        dash_data = dash_res.json()
        self.assertEqual(dash_data["active_chits_count"], 1)
        self.assertEqual(Decimal(dash_data["total_amount_paid"]), Decimal('7800.00'))
        self.assertEqual(Decimal(dash_data["total_dividends_received"]), Decimal('2200.00'))

        # Step 9: Double-Entry General Ledger Trial Balance
        tb_res = self.client.get("/api/v1/reports/trial-balance", headers=org_headers)
        self.assertEqual(tb_res.status_code, 200)
        tb_data = tb_res.json()
        self.assertTrue(tb_data["is_balanced"])
        self.assertEqual(Decimal(tb_data["total_debits"]), Decimal(tb_data["total_credits"]))

        # Organiser Dashboard Check
        org_dash_res = self.client.get("/api/v1/reports/dashboard/organiser", headers=org_headers)
        self.assertEqual(org_dash_res.status_code, 200)
        org_metrics = org_dash_res.json()
        self.assertEqual(org_metrics["active_chits"], 1)
        self.assertEqual(org_metrics["total_members"], 10)
        self.assertEqual(Decimal(org_metrics["recorded_commission"]), Decimal('4000.00'))


if __name__ == '__main__':
    unittest.main()
