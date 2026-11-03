"""
Test Suite for Member Management, Dedicated Member Portal, and Admin Dashboard
Covers:
1. Member registration with auto-generated code and email
2. Member listing with search, filtering, and pagination
3. Member updating (PUT /members/{id})
4. Member status lifecycle: active -> inactive -> suspended -> active
5. 360-degree Member Profile (GET /members/{id}/profile)
6. Dedicated Member Portal APIs:
   - GET /members/{id}/enrolled-chits
   - GET /members/{id}/receipts
   - GET /members/{id}/dues
7. Bulk CSV Member Import with validation & duplicate detection
8. Real-time Admin Dashboard KPIs & Alert generation
"""

import unittest
import os
import sys
from decimal import Decimal
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.db.session import Base, engine, SessionLocal
from app.models.entities import Organiser, User, Member, ChitScheme, SchemeMember
from app.core.security import hash_password


class TestMemberManagementAndPortal(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

        db = SessionLocal()
        # Ensure test organiser exists
        cls.org = db.query(Organiser).filter(Organiser.contact_phone == "9849012345").first()
        if not cls.org:
            cls.org = Organiser(
                business_name="Sri Balaji Chit Funds Pvt. Ltd.",
                contact_phone="9849012345",
                state="Telangana",
            )
            db.add(cls.org)
            db.flush()

        # Ensure organiser user exists
        cls.org_user = db.query(User).filter(User.mobile_number == "9849012345").first()
        if not cls.org_user:
            cls.org_user = User(
                organiser_id=cls.org.id,
                mobile_number="9849012345",
                password_hash=hash_password("OrganiserPassword123!"),
                role="organiser",
                is_active=True,
                is_verified=True,
            )
            db.add(cls.org_user)
        else:
            cls.org_user.password_hash = hash_password("OrganiserPassword123!")
            cls.org_user.is_active = True
        db.commit()

        cls.org_id = cls.org.id
        db.close()

    def get_token(self, mobile: str, password: str) -> str:
        res = self.client.post("/api/v1/auth/login", json={
            "mobile_number": mobile,
            "password": password,
        })
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["access_token"]

    def test_01_create_member_with_auto_code_and_email(self):
        token = self.get_token("9849012345", "OrganiserPassword123!")
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "full_name": "Ramesh Kumar Varma",
            "mobile_number": "9849111222",
            "email": "ramesh.varma@example.in",
            "address_line1": "Plot 88, Kavuri Hills",
            "city": "Hyderabad",
            "state": "Telangana",
            "pincode": "500033",
            "emergency_contact": "9849111223",
            "kyc_status": "verified",
        }
        res = self.client.post("/api/v1/members", json=payload, headers=headers)
        self.assertEqual(res.status_code, 201, res.text)
        data = res.json()
        self.assertEqual(data["full_name"], "Ramesh Kumar Varma")
        self.assertEqual(data["email"], "ramesh.varma@example.in")
        self.assertTrue(data["member_code"].startswith("MEM-"))
        self.assertEqual(data["status"], "active")

    def test_02_member_search_filter_pagination(self):
        token = self.get_token("9849012345", "OrganiserPassword123!")
        headers = {"Authorization": f"Bearer {token}"}

        # Paginated query
        res = self.client.get("/api/v1/members?page=1&page_size=5", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertIn("page", data)
        self.assertEqual(data["page"], 1)

        # Search by name
        res_search = self.client.get("/api/v1/members?search=Ramesh", headers=headers)
        self.assertEqual(res_search.status_code, 200)
        items = res_search.json()
        self.assertTrue(any("Ramesh" in m["full_name"] for m in items))

    def test_03_edit_member_and_status_lifecycle(self):
        token = self.get_token("9849012345", "OrganiserPassword123!")
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create a member to test edits
        create_res = self.client.post("/api/v1/members", json={
            "full_name": "Sunita Reddy",
            "mobile_number": "9849333444",
            "email": "sunita@example.in",
            "address_line1": "Banjara Hills Road 12",
            "city": "Hyderabad",
            "pincode": "500034",
        }, headers=headers)
        self.assertEqual(create_res.status_code, 201)
        mem_id = create_res.json()["id"]

        # 2. Update address and city
        put_res = self.client.put(f"/api/v1/members/{mem_id}", json={
            "address_line1": "Flat 501, Banjara Heights, Road 12",
            "city": "Hyderabad",
            "email": "sunita.reddy@example.in",
        }, headers=headers)
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.json()["address_line1"], "Flat 501, Banjara Heights, Road 12")
        self.assertEqual(put_res.json()["email"], "sunita.reddy@example.in")

        # 3. Suspend member
        patch_res = self.client.patch(f"/api/v1/members/{mem_id}/status", json={
            "status": "suspended",
            "reason": "Temporary KYC reverification",
        }, headers=headers)
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["status"], "suspended")

        # 4. Reactivate member
        reactivate_res = self.client.patch(f"/api/v1/members/{mem_id}/status", json={
            "status": "active",
        }, headers=headers)
        self.assertEqual(reactivate_res.status_code, 200)
        self.assertEqual(reactivate_res.json()["status"], "active")

    def test_04_360_profile_and_dedicated_member_portal_endpoints(self):
        token = self.get_token("9849012345", "OrganiserPassword123!")
        headers = {"Authorization": f"Bearer {token}"}

        # Fetch list to pick first member
        members_res = self.client.get("/api/v1/members?all=true", headers=headers)
        self.assertEqual(members_res.status_code, 200)
        members = members_res.json()
        self.assertTrue(len(members) > 0)
        first_mem_id = members[0]["id"]

        # 1. 360-Degree Profile
        profile_res = self.client.get(f"/api/v1/members/{first_mem_id}/profile", headers=headers)
        self.assertEqual(profile_res.status_code, 200)
        prof_data = profile_res.json()
        self.assertIn("member", prof_data)
        self.assertIn("enrolled_schemes", prof_data)
        self.assertIn("recent_payments", prof_data)
        self.assertIn("outstanding_dues", prof_data)

        # 2. Dedicated Enrolled Chits Tab Endpoint
        enrolled_res = self.client.get(f"/api/v1/members/{first_mem_id}/enrolled-chits", headers=headers)
        self.assertEqual(enrolled_res.status_code, 200)
        self.assertIsInstance(enrolled_res.json(), list)

        # 3. Dedicated Receipts Tab Endpoint
        receipts_res = self.client.get(f"/api/v1/members/{first_mem_id}/receipts", headers=headers)
        self.assertEqual(receipts_res.status_code, 200)
        self.assertIsInstance(receipts_res.json(), list)

        # 4. Dedicated Dues Tab Endpoint
        dues_res = self.client.get(f"/api/v1/members/{first_mem_id}/dues", headers=headers)
        self.assertEqual(dues_res.status_code, 200)
        self.assertIsInstance(dues_res.json(), list)

    def test_05_csv_bulk_import_with_validation_and_duplicate_handling(self):
        token = self.get_token("9849012345", "OrganiserPassword123!")
        headers = {"Authorization": f"Bearer {token}"}

        csv_content = """full_name,mobile_number,email,address_line1,city,state,pincode,emergency_contact
Anil Rao,9849555001,anil@test.in,Street 1,Hyderabad,Telangana,500081,9849555000
Priya Sharma,9849555002,priya@test.in,Street 2,Hyderabad,Telangana,500081,9849555000
Invalid Phone,12345,bad@test.in,Street 3,Hyderabad,Telangana,500081,
Anil Rao Duplicate,9849555001,anil2@test.in,Street 4,Hyderabad,Telangana,500081,
"""
        res = self.client.post("/api/v1/members/import-csv", json={"csv_content": csv_content}, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["imported_count"], 2)
        self.assertEqual(data["skipped_count"], 2)
        self.assertEqual(len(data["errors"]), 2)

    def test_06_admin_dashboard_realtime_metrics_and_alerts(self):
        token = self.get_token("9849012345", "OrganiserPassword123!")
        headers = {"Authorization": f"Bearer {token}"}

        res = self.client.get("/api/v1/reports/dashboard/admin", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Check real metrics
        self.assertIn("total_members", data)
        self.assertIn("active_members", data)
        self.assertIn("inactive_members", data)
        self.assertIn("total_enrolled_tickets", data)
        self.assertIn("monthly_collections", data)
        self.assertIn("outstanding_amount", data)
        self.assertIn("pending_verification_count", data)
        self.assertIn("recent_transactions", data)
        self.assertIn("recent_registrations", data)
        self.assertIn("action_alerts", data)

        # Assert numeric coherence
        self.assertEqual(data["total_members"], data["active_members"] + data["inactive_members"])
        self.assertIsInstance(data["recent_transactions"], list)
        self.assertIsInstance(data["action_alerts"], list)
