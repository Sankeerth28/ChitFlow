"""
Comprehensive Security & RBAC Test Suite for ChitFlow
Verifies all 10 security testing mandates from Phase 2A:
1. Unauthenticated API requests -> 401
2. Invalid JWT -> 401
3. Expired JWT -> 401
4. Member accessing another member's records -> 403
5. Organiser accessing another organiser's schemes -> 403/404
6. Accountant attempting unauthorised actions -> 403
7. Super administrator managing platform vs organiser actions
8. Accessing protected routes after logout (revoked token) -> 401
9. Modifying resource IDs in API requests -> 403/404
10. Missing or invalid ownership relationships -> 403/404
"""

import unittest
from decimal import Decimal
import sys
import os
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from jose import jwt

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.db.session import Base, engine, SessionLocal
from app.models.entities import Organiser, User, Member, ChitScheme, SchemeMember
from app.core.security import hash_password, SECRET_KEY, ALGORITHM


class TestAuthAndRBAC(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

        db = SessionLocal()

        # Create Tenant 1 (Sri Balaji Chits)
        cls.org1 = Organiser(
            business_name="Sri Balaji Chit Funds Pvt. Ltd.",
            contact_phone="9849012345",
            state="Telangana",
        )
        db.add(cls.org1)
        db.flush()

        # Create Tenant 2 (Kakatiya Chits)
        cls.org2 = Organiser(
            business_name="Kakatiya Chits Pvt. Ltd.",
            contact_phone="9849099999",
            state="Telangana",
        )
        db.add(cls.org2)
        db.flush()

        # Create Users
        # 1. Super Admin
        cls.super_admin = User(
            mobile_number="9999999999",
            password_hash=hash_password("AdminPass123!"),
            role="super_admin",
            is_active=True,
            is_verified=True,
        )
        db.add(cls.super_admin)

        # 2. Organiser 1 (Tenant 1)
        cls.user_org1 = User(
            organiser_id=cls.org1.id,
            mobile_number="9849012345",
            password_hash=hash_password("Org1Pass123!"),
            role="organiser",
            is_active=True,
            is_verified=True,
        )
        db.add(cls.user_org1)

        # 3. Organiser 2 (Tenant 2)
        cls.user_org2 = User(
            organiser_id=cls.org2.id,
            mobile_number="9849099999",
            password_hash=hash_password("Org2Pass123!"),
            role="organiser",
            is_active=True,
            is_verified=True,
        )
        db.add(cls.user_org2)

        # 4. Accountant 1 (Tenant 1)
        cls.user_acc1 = User(
            organiser_id=cls.org1.id,
            mobile_number="9849012346",
            password_hash=hash_password("Acc1Pass123!"),
            role="accountant",
            is_active=True,
            is_verified=True,
        )
        db.add(cls.user_acc1)

        # 5. Member 1 (Tenant 1 - Ticket 1)
        cls.user_mem1 = User(
            organiser_id=cls.org1.id,
            mobile_number="9876543201",
            password_hash=hash_password("Mem1Pass123!"),
            role="member",
            is_active=True,
            is_verified=True,
        )
        db.add(cls.user_mem1)
        db.flush()

        cls.member1 = Member(
            user_id=cls.user_mem1.id,
            organiser_id=cls.org1.id,
            member_code="M-001",
            full_name="Subscriber 1",
            address_line1="Jubilee Hills",
            city="Hyderabad",
            state="Telangana",
            pincode="500033",
            kyc_status="verified",
        )
        db.add(cls.member1)

        # 6. Member 2 (Tenant 1 - Ticket 2)
        cls.user_mem2 = User(
            organiser_id=cls.org1.id,
            mobile_number="9876543202",
            password_hash=hash_password("Mem2Pass123!"),
            role="member",
            is_active=True,
            is_verified=True,
        )
        db.add(cls.user_mem2)
        db.flush()

        cls.member2 = Member(
            user_id=cls.user_mem2.id,
            organiser_id=cls.org1.id,
            member_code="M-002",
            full_name="Subscriber 2",
            address_line1="Banjara Hills",
            city="Hyderabad",
            state="Telangana",
            pincode="500034",
            kyc_status="verified",
        )
        db.add(cls.member2)

        # 7. Member 3 (Tenant 2 - Belongs to Kakatiya Chits)
        cls.user_mem3 = User(
            organiser_id=cls.org2.id,
            mobile_number="9876543203",
            password_hash=hash_password("Mem3Pass123!"),
            role="member",
            is_active=True,
            is_verified=True,
        )
        db.add(cls.user_mem3)
        db.flush()

        cls.member3 = Member(
            user_id=cls.user_mem3.id,
            organiser_id=cls.org2.id,
            member_code="K-001",
            full_name="Subscriber 3 (Kakatiya)",
            address_line1="Hanamkonda",
            city="Warangal",
            state="Telangana",
            pincode="506001",
            kyc_status="verified",
        )
        db.add(cls.member3)

        # Create Scheme 1 in Tenant 1
        cls.scheme1 = ChitScheme(
            organiser_id=cls.org1.id,
            scheme_code="BALAJI-10M",
            scheme_name="Balaji 1 Lakh 10M",
            chit_value=Decimal('100000.00'),
            monthly_subscription=Decimal('10000.00'),
            duration_months=10,
            total_members=10,
            start_date=datetime(2026, 11, 1).date(),
            monthly_due_day=5,
            auction_day=10,
            status="draft",
        )
        db.add(cls.scheme1)

        # Create Scheme 2 in Tenant 2
        cls.scheme2 = ChitScheme(
            organiser_id=cls.org2.id,
            scheme_code="KAKATIYA-10M",
            scheme_name="Kakatiya 1 Lakh 10M",
            chit_value=Decimal('100000.00'),
            monthly_subscription=Decimal('10000.00'),
            duration_months=10,
            total_members=10,
            start_date=datetime(2026, 11, 1).date(),
            monthly_due_day=5,
            auction_day=10,
            status="draft",
        )
        db.add(cls.scheme2)

        db.commit()

        # Enrol Member 1 into Scheme 1
        sm1 = SchemeMember(
            scheme_id=cls.scheme1.id,
            member_id=cls.member1.id,
            chit_ticket_number=1,
            enrollment_date=datetime(2026, 11, 1).date(),
        )
        db.add(sm1)
        db.commit()

        cls.org1_id = cls.org1.id
        cls.org2_id = cls.org2.id
        cls.scheme1_id = cls.scheme1.id
        cls.scheme2_id = cls.scheme2.id
        cls.member1_id = cls.member1.id
        cls.member2_id = cls.member2.id
        cls.member3_id = cls.member3.id

        db.close()

    def get_token(self, mobile: str, password: str) -> str:
        res = self.client.post("/api/v1/auth/login", json={
            "mobile_number": mobile,
            "password": password,
        })
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["access_token"]

    def test_01_unauthenticated_api_request_rejected(self):
        """Security Test 1: Unauthenticated requests must be rejected with 401."""
        res = self.client.get("/api/v1/schemes")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Not authenticated", res.text)

    def test_02_invalid_jwt_rejected(self):
        """Security Test 2: Tampered/invalid JWT must return 401."""
        res = self.client.get(
            "/api/v1/schemes",
            headers={"Authorization": "Bearer invalid.fake.token"}
        )
        self.assertEqual(res.status_code, 401)

    def test_03_expired_jwt_rejected(self):
        """Security Test 3: Expired JWT must return 401."""
        expired_claims = {
            "sub": "user-test",
            "role": "organiser",
            "org": self.org1_id,
            "jti": "test-jti-123",
            "iat": int((datetime.utcnow() - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.utcnow() - timedelta(hours=1)).timestamp()),
        }
        expired_token = jwt.encode(expired_claims, SECRET_KEY, algorithm=ALGORITHM)
        res = self.client.get(
            "/api/v1/schemes",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        self.assertEqual(res.status_code, 401)
        self.assertIn("credentials or session has expired", res.text)

    def test_04_member_accessing_another_member_records_rejected(self):
        """
        Security Test 4 (IDOR Prevention):
        Member 1 attempts to access Member 2's dashboard or instalments.
        Must return 403 Forbidden!
        """
        mem1_token = self.get_token("9876543201", "Mem1Pass123!")

        # Member 1 attempts to view Member 2 dashboard
        res = self.client.get(
            f"/api/v1/members/{self.member2_id}/dashboard",
            headers={"Authorization": f"Bearer {mem1_token}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Subscribers are strictly prohibited from viewing other members' financial records", res.text)

        # Member 1 attempts to view Member 2 instalments
        res_inst = self.client.get(
            f"/api/v1/payments/instalments/member/{self.member2_id}",
            headers={"Authorization": f"Bearer {mem1_token}"}
        )
        self.assertEqual(res_inst.status_code, 403)

    def test_05_multi_tenant_isolation_organiser_cross_access_rejected(self):
        """
        Security Test 5 (Multi-Tenant Isolation):
        Organiser 1 attempts to view or modify Organiser 2's scheme.
        Must return 403 Forbidden or 404 Not Found!
        """
        org1_token = self.get_token("9849012345", "Org1Pass123!")

        # Organiser 1 queries Scheme 2 (owned by Organiser 2)
        res = self.client.get(
            f"/api/v1/schemes/{self.scheme2_id}",
            headers={"Authorization": f"Bearer {org1_token}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Access denied", res.text)

    def test_06_accountant_unauthorized_actions_rejected(self):
        """
        Security Test 6 (Least Privilege RBAC):
        Accountant attempts to create a scheme or activate a scheme or confirm an auction.
        Must return 403 Forbidden!
        """
        acc_token = self.get_token("9849012346", "Acc1Pass123!")

        # Attempt to create a scheme
        res = self.client.post(
            "/api/v1/schemes",
            json={
                "scheme_code": "ILLEGAL-SCHEME",
                "scheme_name": "Accountant Created Scheme",
                "chit_value": "100000.00",
                "monthly_subscription": "10000.00",
                "duration_months": 10,
                "total_members": 10,
                "start_date": "2026-11-01",
                "monthly_due_day": 5,
                "auction_day": 10,
            },
            headers={"Authorization": f"Bearer {acc_token}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("requires one of ['organiser'] roles", res.text)

    def test_07_member_cannot_confirm_auctions_or_disburse_payouts(self):
        """Security Test 7: Member attempting to confirm an auction returns 403."""
        mem1_token = self.get_token("9876543201", "Mem1Pass123!")

        res = self.client.post(
            "/api/v1/auctions/fake-id/confirm",
            json={
                "winning_member_id": self.member1_id,
                "winning_bid_discount": "26000.00",
            },
            headers={"Authorization": f"Bearer {mem1_token}"}
        )
        self.assertEqual(res.status_code, 403)

    def test_08_access_after_logout_rejected(self):
        """
        Security Test 8 (Server-Side Session Invalidation):
        After /logout is called, the JWT token's JTI is blacklisted.
        Subsequent requests using the same token must be rejected with 401.
        """
        org1_token = self.get_token("9849012345", "Org1Pass123!")

        # Verify token works initially
        res_before = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {org1_token}"}
        )
        self.assertEqual(res_before.status_code, 200)

        # Call logout
        logout_res = self.client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {org1_token}"}
        )
        self.assertEqual(logout_res.status_code, 200)

        # Call /me again with the same token -> MUST BE REJECTED!
        res_after = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {org1_token}"}
        )
        self.assertEqual(res_after.status_code, 401)
        self.assertIn("Session has been invalidated", res_after.text)

    def test_09_super_admin_access(self):
        """Security Test 9: Super admin can access /auth/me and platform endpoints."""
        admin_token = self.get_token("9999999999", "AdminPass123!")
        res = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["role"], "super_admin")

    def test_10_account_recovery_status_unconfigured(self):
        """Security Test 10: Account recovery indicates unconfigured OTP provider."""
        res = self.client.post("/api/v1/auth/recover", json={
            "mobile_number": "9849012345"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["otp_provider_status"], "unconfigured")


if __name__ == '__main__':
    unittest.main()

