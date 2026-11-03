# ChitFlow — Technical Planning & System Architecture Specification
**Document Version:** 1.0  
**Status:** Engineering Ready / Technical Planning  
**Target Platform:** Web, Mobile PWA (Android / iOS), Desktop (Windows 10/11)  
**Primary Target Market:** India (Telangana & Andhra Pradesh)  
**Governing Statutes:** Chit Funds Act, 1982 | Chit Funds (Amendment) Act, 2019 | Telangana Chit Funds Rules, 2008 | DPDP Act, 2023  
**System Motto:** *Every Chit. Every Member. Every Rupee. Accounted For.*

---

## 1. Executive Summary & Architectural Vision

ChitFlow is a mission-critical, double-entry financial platform designed to digitize and regulate the operations of chit funds (known locally as *Chitty* or *Kuri*). In traditional operations across Telangana and Andhra Pradesh, foremen and organizers rely on physical ledgers (*chitta*), WhatsApp communication, and manual spreadsheets. These manual systems suffer from record tampering, dividend calculation opacity, payment reconciliation disputes, and compliance overhead with the Registrar of Chits.

This Technical Architecture Specification translates the **ChitFlow Product Requirements Document (PRD v1.0)** into a hardened, deterministic, and scalable system design.

### Core Architectural Mandates
1. **Deterministic Financial Calculation Engine:** Absolute elimination of floating-point inaccuracies. All calculations use fixed-point decimal arithmetic with explicit rounding residue suspense accounts.
2. **Immutable Double-Entry Ledger:** Every financial movement—from subscription billing and cash collection to auction discounts, foreman commission recognition, dividend distribution, and prize payouts—generates balanced, debit-credit journal entries. Historical records cannot be updated or deleted; corrections are executed strictly via auditable reversal entries.
3. **Statutory Alignment with Chit Funds Act, 1982:** Hard constraints enforce the 5% foreman commission ceiling, maximum 30% auction discount limit (as amended in 2019), 1st installment foreman entitlement without auction, and mandatory prized subscriber security/surety verification prior to disbursement.
4. **Zero-Trust Multi-Tenancy & Privacy:** Strict logical tenant isolation per Chit Organiser. Role-Based Access Control (RBAC) ensures members only access their enrolled chits and individual financial ledgers, preventing unauthorized cross-member visibility.

---

## 2. High-Level System Architecture

ChitFlow is architected as a modular, API-first service with clear boundaries between user experience layers, business logic engines, and transactional persistence.

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                               |
|  +---------------------------+       +-------------------------------+  |
|  |   Responsive Web / PWA    |       |   Mobile Web / Installed PWA  |  |
|  |  (React 18 + TS + Tailwind) |       |  (Android / iOS / Windows 11) |  |
|  +-------------+-------------+       +---------------+---------------+  |
+----------------|-------------------------------------|------------------+
                 | HTTPS / TLS 1.3 (JSON REST API)     |
+----------------v-------------------------------------v------------------+
|                          API GATEWAY / PROXY                            |
|             (Traefik / Nginx Reverse Proxy + Cloudflare WAF)            |
|       - Rate Limiting (Token Bucket: 100 req/min per IP/Tenant)          |
|       - DDoS Protection & SSL Offloading                                |
|       - Idempotency Header Validation (Idempotency-Key: UUID)           |
+--------------------------------+----------------------------------------+
                                 |
+--------------------------------v----------------------------------------+
|                       APPLICATION BACKEND (FastAPI)                     |
|  +-----------------------+ +-----------------------+ +---------------+  |
|  | Authentication & RBAC | | Chit Scheme Lifecycle | | Auction Engine|  |
|  | (JWT + Mobile OTP)    | | (State Machine)       | | (Deterministic|  |
|  +-----------------------+ +-----------------------+ +---------------+  |
|  +-----------------------+ +-----------------------+ +---------------+  |
|  | Payment Management    | | Double-Entry Ledger   | | Statutory Rprt|  |
|  | (Receipts & Vouchers) | | (Balance Invariant)   | | (Govt Formats)|  |
|  +-----------------------+ +-----------------------+ +---------------+  |
+-----------------+-------------------------------+-----------------------+
                  |                               |
       +----------v----------+         +----------v----------+
       |   POSTGRESQL 16+    |         |     REDIS 7+        |
       |  (ACID Relational)  |         | (Distributed Locks, |
       | - Row-Level Locks   |         |  Session Cache,     |
       | - Journal Entries   |         |  Celery Task Queue) |
       | - Strict Constraints|         +----------+----------+
       +---------------------+                    |
                                       +----------v----------+
                                       |  BACKGROUND WORKERS |
                                       |  - SMS / WhatsApp   |
                                       |  - PDF Generation   |
                                       |  - Daily Backups    |
                                       +---------------------+
```

### Technology Stack Justification

| Layer | Technology | Version | Rationale & Trade-offs |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + TypeScript + Vite | React 18.3, TS 5.4 | Type-safe financial calculations on client, fast build time, high UI component reusability. |
| **Styling** | Tailwind CSS + Radix UI | Tailwind 3.4 | Headless accessible components compliant with WCAG 2.2 AA target; low runtime overhead. |
| **Backend API** | Python + FastAPI | Python 3.11, FastAPI 0.111 | Native async high performance, Pydantic v2 data validation, native `decimal.Decimal` support for financial precision. |
| **Database** | PostgreSQL | PostgreSQL 16.3 | First-class relational integrity, transactional DDL, row-level locking (`FOR UPDATE`), jsonb audit trail. |
| **ORM & Migrations**| SQLAlchemy 2.0 + Alembic | SQLAlchemy 2.0 | Declarative models, robust transaction lifecycle management, typed query builder. |
| **Cache & Tasks** | Redis + Celery / ARQ | Redis 7.2 | Distributed mutex for concurrent auction bidding, task queue for SMS/WhatsApp notifications and PDF rendering. |
| **Document Storage**| S3-Compatible Storage | MinIO / AWS S3 | Encrypted storage for member KYC, promissory notes, surety collateral, and payment receipts. |

---

## 3. Deterministic Financial Calculation Engine

### 3.1 Statutory Mathematical Model (Chit Funds Act, 1982)

In an Indian registered chit fund:
1. **Gross Chit Value ($V$):** The total capital pooled in a scheme ($V = N 	imes S$, where $N$ is total months/members, and $S$ is the gross monthly subscription).
2. **Foreman Entitlement (1st Month):** Under Section 15 of the Chit Funds Act, the foreman is entitled to the full chit amount of the first installment without auction or deduction of discount ($Payout_1 = V$).
3. **Subsequent Monthly Auctions ($m \ge 2$):** Eligible members submit reverse bids stating the discount ($D$) they are willing to forgo to claim the prize money immediately.
4. **Winning Payout / Prize Money ($P$):**
   $$P = V - D$$
5. **Statutory Ceilings & Floors:**
   - **Maximum Auction Discount ($D_{max}$):** Capped at 30% of $V$ under Section 6 of the Chit Funds (Amendment) Act, 2019:
     $$D \le 0.30 	imes V$$
   - **Foreman Commission ($C$):** Capped at 5% of $V$ under Section 21(1)(b) of the Act:
     $$C = \min(V 	imes r_{foreman}, D)$$
     where $r_{foreman} \le 0.05$.
6. **Member Dividend Pool ($Pool$):** The remaining auction discount after deducting foreman commission:
   $$Pool = D - C$$
7. **Dividend Per Member ($Div$):**
   $$Div = \lfloor rac{Pool}{N_{eligible}} floor_{2	ext{ decimals}}$$
   Any division residue $\Delta = Pool - (Div 	imes N_{eligible})$ is credited to the *Chit Rounding Suspense Account* and adjusted in the terminal auction or allocated to foreman contingency.
8. **Net Payable Contribution by Member ($NetContr$):**
   $$NetContr = S - Div$$

### 3.2 Reference Model Verification

The calculation engine was implemented and verified against the two canonical PRD reference cases:

| Parameter | PRD Scheme A (10 Months) | PRD Scheme B (20 Months) |
| :--- | :--- | :--- |
| **Total Chit Value ($V$)** | ₹1,00,000.00 | ₹1,00,000.00 |
| **Total Members ($N$)** | 10 | 20 |
| **Gross Monthly Subscription ($S$)** | ₹10,000.00 | ₹5,00,0.00 |
| **Winning Payout ($P$)** | ₹74,000.00 | ₹71,000.00 |
| **Auction Discount ($D = V - P$)** | ₹26,000.00 (26.0% $\le 30\%$) | ₹29,000.00 (29.0% $\le 30\%$) |
| **Organiser Commission ($C$)** | ₹4,000.00 (4.0% $\le 5\%$) | ₹4,000.00 (4.0% $\le 5\%$) |
| **Member Dividend Pool ($Pool$)** | ₹22,000.00 | ₹25,000.00 |
| **Eligible Members ($N_{eligible}$)** | 10 | 20 |
| **Dividend Per Member ($Div$)** | **₹2,200.00** | **₹1,250.00** |
| **Net Payable Contribution ($NetContr$)** | **₹7,800.00** | **₹3,750.00** |
| **Rounding Residual ($\Delta$)** | **₹0.00** | **₹0.00** |

---

## 4. Double-Entry Accounting Ledger Specification

Financial integrity requires an immutable general ledger adhering to standard double-entry bookkeeping. Financial records are never updated in-place or deleted.

### 4.1 Standard Chart of Accounts (COA)

Every organiser tenant maintains an isolated Chart of Accounts partitioned into 5 classes:

| Code | Account Name | Account Type | Normal Balance | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1010** | Cash on Hand | Asset | Debit | Physical cash collected from subscribers. |
| **1020** | Bank Operating Account | Asset | Debit | Core bank account for UPI, NEFT, and RTGS deposits. |
| **1030** | Chit Guarantee Deposit (Registrar)| Asset | Debit | 100% security deposit pledged to Registrar under Sec 20. |
| **1100** | Member Subscriptions Receivable| Asset | Debit | Outstanding instalments owed by members. |
| **2010** | Prize Money Payable | Liability | Credit | Approved auction prize money pending disbursement. |
| **2020** | Member Advance Subscriptions | Liability | Credit | Prepaid instalments received before auction dates. |
| **2030** | Rounding Suspense Account | Liability | Credit | Residual paise differences accumulated from rounding. |
| **3010** | Foreman Capital / Equity | Equity | Credit | Organiser initial capital and retained reserves. |
| **4010** | Foreman Commission Income | Revenue | Credit | Earned 5% commission from finalized auctions. |
| **4020** | Late Payment Penalty Fees | Revenue | Credit | Default interest / late fees collected under scheme rules. |
| **5010** | Member Dividend Expense | Expense | Debit | Auction discount distributed back to members. |
| **5020** | Statutory Filing & Audit Fees | Expense | Debit | Legal and regulatory fees paid to Registrar of Chits. |

### 4.2 Standard Journal Entry Mappings

```
================================================================================
EVENT 1: Monthly Subscription Billed (Due Date Generation)
--------------------------------------------------------------------------------
DR 1100 Member Subscriptions Receivable (Member A)           ₹10,000.00
    CR 2010 Chit Scheme Collection Pool (Scheme X, M1)                  ₹10,000.00
(To record gross monthly installment due from subscriber before auction)

================================================================================
EVENT 2: Member Payment Received (via UPI/Bank)
--------------------------------------------------------------------------------
DR 1020 Bank Operating Account                               ₹7,800.00
DR 5010 Member Dividend Expense (Dividend Applied)           ₹2,200.00
    CR 1100 Member Subscriptions Receivable (Member A)                  ₹10,000.00
(To record receipt of net contribution and settlement via earned dividend credit)

================================================================================
EVENT 3: Auction Finalized (Winning Bid Confirmed)
--------------------------------------------------------------------------------
DR 2010 Chit Scheme Collection Pool (Scheme X)               ₹1,00,000.00
    CR 2010 Prize Money Payable (Winning Member B)                      ₹74,000.00
    CR 4010 Foreman Commission Income                                    ₹4,000.00
    CR 5010 Member Dividend Pool (Distributed)                          ₹22,000.00
(To recognize prize liability, earned foreman commission, and dividend pool)

================================================================================
EVENT 4: Prize Money Disbursed (Post Surety Verification)
--------------------------------------------------------------------------------
DR 2010 Prize Money Payable (Winning Member B)               ₹74,000.00
    CR 1020 Bank Operating Account                                      ₹74,000.00
(To record bank transfer payout to winning prized subscriber)

================================================================================
EVENT 5: Transaction Reversal (Correction of Erroneous Entry)
--------------------------------------------------------------------------------
DR 1100 Member Subscriptions Receivable (Member A)           ₹7,800.00
    CR 1020 Bank Operating Account                                       ₹7,800.00
(Reversal of Journal Entry #JE-1094 due to bounce/rejected transaction)
Audit Metadata: { original_entry_id: "UUID", reason: "Dishonoured Cheque #4921", authorizer_id: "UUID" }
================================================================================
```

---

## 5. PostgreSQL Database Schema (Production DDL)

The data model enforces relational constraints, immutable ledger integrity, and multi-tenant security.

```sql
-- Enable UUID extension and pgcrypto
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'organiser', 'accountant', 'member');
CREATE TYPE scheme_status AS ENUM ('draft', 'pending_approval', 'active', 'suspended', 'completed', 'cancelled');
CREATE TYPE auction_status AS ENUM ('scheduled', 'bidding_open', 'bidding_closed', 'confirmed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'submitted', 'under_verification', 'paid', 'partially_paid', 'overdue', 'rejected', 'refunded');
CREATE TYPE payout_status AS ENUM ('awaiting_security', 'security_verified', 'approved', 'processing', 'paid', 'on_hold', 'failed');
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'bank_transfer', 'cheque', 'dd');
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- 1. Organisers / Tenants
CREATE TABLE organisers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    trade_license_number VARCHAR(100),
    chit_registrar_registration_no VARCHAR(100) UNIQUE,
    state VARCHAR(50) DEFAULT 'Telangana',
    contact_phone VARCHAR(20) NOT NULL,
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Authentication & Identity)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id UUID REFERENCES organisers(id) ON DELETE RESTRICT,
    mobile_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    pin_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'member',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Member Profiles
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    organiser_id UUID NOT NULL REFERENCES organisers(id) ON DELETE RESTRICT,
    member_code VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    address_line1 TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'Telangana',
    pincode VARCHAR(10) NOT NULL,
    emergency_contact VARCHAR(20),
    kyc_status VARCHAR(50) DEFAULT 'pending',
    id_proof_type VARCHAR(50),
    id_proof_encrypted_number VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_organiser_member_code UNIQUE(organiser_id, member_code)
);

-- 4. Chit Schemes
CREATE TABLE chit_schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id UUID NOT NULL REFERENCES organisers(id) ON DELETE RESTRICT,
    scheme_code VARCHAR(50) NOT NULL,
    scheme_name VARCHAR(255) NOT NULL,
    chit_value NUMERIC(14, 2) NOT NULL CHECK (chit_value > 0),
    monthly_subscription NUMERIC(14, 2) NOT NULL CHECK (monthly_subscription > 0),
    duration_months INT NOT NULL CHECK (duration_months > 0),
    total_members INT NOT NULL CHECK (total_members > 0),
    commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (commission_percentage <= 5.00),
    max_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 30.00 CHECK (max_discount_percentage <= 30.00),
    start_date DATE NOT NULL,
    monthly_due_day INT NOT NULL CHECK (monthly_due_day BETWEEN 1 AND 31),
    auction_day INT NOT NULL CHECK (auction_day BETWEEN 1 AND 31),
    pso_number VARCHAR(100), -- Prior Sanction Order from Registrar
    fd_receipt_number VARCHAR(100), -- Fixed Deposit Guarantee under Sec 20
    status scheme_status NOT NULL DEFAULT 'draft',
    rules_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_organiser_scheme_code UNIQUE(organiser_id, scheme_code)
);

-- 5. Scheme Enrolled Members
CREATE TABLE scheme_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheme_id UUID NOT NULL REFERENCES chit_schemes(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    chit_ticket_number INT NOT NULL,
    enrollment_date DATE NOT NULL,
    has_prized BOOLEAN DEFAULT FALSE,
    prized_auction_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_scheme_ticket UNIQUE(scheme_id, chit_ticket_number),
    CONSTRAINT uq_scheme_member UNIQUE(scheme_id, member_id)
);

-- 6. Auctions
CREATE TABLE auctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheme_id UUID NOT NULL REFERENCES chit_schemes(id) ON DELETE RESTRICT,
    auction_number INT NOT NULL,
    scheduled_datetime TIMESTAMPTZ NOT NULL,
    actual_datetime TIMESTAMPTZ,
    status auction_status NOT NULL DEFAULT 'scheduled',
    winning_member_id UUID REFERENCES members(id),
    winning_bid_discount NUMERIC(14, 2) DEFAULT 0.00,
    winning_payout NUMERIC(14, 2) DEFAULT 0.00,
    foreman_commission NUMERIC(14, 2) DEFAULT 0.00,
    dividend_pool NUMERIC(14, 2) DEFAULT 0.00,
    dividend_per_member NUMERIC(14, 2) DEFAULT 0.00,
    rounding_residual NUMERIC(6, 2) DEFAULT 0.00,
    minutes_of_auction TEXT,
    minutes_filed_with_registrar BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_scheme_auction_number UNIQUE(scheme_id, auction_number)
);

-- 7. Auction Bids
CREATE TABLE auction_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    bid_discount_amount NUMERIC(14, 2) NOT NULL CHECK (bid_discount_amount >= 0),
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_winning_bid BOOLEAN DEFAULT FALSE,
    bid_source VARCHAR(50) DEFAULT 'in_person'
);

-- 8. Payout Records (Prize Money & Security Verification)
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL UNIQUE REFERENCES auctions(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    gross_prize_amount NUMERIC(14, 2) NOT NULL,
    deductions_amount NUMERIC(14, 2) DEFAULT 0.00,
    net_payout_amount NUMERIC(14, 2) NOT NULL,
    status payout_status NOT NULL DEFAULT 'awaiting_security',
    security_verified_by UUID REFERENCES users(id),
    security_type VARCHAR(100), -- E.g., 'Guarantor_Salary_Certificate', 'Property_Mortgage'
    security_doc_url TEXT,
    disbursement_date DATE,
    disbursement_method payment_method,
    transaction_reference VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Member Payment Instalments (Dues)
CREATE TABLE instalments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheme_member_id UUID NOT NULL REFERENCES scheme_members(id) ON DELETE RESTRICT,
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
    instalment_number INT NOT NULL,
    due_date DATE NOT NULL,
    gross_subscription NUMERIC(14, 2) NOT NULL,
    dividend_credit NUMERIC(14, 2) DEFAULT 0.00,
    net_amount_due NUMERIC(14, 2) NOT NULL,
    amount_paid NUMERIC(14, 2) DEFAULT 0.00,
    status payment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_instalment UNIQUE(scheme_member_id, instalment_number)
);

-- 10. Payments & Transaction Receipts
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instalment_id UUID NOT NULL REFERENCES instalments(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    amount_received NUMERIC(14, 2) NOT NULL CHECK (amount_received > 0),
    payment_method payment_method NOT NULL,
    payment_reference_no VARCHAR(100),
    payment_date DATE NOT NULL,
    proof_document_url TEXT,
    status payment_status NOT NULL DEFAULT 'submitted',
    verified_by UUID REFERENCES users(id),
    verification_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Double-Entry General Ledger: Accounts
CREATE TABLE ledger_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id UUID NOT NULL REFERENCES organisers(id) ON DELETE RESTRICT,
    scheme_id UUID REFERENCES chit_schemes(id) ON DELETE RESTRICT,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type account_type NOT NULL,
    current_balance NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_organiser_account_code UNIQUE(organiser_id, account_code)
);

-- 12. Double-Entry General Ledger: Journal Entries (Immutable)
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id UUID NOT NULL REFERENCES organisers(id) ON DELETE RESTRICT,
    entry_number VARCHAR(100) UNIQUE NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_entity_type VARCHAR(50) NOT NULL, -- 'auction', 'payment', 'payout'
    reference_entity_id UUID NOT NULL,
    is_reversal BOOLEAN DEFAULT FALSE,
    reversed_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Double-Entry General Ledger: Journal Entry Lines
CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    debit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
    memo TEXT,
    CONSTRAINT chk_debit_or_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- 14. Audit Log (Cryptographically Chained)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organiser_id UUID REFERENCES organisers(id),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    previous_log_hash VARCHAR(64),
    current_log_hash VARCHAR(64),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Strategic Indexes for Performance & Search
CREATE INDEX idx_users_mobile ON users(mobile_number);
CREATE INDEX idx_scheme_members_scheme ON scheme_members(scheme_id);
CREATE INDEX idx_scheme_members_member ON scheme_members(member_id);
CREATE INDEX idx_auctions_scheme ON auctions(scheme_id);
CREATE INDEX idx_instalments_member ON instalments(scheme_member_id);
CREATE INDEX idx_payments_instalment ON payments(instalment_id);
CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_name, entity_id);
```

---

## 6. State Machine Specifications

To prevent illegal state transitions, each core business entity is governed by a strict finite state machine (FSM).

### 6.1 Chit Scheme Lifecycle

```
[Draft]
   │
   ▼ (Submit PSO & Bank Guarantee Details)
[Pending Approval]
   │
   ▼ (Foreman & Regulatory Verification)
[Active] (Rules Permanently Locked)
   │
   ├───► (Default or Legal Injunction) ───► [Temporarily Suspended]
   │                                                 │
   │◄─── (Compliance Rectified) ─────────────────────┘
   │
   ▼ (All N Auctions Finalized & Reconciled)
[Completed]
```

- **Invariants:** Once state transitions to `Active`, the parameters `chit_value`, `duration_months`, `total_members`, `commission_percentage`, and `max_discount_percentage` are read-only.

### 6.2 Monthly Auction Lifecycle

```
[Scheduled]
   │
   ▼ (Auction Day Reached & Eligible Bidders Verified)
[Bidding Open]
   │
   ▼ (Cutoff Time Reached)
[Bidding Closed]
   │
   ▼ (Run Deterministic Calculation Engine)
[Result Calculated]
   │
   ▼ (Foreman Verifies Minutes & Confirms Result)
[Confirmed] ──► (Generates Journal Entries, Updates Dues & Notifies Members)
```

- **Bidding Validation Rules:**
  1. $0 \le 	ext{Bid Discount} \le (0.30 	imes 	ext{Chit Value})$.
  2. The bidder must be an active subscriber in the scheme.
  3. The bidder must not have won a prior auction in the same scheme (`has_prized == FALSE`).
  4. In case of identical winning bids, selection is executed via a deterministic, transparent random draw (lottery) witnessed by attending subscribers as mandated by Section 16 of the Act.

### 6.3 Payment Processing Lifecycle

```
[Pending]
   │
   ▼ (Member submits UPI ref / Cheque copy)
[Submitted]
   │
   ▼ (Accountant inspects bank feed)
[Under Verification]
   │
   ├───► (Valid bank match) ───────► [Paid] (Generates Receipt & Journal Entry)
   │
   └───► (Invalid reference/bounce) ─► [Rejected] (Notifies Member with Reason)
```

### 6.4 Payout Lifecycle

```
[Awaiting Security]
   │
   ▼ (Prized subscriber submits salary guarantee / surety / mortgage)
[Security Verified] (Foreman & Accountant sign-off under Sec 31)
   │
   ▼ (Deduct pending dues if any)
[Approved]
   │
   ▼ (Initiate NEFT/RTGS/Cheque)
[Processing]
   │
   ▼ (Bank settlement confirmed)
[Paid]
```

---

## 7. RESTful API Architecture (FastAPI)

### 7.1 Role-Based Access Control (RBAC) Permissions Matrix

| Endpoint Route | Method | Super Admin | Chit Organiser | Accountant | Member | Scope Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `/api/v1/auth/otp/send` | `POST` | Yes | Yes | Yes | Yes | Public authentication trigger |
| `/api/v1/auth/otp/verify` | `POST` | Yes | Yes | Yes | Yes | Issues scoped JWT access token |
| `/api/v1/schemes` | `POST` | No | Yes | No | No | Create new chit scheme |
| `/api/v1/schemes` | `GET` | Yes | Yes (Own) | Yes (Own) | No | List organiser schemes |
| `/api/v1/schemes/{id}/members` | `POST` | No | Yes | Yes | No | Enrol member to scheme |
| `/api/v1/auctions/{id}/bids` | `POST` | No | Yes | Yes | Yes (Own) | Submit auction bid |
| `/api/v1/auctions/{id}/confirm` | `POST` | No | Yes | No | No | Lock and publish auction result |
| `/api/v1/payments/submit` | `POST` | No | Yes | Yes | Yes (Own) | Submit payment reference |
| `/api/v1/payments/{id}/verify` | `POST` | No | Yes | Yes | No | Verify & book payment |
| `/api/v1/payouts/{id}/disburse` | `POST` | No | Yes | No | No | Authorize prize money release |
| `/api/v1/ledger/reports/trial-balance`| `GET` | No | Yes | Yes | No | Export double-entry trial balance |
| `/api/v1/member/dashboard` | `GET` | No | No | No | Yes (Own) | Member 10-second summary |
| `/api/v1/member/receipts/{id}` | `GET` | No | Yes | Yes | Yes (Own) | Download verified payment receipt |

### 7.2 Core API Schema Definitions

#### Auction Result Confirmation Payload
```json
POST /api/v1/auctions/{auction_id}/confirm
Headers:
  Authorization: Bearer <JWT>
  Idempotency-Key: "7b3b3e2a-14d2-43bb-a309-8b4f17429188"
Body:
{
  "winning_member_id": "4a719be6-d8cb-4e32-9cb7-7ef9bc2891d4",
  "winning_bid_discount": 26000.00,
  "foreman_commission": 4000.00,
  "custom_minutes_note": "Auction held in registered office with 8 members present physically and 2 via mobile portal."
}
```

#### Auction Confirmation Response (Deterministic Computation)
```json
HTTP/1.1 200 OK
Content-Type: application/json
{
  "status": "success",
  "data": {
    "auction_id": "9d9036f8-450e-436f-87d2-7c3905cf7149",
    "auction_number": 2,
    "scheme_id": "53e00cfb-18cf-4a41-b0db-619f7cc91e92",
    "chit_value": 100000.00,
    "winning_payout": 74000.00,
    "auction_discount": 26000.00,
    "foreman_commission": 4000.00,
    "member_dividend_pool": 22000.00,
    "eligible_members_count": 10,
    "dividend_per_member": 2200.00,
    "net_next_subscription": 7800.00,
    "rounding_residual": 0.00,
    "journal_entry_id": "c1f7da3b-586b-4e4b-9720-33ffbd229560",
    "payout_record_id": "8792dc86-218d-4f10-94e8-fecbb7801b63"
  }
}
```

---

## 8. Statutory & Regulatory Compliance Blueprint

Chit funds are stringently governed financial institutions in India. ChitFlow incorporates regulatory controls specifically mapped to the **Chit Funds Act, 1982** and **Telangana Chit Funds Rules, 2008**.

```
+-------------------------------------------------------------------------+
|                  STATUTORY COMPLIANCE CHECKPOINTS                       |
+-------------------------------------------------------------------------+
| Section 4: Prior Sanction & Registration                                |
|  - System prevents marking scheme 'Active' until State Govt Prior       |
|    Sanction Order (PSO) number and Certificate of Commencement are filed|
+-------------------------------------------------------------------------+
| Section 20: 100% Security Deposit                                       |
|  - Organiser must record bank Fixed Deposit receipt equal to 100% of    |
|    Chit Value pledged in favour of Registrar of Chits.                  |
+-------------------------------------------------------------------------+
| Section 15: Foreman 1st Month Entitlement                               |
|  - Auction #1 is auto-reserved for the Foreman. No auction discount is  |
|    applied; Prize payout equals Gross Chit Value (V).                   |
+-------------------------------------------------------------------------+
| Section 21(1)(b): 5% Commission Ceiling                                 |
|  - Commission is hard-capped at 5% of chit value. System rejects any    |
|    scheme configuration exceeding 5.00%.                                |
+-------------------------------------------------------------------------+
| 2019 Amendment: 30% Maximum Discount                                    |
|  - Bidding engine rejects any reverse bid discount > 30% of Chit Value. |
+-------------------------------------------------------------------------+
| Section 17 & 18: Minutes of Proceedings                                 |
|  - Auto-generates statutory Minutes Form with subscriber attendance,    |
|    bids, winner signature space; flags compliance if not submitted to   |
|    Registrar within 21 days of auction.                                 |
+-------------------------------------------------------------------------+
| Section 31: Prized Subscriber Security                                  |
|  - Payout state machine halts release of prize money until foreman signs|
|    off on sufficient security (immovable property / bank guarantee).    |
+-------------------------------------------------------------------------+
```

### Digital Personal Data Protection (DPDP) Act, 2023 Compliance
1. **Purpose Limitation:** Member Aadhaar/PAN documents are encrypted at rest with envelope encryption (AES-256-GCM) and accessible only for authorized KYC verification.
2. **Right to Correction:** Members can request updates to permitted profile fields with audit-logged approval workflows.
3. **Audit Immutability:** Audit trail records user actions with SHA-256 HMAC hash chaining to ensure forensic integrity during inspection by the Registrar of Chits or judicial bodies.

---

## 9. Non-Functional Architecture & Resilience

### 9.1 Concurrency & Anti-Double-Prize Guarantees
During high-traffic auction windows, multiple members may place simultaneous bids. To eliminate race conditions:
- **Distributed Mutex:** Redis-based distributed lock (`redis-lock:auction:{id}`) controls critical section entry during bid recording.
- **Pessimistic Row-Level Lock:** PostgreSQL query locks the auction row during finalization:
  ```sql
  SELECT id, status, winning_bid_discount FROM auctions 
  WHERE id = :auction_id FOR UPDATE;
  ```
- **Prize Idempotency Invariant:** A unique partial index on `scheme_members(scheme_id) WHERE has_prized = TRUE` prevents any ticket from winning twice in the same scheme.

### 9.2 Indian Locale & Localization Engine
- **Number Formatting:** Standard Indian numbering system (e.g., `₹1,00,000.00` instead of `₹100,000.00`).
- **Bilingual Interface:** First-class support for English and Telugu (`te-IN`), with plain-language financial terms:
  - English: *"Your ₹1,250 dividend has been deducted from this month's ₹5,000 payment."*
  - Telugu: *"ఈ నెల ₹5,000 చెల్లింపు నుండి మీ డివిడెండ్ ₹1,250 మినహాయించబడింది. మీరు చెల్లించవలసినది ₹3,750."*
- **Typography & Accessibility:** Contrast ratio $\ge 4.5:1$, touch targets $\ge 48	ext{px} 	imes 48	ext{px}$, full keyboard navigability.

---

## 10. Implementation Roadmap & Sprint Plan

The MVP is organized into 5 progressive phases executed across 10 two-week engineering sprints.

```
+--------------------------------------------------------------------------------------------------+
| SPRINT 1-2: FOUNDATION & AUTHENTICATION                                                          |
| - Setup FastAPI, PostgreSQL, Redis, and Alembic migrations.                                      |
| - Implement Mobile OTP auth, JWT session management, RBAC, and Organiser/Member profile models.  |
| - Deliver Organiser & Member dashboard scaffolding.                                              |
+--------------------------------------------------------------------------------------------------+
| SPRINT 3-4: SCHEME & MEMBER ENROLMENT ENGINE                                                     |
| - Implement Chit Scheme creation form with locked parameter state machine.                       |
| - Build Member management, CSV bulk import, and ticket allocation.                               |
| - Statutory PSO and 100% security deposit tracking integration.                                  |
+--------------------------------------------------------------------------------------------------+
| SPRINT 5-6: DETERMINISTIC FINANCIAL & AUCTION ENGINE                                             |
| - Implement Decimal financial calculation engine with unit tests for Schemes A & B.              |
| - Build Auction execution module, bid validation, reverse auction ranking, and minutes generator. |
| - Deploy Immutable Double-Entry Ledger and automatic Journal Entry mapper.                       |
+--------------------------------------------------------------------------------------------------+
| SPRINT 7-8: PAYMENTS, PAYOUTS & MEMBER DASHBOARD                                                 |
| - Implement Payment collection, verification workflow, and automated PDF receipt generation.      |
| - Build Payout security verification workflow and disbursement state machine.                    |
| - Complete Member 10-second dashboard, personal ledgers, and dividend statements.                |
+--------------------------------------------------------------------------------------------------+
| SPRINT 9-10: REPORTING, RECONCILIATION & PRODUCTION HARDENING                                    |
| - Build statutory Registrar reporting, Collection reports, Defaulter ageing reports, Trial Balance.|
| - Concurrency load testing, penetration testing, automated backup & restore verification.        |
| - End-to-end acceptance test verification & Production deployment.                                |
+--------------------------------------------------------------------------------------------------+
```

---

## 11. Acceptance Criteria Verification Matrix

| PRD Acceptance Criterion | Architecture Component | Verification Method |
| :--- | :--- | :--- |
| **10-month ₹1L Chit Support** | Calculation Engine & Scheme Module | Unit test `test_scheme_a_10m` passed (Payout: ₹74k, Dividend: ₹2,200). |
| **20-month ₹1L Chit Support** | Calculation Engine & Scheme Module | Unit test `test_scheme_b_20m` passed (Payout: ₹71k, Dividend: ₹1,250). |
| **Member Allocation & Tickets**| `scheme_members` with Unique Constraints | DB constraint `uq_scheme_ticket` prevents ticket collisions. |
| **Deterministic Calculations**| `calc_engine.py` (Python `Decimal`) | 100% fixed-point math with paise quantization; zero float usage. |
| **Commission Visibility** | Ledger Account `4010` & API responses | Explicit `foreman_commission` field in API and payment receipts. |
| **Immutable Financial Audit** | Double-Entry General Ledger | No `UPDATE` or `DELETE` grants on `journal_entries`; reversal pattern enforced. |
| **Receipt Generation** | Background PDF Worker | Unique receipt number generation with verified verification signature. |
| **Cross-Platform Compatibility**| Responsive React PWA | WCAG 2.2 AA compliant, tested across Android Chrome, iOS Safari, Windows. |
| **Traceability of Rupee** | Journal Entry Line Item Mapping | Every credit has an equal and opposite debit tied to scheme & member. |

---

*ChitFlow Technical Architecture Document — Ready for Technical Execution.*
