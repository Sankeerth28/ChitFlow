# ChitFlow — Prioritised Bug Register

**Audit Date:** 03 November 2026  
**Status:** In Progress (Remediation Underway)  

---

## Bug Register Summary

| Bug ID | Severity | Category | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-101** | **Critical** | Frontend / UX | Member portal tabs (*10-Sec Dashboard*, *Enrolled Chits*, *Receipts & Dues*) render identical duplicated view. | Identified |
| **BUG-102** | **Critical** | Backend / Feature | Missing Member Management endpoints (Edit member, status update, profile view, CSV bulk import). | Identified |
| **BUG-103** | **Critical** | Database / Schema | `Member` entity lacks `status` (`active`/`inactive`/`suspended`), `email`, and `updated_at` columns. | Identified |
| **BUG-104** | **High** | Backend / Feature | Member listing endpoint `GET /members` lacks pagination, search query, status filters, and sorting. | Identified |
| **BUG-105** | **High** | Backend / Feature | Missing dedicated member financial endpoints (`/enrolled-chits`, `/receipts`, `/dues`) forcing static mock fallback. | Identified |
| **BUG-106** | **High** | Backend / Analytics | Admin dashboard metrics endpoint lacks real-time member status counts, recent transactions, recent registrations, and alerts. | Identified |
| **BUG-107** | **High** | UI / Architecture | Monolithic frontend (`App.tsx` >1,100 lines) with inline styles, lack of modular components, and no toast notifications. | Identified |
| **BUG-108** | **Medium** | Frontend / UX | Raw browser `window.print()` prints the entire messy DOM instead of an official formatted payment receipt voucher. | Identified |
| **BUG-109** | **Medium** | Role Workflow | Accountant lacks a dedicated payment verification and bank reconciliation interface. | Identified |
| **BUG-110** | **Medium** | Role Workflow | Super Admin dashboard lacks platform-wide organiser inspection and system audit log telemetry. | Identified |

---

## Detailed Bug Descriptions

### BUG-101: Member Navigation Tabs Render Identical Duplicated Content
- **Component**: `frontend/src/App.tsx` (lines 504–580)
- **Problem**: When a subscriber logs in, clicking *"My 10-Second Dashboard"*, *"My Enrolled Chits"*, or *"My Receipts & Dues"* updates `activeTab`, but the rendering code only checks `userRole === 'member'` and unconditionally outputs both dashboard KPI cards and a payment receipt table.
- **Root Cause**: Missing conditional routing for `activeTab === 'dashboard'`, `activeTab === 'schemes'`, and `activeTab === 'payments'` within the member portal section.
- **Remediation**: Split into three independent, dedicated view components: `MemberDashboardView`, `MemberEnrolledChitsView`, and `MemberReceiptsDuesView`, backed by real API queries.

### BUG-102: Missing Organiser Member Management Capabilities
- **Component**: `backend/app/api/v1/members.py`
- **Problem**: Organisers can only create a member with minimal details. They cannot edit member information, deactivate/suspend a subscriber, view full 360-degree profiles (enrolments, dues, prizes), or bulk upload members via CSV.
- **Root Cause**: Endpoints `PUT /members/{id}`, `PATCH /members/{id}/status`, `GET /members/{id}/profile`, and `POST /members/import-csv` were never implemented.
- **Remediation**: Implement all missing endpoints in `members.py` with strict tenant isolation and input validation.

### BUG-103: Schema Deficiencies in Member Model
- **Component**: `backend/app/models/entities.py` (`Member` class)
- **Problem**: The database model lacks fields for `email`, `status` (active/inactive/suspended), and `updated_at`.
- **Root Cause**: Original schema only accommodated basic identity without account lifecycle flags.
- **Remediation**: Extend `Member` model with `email = Column(String(255), nullable=True)`, `status = Column(String(30), default="active", nullable=False)`, and `updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)`.

### BUG-104: Unpaginated Member Query
- **Component**: `backend/app/api/v1/members.py` (`list_members`)
- **Problem**: Query fetches `db.query(Member).all()`. For organisers with hundreds of members, this causes performance degradation and prevents table search/filtering.
- **Remediation**: Add pagination (`page`, `page_size`), search filter (`search` across name, code, mobile, email), status filter (`status`), and sort order.

### BUG-105: Missing Dedicated Member Financial APIs
- **Component**: `backend/app/api/v1/members.py`
- **Problem**: Frontend has no endpoints to fetch a member's specific enrolled schemes with instalment progress or official receipts.
- **Remediation**: Add `GET /members/{id}/enrolled-chits` and `GET /members/{id}/receipts` with strict identity verification.

### BUG-106: Underpowered Admin / Organiser Dashboard
- **Component**: `backend/app/api/v1/reports.py`
- **Problem**: Organiser dashboard only returns 4 basic counts. It fails to provide actionable insights such as member status breakdowns, recent transactions, recent registrations, or urgent compliance alerts.
- **Remediation**: Upgrade `OrganiserDashboardMetrics` to include `active_members`, `inactive_members`, `total_enrolled_tickets`, `pending_verifications`, `recent_transactions`, `recent_registrations`, and `alerts`.

### BUG-107: Monolithic UI & Lack of Modern Design System
- **Component**: `frontend/src/App.tsx`, `frontend/src/index.css`
- **Problem**: The entire application is in a single file with raw inline styles and lack of professional visual polish.
- **Remediation**: Rebuild the UI with a modern financial SaaS layout: responsive role-based sidebar, modular tab views, clean metric cards, searchable tables, status badges, toast notification manager, and modal dialogs.
