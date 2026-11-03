# ChitFlow — Password Security & Credential Management Report

**Document**: Deliverable 4 (`PASSWORD_SECURITY_REPORT.md`)  
**Scope**: Cryptographic Password Hashing, Length Bounds, Truncation Mitigation, and Credential Governance  
**Date**: November 3, 2026  
**Auditor**: Senior QA Engineer, Security Tester & Financial Systems Auditor  

---

## 1. Cryptographic Password Hashing (BCrypt Core)

### 1.1 Direct BCrypt vs Passlib Architecture
* **Library Selection**: ChitFlow uses direct, C-extension `bcrypt` (`bcrypt >= 5.0.0`) rather than the unmaintained `passlib 1.7.4`.
* **Cost Factor (Rounds)**: Hashing is configured to use **12 salt rounds** (`bcrypt.gensalt(rounds=12)`), providing ~250–350ms computation time per hash on modern CPU cores. This strikes an optimal balance between brute-force resistance and denial-of-service prevention on user login.
* **Per-User Salting**: Every call to `hash_password` generates a cryptographically random, independent 128-bit salt.

---

## 2. Password Length & Truncation Vulnerability Analysis

### 2.1 The BCrypt 72-Byte Boundary
The standard OpenBSD `bcrypt` algorithm has an architectural limit: it only processes the first **72 bytes** of input. In naive implementations:
```python
# VULNERABLE PATTERN
pwd_bytes = password.encode('utf-8')[:72]
return bcrypt.hashpw(pwd_bytes, salt)
```
If a user creates an 80-character password such as:
`AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA12345678` (72 `"A"`s + `12345678`),
the last 8 characters are discarded. An attacker attempting to log in with:
`AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCDEFGH` (72 `"A"`s + `ABCDEFGH`)
would be successfully authenticated!

### 2.2 Proof of Vulnerability (Pre-Patch Evidence)
Prior to remediation, the vulnerability was demonstrated in [`backend/tests/test_security_verification.py`](file:///e:/Chit_Fund_app/backend/tests/test_security_verification.py):
```python
base_72 = "A" * 72
extended_pwd = base_72 + "AttackerAppendedChars123!"
hashed = hash_password(extended_pwd)
truncation_occurred = verify_password(base_72, hashed)
# Output: [REPRODUCED VULNERABILITY] Password truncation occurred: True
```

### 2.3 Engineered Defense: Schema & Core Rejection
Rather than silently truncating, ChitFlow now strictly rejects any password whose UTF-8 representation exceeds 72 bytes.

1. **Schema Layer ([`backend/app/schemas/auth.py`](file:///e:/Chit_Fund_app/backend/app/schemas/auth.py#L9-L38))**:
   ```python
   class LoginRequest(BaseModel):
       mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
       password: Optional[str] = Field(None, min_length=6, max_length=72)

       @field_validator("password")
       @classmethod
       def validate_password_bytes(cls, v: Optional[str]) -> Optional[str]:
           if v is not None and len(v.encode("utf-8")) > 72:
               raise ValueError("Password cannot exceed 72 bytes in UTF-8 encoding.")
           return v
   ```
2. **Core Cryptography Layer ([`backend/app/core/security.py`](file:///e:/Chit_Fund_app/backend/app/core/security.py#L32-L55))**:
   ```python
   def hash_password(password: str) -> str:
       if not password:
           raise ValueError("Password cannot be empty.")
       pwd_bytes = password.encode('utf-8')
       if len(pwd_bytes) > 72:
           raise ValueError("Password cannot exceed 72 bytes in length.")
       salt = bcrypt.gensalt(rounds=12)
       return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

   def verify_password(plain_password: str, hashed_password: str) -> bool:
       if not plain_password or not hashed_password:
           return False
       pwd_bytes = plain_password.encode('utf-8')
       if len(pwd_bytes) > 72:
           return False
       try:
           return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))
       except Exception:
           return False
   ```

* **Test Evidence**: Verified by `test_security_verification.py::test_01_passwords_exceeding_72_bytes_are_explicitly_rejected`. Submitting 73 bytes to `/api/v1/auth/register` returns `422 Unprocessable Entity`.

---

## 3. Seeded Test Credentials Audit

### 3.1 Risk of Default Administrative Accounts (SEC-003)
In the initial development build, the application startup routine seeded default accounts (`admin`, `org_demo`, `acct_demo`) with static passwords (`AdminPassword123!`, etc.) if tables were empty. If deployed to production, attackers scanning endpoints could seize total administrative control.

### 3.2 Environment Gating
[`backend/app/main.py`](file:///e:/Chit_Fund_app/backend/app/main.py#L22-L35) now gates credential seeding:
```python
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
ALLOW_DEMO_SEEDING = os.getenv("ALLOW_DEMO_SEEDING", "false").lower() in ("true", "1")

# In FastAPI lifespan:
if ENVIRONMENT not in ("production", "prod") or ALLOW_DEMO_SEEDING:
    # Seed demo records for local development / automated tests
```
In production (`ENVIRONMENT=production`), automatic credential seeding is completely inactive. New organiser entities and administrator accounts must be created through authenticated registration or official migration scripts.

---

## 4. Password Logging & Leakage Audit

A comprehensive code audit was performed to ensure passwords and PINs are never leaked into server logs or API responses:

1. **API Responses**:
   [`UserResponse`](file:///e:/Chit_Fund_app/backend/app/schemas/auth.py#L25-L39) explicitly excludes `password_hash`, `pin_hash`, or any raw credential fields. Only non-sensitive profile attributes (`id`, `mobile_number`, `role`, `organiser_id`, `is_active`) are serialized.
2. **Exception Traces**:
   `hash_password` and `verify_password` do not include password values in error strings or exception messages.
3. **Application Logs**:
   FastAPI endpoint request loggers do not print incoming JSON request bodies on `/api/v1/auth/login` or `/api/v1/auth/register`.

---

## 5. Account Recovery & Password Reset Workflow

* **Current Implementation**:
  [`backend/app/api/v1/auth.py`](file:///e:/Chit_Fund_app/backend/app/api/v1/auth.py#L268-L290) implements `/api/v1/auth/recover`.
  - To prevent user enumeration attacks, querying a non-existent mobile number returns the same HTTP 200 generic message as a registered mobile number.
  - Per the Phase 2A directive, **no fake SMS or mocked OTP provider is implemented**. The endpoint returns:
    ```json
    {
      "status": "unconfigured",
      "message": "SMS/OTP gateway is not configured. Please contact your registered Chit Fund Organiser administrator for credential recovery.",
      "otp_provider_status": "unconfigured"
    }
    ```
* **Test Verification**: Covered in `test_auth_rbac.py::test_10_account_recovery_status_unconfigured`.
