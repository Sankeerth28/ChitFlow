"""
ChitFlow Security & Cryptography Core
- BCrypt direct password and PIN hashing (salted, safe against length exploits)
- JSON Web Token (JWT) encode/decode with expiry and JTI tracking
- Secure secret management via environment variables
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
from jose import jwt, JWTError

# Cryptographic Configuration
INSECURE_DEV_SECRET = "chitflow-super-secret-production-signing-key-2026-secure"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
_raw_secret = os.getenv("SECRET_KEY")

if ENVIRONMENT in ("production", "prod"):
    if not _raw_secret:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY environment variable is mandatory in production."
        )
    if _raw_secret == INSECURE_DEV_SECRET or len(_raw_secret) < 32:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY in production must be a high-entropy secret of at least 32 characters and cannot match the development placeholder."
        )
    SECRET_KEY = _raw_secret
else:
    # In development or testing, fallback with safe warning
    SECRET_KEY = _raw_secret if _raw_secret else INSECURE_DEV_SECRET

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours


def hash_password(password: str) -> str:
    """
    Hash password using direct bcrypt with unique salt.
    Rejects passwords exceeding 72 bytes per strict security requirements.
    """
    if not password:
        raise ValueError("Password cannot be empty.")
    pwd_bytes = password.encode('utf-8')
    if len(pwd_bytes) > 72:
        raise ValueError("Password cannot exceed 72 bytes in length.")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plain password against stored bcrypt hash.
    Rejects passwords exceeding 72 bytes immediately without silent truncation.
    """
    if not plain_password or not hashed_password:
        return False
    pwd_bytes = plain_password.encode('utf-8')
    if len(pwd_bytes) > 72:
        return False
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(
    user_id: str,
    role: str,
    organiser_id: Optional[str] = None,
    member_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> Dict[str, Any]:
    """
    Create a signed JWT access token containing standard claims:
    - sub: user_id
    - role: RBAC role (super_admin, organiser, accountant, member)
    - org: organiser_id (tenant boundary)
    - mem: member_id (if member role)
    - jti: unique token identifier for server-side revocation / logout
    - exp: expiration timestamp
    - iat: issued-at timestamp
    """
    now = datetime.utcnow()
    expires = now + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    jti = str(uuid.uuid4())

    claims = {
        "sub": user_id,
        "role": role,
        "org": organiser_id,
        "mem": member_id,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }

    token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
    return {
        "token": token,
        "jti": jti,
        "expires_at": expires,
        "claims": claims,
    }


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token. Raises JWTError if invalid or expired."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

