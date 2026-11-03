from typing import List, Optional
from datetime import datetime
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError

from app.db.session import get_db
from app.models.entities import User, Organiser, Member, RevokedToken
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Authenticate and extract the active user from the incoming JWT Bearer token.
    Validates token signature, expiration, and ensures token has not been revoked.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session has expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("sub")
        jti: Optional[str] = payload.get("jti")
        if user_id is None or jti is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Check if token was revoked via logout
    revoked = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been invalidated. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account.",
        )

    return user


def get_current_active_organiser(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organiser:
    """
    Dependency for endpoints requiring Organiser tenant context.
    Strictly verifies that the caller is an Organiser or Accountant associated
    with an active tenant organisation.
    """
    if current_user.role not in ["organiser", "accountant"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted strictly to Organisers and Accountants associated with this organisation.",
        )

    if not current_user.organiser_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation requires caller to be associated with an active Organiser tenant. Platform administrators cannot implicitly impersonate an organiser.",
        )

    organiser = db.query(Organiser).filter(Organiser.id == current_user.organiser_id).first()
    if not organiser:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated Organiser record not found.",
        )
    if not organiser.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organiser organisation account is suspended.",
        )

    return organiser


def require_role(allowed_roles: List[str]):
    """
    Factory dependency for role-based authorization guards.
    Ensures that current_user.role is explicitly listed in allowed_roles.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: operation requires one of {allowed_roles} roles. Your role is '{current_user.role}'.",
            )
        return current_user
    return role_checker


def verify_member_access(
    member_id: str,
    current_user: User,
    db: Session,
) -> Member:
    """
    Enforce zero-trust multi-tenant isolation and member privacy.
    - If caller is a Member: can ONLY access their own records.
    - If caller is Organiser/Accountant: can only access members within their tenant organisation.
    - Platform Administrators are barred from inspecting private subscriber financial records.
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member record not found.",
        )

    if current_user.role == "member":
        if not current_user.member_profile or current_user.member_profile.id != member.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Subscribers are strictly prohibited from viewing other members' financial records.",
            )
    elif current_user.role in ["organiser", "accountant"]:
        if member.organiser_id != current_user.organiser_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Member belongs to a different organisation.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Platform administrators are not permitted to inspect private subscriber financial records.",
        )

    return member
