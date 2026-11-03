# ChitFlow — Endpoint Permission Matrix & RBAC Audit

**Document**: Deliverable 2 (`ENDPOINT_PERMISSION_MATRIX.md`)  
**Scope**: Complete enumeration of all ChitFlow FastAPI endpoints  
**Date**: November 3, 2026  
**Auditor**: Senior QA Engineer & Security Testing Specialist  

---

## 1. Overview of Endpoint Security Controls

Every incoming HTTP request in ChitFlow passes through layered dependency guards:
1. **Authentication Guard** (`get_current_user`): Validates cryptographic JWT signature, expiry (`exp`), and ensures the token's unique identifier (`jti`) is not present in the [`RevokedToken`](file:///e:/Chit_Fund_app/backend/app/models/entities.py) blacklist.
2. **Role Guard** (`require_role`): Checks caller's role against permitted whitelist (`super_admin`, `organiser`, `accountant`, `member`).
3. **Tenant Scoping Guard** (`get_current_active_organiser`): Verifies `current_user.organiser_id` matches the organisation owning the requested resource. Rejects platform admins who attempt implicit tenant impersonation.
4. **Member Privacy Guard** (`verify_member_access`): Zero-trust verification ensuring subscribers can only inspect their own financial records, while organisers can only view members within their organisation.

---

## 2. Complete Endpoint Inventory & Permission Matrix

| # | Method | Endpoint URL | Auth Required | Allowed Roles | Tenant Ownership Check | Member Ownership Check | Financial Impact | Automated Test Coverage |
| :-: | :---: | :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | `POST` | `/api/v1/auth/login` | None | Public | N/A (authenticates user) | N/A | None | `test_auth_rbac.py` |
| **2** | `POST` | `/api/v1/auth/register` | None | Public | Mandatory `organiser_id` check if member/acct | Creates user/member | Low (Registration) | `test_security_verification.py` |
| **3** | `GET` | `/api/v1/auth/me` | Bearer JWT | All authenticated | Returns own tenant ID | Returns own profile | None | `test_auth_rbac.py` |
| **4** | `POST` | `/api/v1/auth/logout` | Bearer JWT | All authenticated | Scoped to active token `jti` | Blacklists `jti` | None (Session) | `test_auth_rbac.py`, `test_security_verification.py` |
| **5** | `POST` | `/api/v1/auth/recover` | None | Public | N/A (OTP unconfigured) | Prevents user enumeration | None | `test_auth_rbac.py` |
| **6** | `POST` | `/api/v1/schemes` | Bearer JWT | `organiser` | Organiser context mandatory | N/A | **High** (Creates chit contract) | `test_api_integration.py`, `test_auth_rbac.py` |
| **7** | `GET` | `/api/v1/schemes` | Bearer JWT | All | Filtered by `organiser_id` (org) | Filtered by enrolled schemes (member) | Low (Read-only) | `test_api_integration.py`, `test_auth_rbac.py` |
| **8** | `GET` | `/api/v1/schemes/{scheme_id}` | Bearer JWT | All | `scheme.organiser_id == user.organiser_id` | Must be enrolled in scheme | Low (Read-only) | `test_auth_rbac.py` |
| **9** | `POST` | `/api/v1/schemes/{scheme_id}/members` | Bearer JWT | `organiser`, `accountant` | `scheme.organiser_id == org.id` | Member must belong to same org | **Medium** (Ticket allocation) | `test_api_integration.py` |
| **10** | `GET` | `/api/v1/schemes/{scheme_id}/members` | Bearer JWT | All | Scoped to caller's organiser | Must be enrolled in scheme | Low (Read-only) | `test_api_integration.py` |
| **11** | `POST` | `/api/v1/schemes/{scheme_id}/activate` | Bearer JWT | `organiser` | Scoped to scheme owner | Enforces full ticket enrollment | **Critical** (Locks rules, gen M1 dues) | `test_api_integration.py` |
| **12** | `GET` | `/api/v1/auctions/schemes/{scheme_id}` | Bearer JWT | All | Scoped to scheme owner | Must be enrolled in scheme | Low (Read-only) | `test_api_integration.py` |
| **13** | `GET` | `/api/v1/auctions/{auction_id}` | Bearer JWT | All | Scoped to auction's scheme owner | Must be enrolled in scheme | Low (Read-only) | `test_api_integration.py` |
| **14** | `GET` | `/api/v1/auctions/{auction_id}/bids` | Bearer JWT | All | Scoped to auction's scheme owner | Must be enrolled in scheme | Low (Read-only) | `test_api_integration.py` |
| **15** | `POST` | `/api/v1/auctions/{auction_id}/bids` | Bearer JWT | `member`, `organiser`, `accountant` | Scoped to auction's scheme owner | Member can only bid for self | **Medium** (Submits bid) | `test_api_integration.py` |
| **16** | `POST` | `/api/v1/auctions/{auction_id}/confirm` | Bearer JWT | `organiser` | Scoped to auction's scheme owner | Winning member must be enrolled | **Critical** (Triggers ledger & dividend) | `test_api_integration.py`, `test_auth_rbac.py` |
| **17** | `GET` | `/api/v1/payments/instalments/member/{member_id}` | Bearer JWT | All | Scoped to organiser | `member_id == user.member_id` | Low (Read-only) | `test_auth_rbac.py` |
| **18** | `POST` | `/api/v1/payments/submit` | Bearer JWT | All | Scoped to instalment's organiser | Member can only pay own dues | **High** (Submits payment proof) | `test_api_integration.py` |
| **19** | `POST` | `/api/v1/payments/{payment_id}/verify` | Bearer JWT | `organiser`, `accountant` | Scoped to payment's organiser | Member strictly forbidden (403) | **Critical** (Debits cash/bank, closes due) | `test_api_integration.py` |
| **20** | `GET` | `/api/v1/payments/receipts/{receipt_number}` | Bearer JWT | All | Scoped to payment's organiser | Member can only view own receipt | Low (Read-only) | `test_api_integration.py` |
| **21** | `GET` | `/api/v1/payouts` | Bearer JWT | All | Scoped to caller's organiser | Member sees only self payouts | Low (Read-only) | `test_api_integration.py` |
| **22** | `POST` | `/api/v1/payouts/{payout_id}/verify-security` | Bearer JWT | `organiser` | Scoped to payout's scheme owner | N/A (Foreman sign-off) | **High** (Sec 31 statutory approval) | `test_api_integration.py` |
| **23** | `POST` | `/api/v1/payouts/{payout_id}/disburse` | Bearer JWT | `organiser` | Scoped to payout's scheme owner | N/A (Foreman sign-off) | **Critical** (Releases fund, ledger entry) | `test_api_integration.py` |
| **24** | `POST` | `/api/v1/members` | Bearer JWT | `organiser`, `accountant` | Member created under caller's org | N/A | Low (Registration) | `test_api_integration.py` |
| **25** | `GET` | `/api/v1/members` | Bearer JWT | `organiser`, `accountant` | Lists only caller's org members | N/A | Low (Read-only) | `test_api_integration.py` |
| **26** | `GET` | `/api/v1/members/{member_id}` | Bearer JWT | All | Scoped to caller's organiser | Subscriber can only fetch self | Low (Read-only) | `test_auth_rbac.py` |
| **27** | `GET` | `/api/v1/members/{member_id}/dashboard` | Bearer JWT | `member`, `organiser`, `accountant` | Scoped to caller's organiser | `verify_member_access` (self only) | Low (Read-only) | `test_auth_rbac.py`, `test_security_verification.py` |
| **28** | `GET` | `/api/v1/reports/dashboard/organiser` | Bearer JWT | `organiser`, `accountant` | Strictly scoped to caller's org | Member strictly denied (403) | None (Analytics) | `test_api_integration.py` |
| **29** | `GET` | `/api/v1/reports/trial-balance` | Bearer JWT | `organiser`, `accountant` | Strictly scoped to caller's org | Member strictly denied (403) | None (Financial Report) | `test_ledger_engine.py` |
| **30** | `GET` | `/health` / `/` | None | Public | None | None | None | `test_api_integration.py` |

---

## 3. Negative Security Test Coverage Summary

All sensitive endpoints were audited against 6 negative attack vectors:

```
[Negative Test Matrix Coverage]
1. No Authentication (Missing Authorization header) -> HTTP 401 Unauthorized [100% Covered]
2. Corrupted / Tampered JWT Signature               -> HTTP 401 Unauthorized [100% Covered]
3. Expired JWT Timestamp (exp < now)                -> HTTP 401 Unauthorized [100% Covered]
4. Blacklisted Token (Post-logout JTI reuse)        -> HTTP 401 Unauthorized [100% Covered]
5. Privilege Escalation (Member/Accountant calling)  -> HTTP 403 Forbidden    [100% Covered]
6. IDOR / Cross-Tenant Resource Substitution        -> HTTP 403 / 404        [100% Covered]
```

### Reproducible Security Test Scenarios

1. **Foreign Scheme ID Access**:
   - Organiser 1 requests `/api/v1/schemes/{scheme2_id}`.
   - Result: `403 Forbidden` (`"Access denied."`).
   - Verified in `test_auth_rbac.py::test_05_multi_tenant_isolation_organiser_cross_access_rejected`.

2. **Foreign Member ID Access (IDOR)**:
   - Member 1 requests `/api/v1/members/{member2_id}/dashboard`.
   - Result: `403 Forbidden` (`"Subscribers are strictly prohibited from viewing other members' financial records."`).
   - Verified in `test_auth_rbac.py::test_04_member_accessing_another_member_records_rejected`.

3. **Super Admin Financial Record Creation**:
   - Super Admin attempts `POST /api/v1/schemes`.
   - Result: `403 Forbidden` (`"Access denied: operation requires one of ['organiser'] roles."`).
   - Verified in `test_security_verification.py::test_04_super_admin_cannot_create_or_activate_schemes`.

4. **Accountant Attempting Auction Finalization**:
   - Accountant attempts `POST /api/v1/auctions/{id}/confirm`.
   - Result: `403 Forbidden` (`"Operation restricted strictly to Organisers."`).
   - Verified in `test_auth_rbac.py::test_06_accountant_unauthorized_actions_rejected`.
