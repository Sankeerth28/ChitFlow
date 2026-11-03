# ChitFlow — Comprehensive Application Flow Audit

**Date:** 03 November 2026  
**Auditor:** Senior Full-Stack Engineer, Product Designer, QA Engineer & Application Architect  
**Application:** ChitFlow — Statutory Chit Fund Management System  
**Statutory Framework:** Chit Funds Act, 1982 | Chit Funds (Amendment) Act, 2019 | Telangana Chit Funds Rules, 2008  

---

## 1. Executive Summary

ChitFlow is a statutory Chit Fund Management SaaS designed for Indian chit fund organisers, subscribers (members), accountants, and platform administrators.

While the backend core calculation engine (`calc_engine.py`) and double-entry ledger engine (`ledger_engine.py`) are strictly implemented with high mathematical and regulatory precision (Section 15 Foreman entitlement, Section 6 5% foreman commission cap, Section 21 30% discount ceiling, and Section 31 prize disbursement security), the **application layer, user interfaces, and administrative workflows suffer from severe architectural bottlenecks, monolithic frontend coupling, and broken user journeys**:

1. **Member Portal Monolith & Triplicated Views**: The member navigation offers three tabs (*"My 10-Second Dashboard"*, *"My Enrolled Chits"*, and *"My Receipts & Dues"*). However, in `frontend/src/App.tsx` (lines 504-580), the code ignores the `activeTab` state for role `member`, rendering an identical hardcoded component regardless of which tab the subscriber selects.
2. **Absence of Member Management for Organisers**: Organisers have no administrative capability in the UI or complete API suite to edit member details, activate/deactivate/suspend subscribers, search/filter/paginate member lists, inspect 360-degree member profiles (enrolments, past auctions, payment dues, and prize payouts), or bulk-import members via CSV.
3. **Hardcoded / Underpowered Admin Dashboard**: The existing dashboard metric endpoint (`/api/v1/reports/dashboard/organiser`) is missing critical operational KPIs (active vs inactive member breakdowns, total enrolled tickets, pending payment verification queues, recent transactions, recent registrations, and actionable compliance alerts).
4. **Monolithic Frontend Architecture**: The entire user interface (1,119 lines, 65 KB) is crammed into a single `App.tsx` file with inline HTML styles, missing modular component separation, absent toast notification infrastructure (relying on raw browser alerts or silent failures), and no real pagination or search filtering across tables.
5. **Missing Role-Specific Workflows**: Accountants lack dedicated collection queues and payment verification actions; Super Admins lack platform-level organiser management and audit telemetry; Members cannot inspect specific enrolled schemes or download individualized receipts.

---

## 2. Architecture & Tech Stack Inspection

### 2.1 Backend Architecture
- **Framework**: FastAPI (Python 3.10+) running with ASGI Uvicorn/Gunicorn.
- **ORM & Database**: SQLAlchemy 2.0 with declarative Base. SQLite for local test harness (`chitflow.db`); PostgreSQL on Render Production (`chitflow_prod`).
- **Security & RBAC**: JWT (HMAC-SHA256) with JTI revocation table (`revoked_tokens`), bcrypt password hashing (enforcing 72-byte max length), dependency injection via FastAPI (`get_current_user`, `require_role`, `get_current_active_organiser`, `verify_member_access`).
- **Engines**:
  - `calc_engine.py`: Statutory deterministic math engine compliant with Chit Funds Act, 1982.
  - `ledger_engine.py`: Multi-tenant double-entry accounting engine generating immutable journal vouchers with balanced debits and credits.

### 2.2 Frontend Architecture
- **Framework**: React 19 + TypeScript with Vite 8.
- **Styling**: Vanilla CSS in `index.css` and extensive inline CSS styles.
- **Icons**: `lucide-react`.
- **State Management**: Local React component state (`useState`, `useEffect`) without router (SPA tab switching based on state).
- **Network / API**: Native `fetch` with JWT token stored in `sessionStorage` (`authStorage`).

---

## 3. Detailed Workflow Audit & Findings

### 3.1 Member Workflow
| Step | Current State | Audit Finding | Severity |
| :--- | :--- | :--- | :--- |
| **Login** | Functional via mobile & password/PIN. | Works properly. Demo quick-fill available. | Low |
| **"My 10-Second Dashboard"** | Renders static cards with hardcoded values. | Ignores `activeTab`; displays identical view to Enrolled Chits and Receipts. | **Critical** |
| **"My Enrolled Chits"** | Renders the exact same dashboard component. | Member cannot view their distinct enrolled chit schemes, ticket numbers, or scheme progress. | **Critical** |
| **"My Receipts & Dues"** | Renders hardcoded receipt table with 1 static row. | Cannot view actual payment history, partial payments, or outstanding dues per instalment. | **Critical** |
| **Receipt Download / Print** | Triggers raw `window.print()`. | Prints entire browser page rather than a formatted statutory receipt card. | Medium |

### 3.2 Organiser / Admin Workflow
| Step | Current State | Audit Finding | Severity |
| :--- | :--- | :--- | :--- |
| **Dashboard** | Displays 4 basic metrics. | Hardcoded or incomplete; lacks recent registrations, transactions, and pending action alerts. | **High** |
| **Member Management** | Only allows adding a member with basic fields. | Missing member list table, search, filters, pagination, profile view, status update, and CSV import. | **Critical** |
| **Scheme Management** | Create and list schemes. | Functional, but UI lacks drill-down member ticket allocations and status progression actions. | Medium |
| **Auctions** | Simulation and confirmation. | Works for demo scheme, but lacks member-specific bidding history and real-time validation feedback. | Medium |
| **Payments** | Basic recording. | Lacks search/filter by member or scheme; partial payment status handling needs verification. | Medium |
| **Payouts & Security** | Security upload & approval. | Functional backend logic, but needs clear UI steps for Section 31 surety verification. | Medium |
| **Ledger & Audit** | Trial balance & journal entries. | Functional backend, but UI displays raw tables without account filtering or date ranges. | Medium |

### 3.3 Accountant Workflow
| Step | Current State | Audit Finding | Severity |
| :--- | :--- | :--- | :--- |
| **Navigation** | Sees same nav as Organiser without Auctions. | Lacks dedicated reconciliation queue and unverified payments checklist. | High |
| **Payment Verification** | Payments auto-commit or require manual verify. | Accountant needs 1-click verification of submitted receipts and bank deposit reconciliation. | High |

### 3.4 Super Admin Workflow
| Step | Current State | Audit Finding | Severity |
| :--- | :--- | :--- | :--- |
| **Platform Monitoring** | Falls back to Organiser view if no org assigned. | Super Admin should see all registered chit organisations, tenant status, and system audit logs. | High |

---

## 4. Root Cause Analysis of Critical Defects

### 4.1 Triplicated Member Views Bug
In `frontend/src/App.tsx`:
```tsx
// Lines 443-460: The tab switcher sets activeTab to 'dashboard', 'schemes', or 'payments'
<button onClick={() => setActiveTab('dashboard')}>My 10-Second Dashboard</button>
<button onClick={() => setActiveTab('schemes')}>My Enrolled Chits</button>
<button onClick={() => setActiveTab('payments')}>My Receipts & Dues</button>

// Line 504: The render block checks ONLY userRole === 'member', NOT activeTab!
{userRole === 'member' ? (
  <div>
    {/* Always renders the 10-Second Dashboard cards */}
    {/* Always renders the My Payment Receipts table */}
  </div>
) : ( ... )}
```
Because the conditional check ignores `activeTab`, the subscriber is perpetually presented with the same mixed layout, creating the illusion that all three tabs are duplicates.

### 4.2 Missing Member Management Backend Endpoints
In `backend/app/api/v1/members.py`:
- `GET /members` returns all members as a simple list with no search, pagination, or filtering.
- No `PUT/PATCH /members/{member_id}` endpoint to update subscriber contact, address, or KYC details.
- No `PATCH /members/{member_id}/status` to activate, deactivate, or suspend subscribers.
- No `POST /members/import-csv` to process bulk CSV subscriber onboarding.
- No `GET /members/{member_id}/enrolments`, `/payments`, or `/auctions` for comprehensive profile drill-down.

### 4.3 Missing Dedicated Member Financial Endpoints
Subscribers need authenticated endpoints scoped strictly to their member ID:
- `GET /api/v1/members/{member_id}/schemes`: Enrolled chit schemes, tickets, prized status, and next dues.
- `GET /api/v1/members/{member_id}/receipts`: Historical payment receipts, amounts, reference IDs, and instalment numbers.
- `GET /api/v1/members/{member_id}/dues`: Detailed breakdown of pending instalments and upcoming due dates.

---

## 5. Prioritised Execution Roadmap

1. **Phase 2 — Critical Backend Enhancements**:
   - Upgrade `Member` model with `status` (`active`, `inactive`, `suspended`), `email`, and `updated_at`.
   - Implement comprehensive Member Management APIs: search, pagination, filtering, update, status toggle, CSV bulk import, and full profile summary.
   - Implement dedicated Member Portal endpoints: enrolled schemes, receipts history, and dues breakdown.
   - Implement Enhanced Admin Dashboard KPI endpoint with real DB aggregations, recent transactions, recent registrations, and action alerts.
2. **Phase 3 — Workflow & Financial Integrity**:
   - Verify payment reconciliation, partial payment allocation, and double-entry consistency.
   - Wire role-based access control to ensure Super Admin, Organiser, Accountant, and Member maintain strict least-privilege isolation.
3. **Phase 4 — Complete UI/UX Redesign**:
   - Redesign navigation into a modern, professional SaaS layout with role-specific sidebars.
   - Separate Member tabs into 3 independent, beautifully styled views.
   - Build a comprehensive Organiser Member Management interface (Add/Edit modal, CSV importer modal, Search & Filter table, 360° Member Profile drawer).
   - Build a modern Admin Dashboard with KPI summary cards, interactive date filters, alert banners, and recent activity feeds.
   - Introduce toast notifications, modal dialogs, loading skeletons, and responsive drawer controls.
4. **Phase 5 — Full QA & Regression Testing**:
   - Execute backend integration tests covering all new member endpoints, CSV import, status transitions, and member dashboard queries.
   - Verify frontend production build and zero typescript errors.
