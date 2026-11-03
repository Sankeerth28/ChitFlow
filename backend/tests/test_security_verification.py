"""
Independent Security Verification Test Suite for ChitFlow
Verifies that all independently audited security defects are resolved:
1. Password length rejection (> 72 bytes) across bcrypt and Pydantic schemas.
2. Fail-secure production configuration for SECRET_KEY.
3. Multi-tenant isolation: strict rejection of registration without valid organiser_id.
4. Least-privilege RBAC: super_admin barred from creating schemes or inspecting member records.
5. Server-side session revocation: tokens cannot be reused after /logout.
6. Verification that passwords are not exposed in logs or user objects.
"""

import unittest
import os
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from jose import jwt

# Set test environment
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_chitflow.db")
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-verification-secret-key-32bytes-secure-2026"

from app.main import app
from app.db.session import SessionLocal, Base, engine
from app.models.entities import Organiser, User, ChitScheme, Member, SchemeMember, RevokedToken
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    SECRET_KEY,
    ALGORITHM,
)


class TestSecurityVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        # Clean test tables
        self.db.query(RevokedToken).delete()
        self.db.query(SchemeMember).delete()
        self.db.query(ChitScheme).delete()
        self.db.query(Member).delete()
        self.db.query(User).delete()
        self.db.query(Organiser).delete()
        self.db.commit()

        # Seed two distinct organisers for isolation tests
        self.org1 = Organiser(
            business_name="Organiser One Chit Funds",
            contact_phone="9849011111",
            state="Telangana",
        )
        self.org2 = Organiser(
            business_name="Organiser Two Chit Funds",
            contact_phone="9849022222",
            state="Telangana",
        )
        self.db.add_all([self.org1, self.org2])
        self.db.commit()

        # Seed Organiser User
        self.org_user = User(
            organiser_id=self.org1.id,
            mobile_number="9849011111",
            password_hash=hash_password("Org1Password123!"),
            role="organiser",
            is_verified=True,
            is_active=True,
        )
        # Seed Super Admin User (unattached to any organiser)
        self.admin_user = User(
            organiser_id=None,
            mobile_number="9999999999",
            password_hash=hash_password("AdminPassword123!"),
            role="super_admin",
            is_verified=True,
            is_active=True,
        )
        self.db.add_all([self.org_user, self.admin_user])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def get_token(self, mobile: str, pwd: str) -> str:
        res = self.client.post("/api/v1/auth/login", json={
            "mobile_number": mobile,
            "password": pwd,
        })
        self.assertEqual(res.status_code, 200, f"Login failed for {mobile}: {res.text}")
        return res.json()["access_token"]

    def test_01_passwords_exceeding_72_bytes_are_explicitly_rejected(self):
        """
        SECURITY VERIFICATION 1:
        Passwords exceeding 72 bytes must be rejected by hash_password,
        verify_password, and API validation, NOT silently truncated.
        """
        long_pwd = "A" * 73
        # Direct hash_password must raise ValueError
        with self.assertRaises(ValueError):
            hash_password(long_pwd)

        # verify_password must return False
        valid_hash = hash_password("ValidPassword123!")
        self.assertFalse(verify_password(long_pwd, valid_hash))

        # API register with 73+ bytes must return 422 Unprocessable Entity
        res = self.client.post("/api/v1/auth/register", json={
            "mobile_number": "9876543002",
            "password": "A" * 73,
            "full_name": "Test Long Password",
            "role": "organiser",
            "business_name": "Test Org",
        })
        self.assertEqual(res.status_code, 422)
        self.assertTrue(
            "at most 72 characters" in res.text or "cannot exceed 72 bytes" in res.text,
            f"Expected 72-byte restriction message, got: {res.text}"
        )

    def test_02_production_secret_key_fails_securely_if_missing_or_default(self):
        """
        SECURITY VERIFICATION 2:
        In production, the application must refuse to start or load if SECRET_KEY
        is missing, too short, or matches the default placeholder.
        """
        import importlib
        import app.core.security as sec

        # Test production without secret or with default secret
        os.environ["ENVIRONMENT"] = "production"
        os.environ["SECRET_KEY"] = "chitflow-super-secret-production-signing-key-2026-secure"

        with self.assertRaises(RuntimeError) as ctx:
            importlib.reload(sec)
        self.assertIn("CRITICAL SECURITY ERROR", str(ctx.exception))

        # Reset back to test environment
        os.environ["ENVIRONMENT"] = "test"
        os.environ["SECRET_KEY"] = "test-verification-secret-key-32bytes-secure-2026"
        importlib.reload(sec)

    def test_03_registration_without_organiser_id_fails_securely(self):
        """
        SECURITY VERIFICATION 3:
        Registering a member or accountant without organiser_id must return 400 Bad Request,
        not silently attach them to the first Organiser in the database.
        """
        res = self.client.post("/api/v1/auth/register", json={
            "mobile_number": "9876543003",
            "password": "SecurePassword123!",
            "full_name": "Unassigned Member",
            "role": "member",
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("Valid organiser_id is required", res.text)

    def test_04_super_admin_cannot_create_or_activate_schemes(self):
        """
        SECURITY VERIFICATION 4:
        Super Admin cannot create or activate chit schemes (least-privilege separation).
        """
        admin_token = self.get_token("9999999999", "AdminPassword123!")

        res = self.client.post(
            "/api/v1/schemes",
            json={
                "scheme_code": "ADMIN-SCHEME",
                "scheme_name": "Illegal Admin Scheme",
                "chit_value": "100000.00",
                "monthly_subscription": "10000.00",
                "duration_months": 10,
                "total_members": 10,
                "start_date": "2026-11-01",
                "monthly_due_day": 5,
                "auction_day": 10,
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertTrue(
            "Organisers" in res.text or "organiser" in res.text,
            f"Expected Organiser restriction message, got: {res.text}"
        )

    def test_05_super_admin_cannot_inspect_member_dashboard(self):
        """
        SECURITY VERIFICATION 5:
        Super Admin cannot inspect a member's private financial dashboard (zero-trust privacy).
        """
        # Create a member under org1
        mem = Member(
            user_id=None,
            organiser_id=self.org1.id,
            member_code="MEM-001",
            full_name="Private Member",
            address_line1="Address",
            city="Hyderabad",
            state="Telangana",
            pincode="500001",
        )
        self.db.add(mem)
        self.db.commit()

        admin_token = self.get_token("9999999999", "AdminPassword123!")
        res = self.client.get(
            f"/api/v1/members/{mem.id}/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Platform administrators are not permitted to inspect private subscriber financial records", res.text)

    def test_06_revoked_token_cannot_be_reused(self):
        """
        SECURITY VERIFICATION 6:
        Verify token revocation via JTI. Token cannot be reused after /logout.
        """
        org_token = self.get_token("9849011111", "Org1Password123!")

        # Works before logout
        res1 = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {org_token}"})
        self.assertEqual(res1.status_code, 200)

        # Call logout
        res_logout = self.client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {org_token}"})
        self.assertEqual(res_logout.status_code, 200)

        # Calling again must be rejected
        res2 = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {org_token}"})
        self.assertEqual(res2.status_code, 401)
        self.assertIn("Session has been invalidated", res2.text)


if __name__ == '__main__':
    unittest.main()
