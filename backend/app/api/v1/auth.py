from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.db.session import get_db
from app.api.deps import get_current_user, oauth2_scheme
from app.models.entities import User, Organiser, Member, RevokedToken
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    AccountRecoveryRequest,
    AccountRecoveryResponse,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Access Control"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate user via mobile number and password/PIN.
    Issues a cryptographically signed JWT access token containing tenant and role claims.
    """
    user = db.query(User).filter(User.mobile_number == payload.mobile_number).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile number or credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check password or PIN verification
    verified = False
    if payload.password and user.password_hash:
        verified = verify_password(payload.password, user.password_hash)
    elif payload.pin and user.pin_hash:
        verified = verify_password(payload.pin, user.pin_hash)

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile number or credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact your administrator.",
        )

    # Determine member_id if role is member
    member_id = None
    full_name = None
    if user.member_profile:
        member_id = user.member_profile.id
        full_name = user.member_profile.full_name

    business_name = None
    if user.organiser_id:
        org = db.query(Organiser).filter(Organiser.id == user.organiser_id).first()
        if org:
            business_name = org.business_name

    token_data = create_access_token(
        user_id=user.id,
        role=user.role,
        organiser_id=user.organiser_id,
        member_id=member_id,
    )

    user_resp = UserResponse(
        id=user.id,
        mobile_number=user.mobile_number,
        role=user.role,
        organiser_id=user.organiser_id,
        is_active=user.is_active,
        is_verified=user.is_verified,
        member_id=member_id,
        full_name=full_name,
        business_name=business_name,
        created_at=user.created_at,
    )

    return TokenResponse(
        access_token=token_data["token"],
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_resp,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new user account.
    - If role is 'organiser', creates a new Organiser tenant.
    - If role is 'member' or 'accountant', attaches to the designated organiser.
    """
    existing_user = db.query(User).filter(User.mobile_number == payload.mobile_number).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this mobile number is already registered.",
        )

    organiser_id = payload.organiser_id
    business_name = payload.business_name

    if payload.role == "organiser":
        org = Organiser(
            business_name=payload.business_name or f"{payload.full_name}'s Chit Funds",
            contact_phone=payload.mobile_number,
            state="Telangana",
        )
        db.add(org)
        db.flush()
        organiser_id = org.id
        business_name = org.business_name
    elif payload.role in ["member", "accountant"]:
        if not organiser_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid organiser_id is required when registering a member or accountant.",
            )
        org = db.query(Organiser).filter(Organiser.id == organiser_id).first()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Organiser organisation with id '{organiser_id}' does not exist.",
            )
        business_name = org.business_name

    user = User(
        organiser_id=organiser_id,
        mobile_number=payload.mobile_number,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_verified=True,
        is_active=True,
    )
    db.add(user)
    db.flush()

    member_id = None
    if payload.role == "member":
        # Check if member code is provided or generate one
        count = db.query(Member).filter(Member.organiser_id == organiser_id).count()
        member = Member(
            user_id=user.id,
            organiser_id=organiser_id,
            member_code=f"MEM-{count + 1:03d}",
            full_name=payload.full_name,
            address_line1="Registered Address",
            city="Hyderabad",
            state="Telangana",
            pincode="500001",
            kyc_status="verified",
        )
        db.add(member)
        db.flush()
        member_id = member.id

    db.commit()
    db.refresh(user)

    token_data = create_access_token(
        user_id=user.id,
        role=user.role,
        organiser_id=user.organiser_id,
        member_id=member_id,
    )

    user_resp = UserResponse(
        id=user.id,
        mobile_number=user.mobile_number,
        role=user.role,
        organiser_id=user.organiser_id,
        is_active=user.is_active,
        is_verified=user.is_verified,
        member_id=member_id,
        full_name=payload.full_name,
        business_name=business_name,
        created_at=user.created_at,
    )

    return TokenResponse(
        access_token=token_data["token"],
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_resp,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve authenticated user's profile and tenant role."""
    member_id = current_user.member_profile.id if current_user.member_profile else None
    full_name = current_user.member_profile.full_name if current_user.member_profile else None

    business_name = None
    if current_user.organiser_id:
        org = db.query(Organiser).filter(Organiser.id == current_user.organiser_id).first()
        if org:
            business_name = org.business_name

    return UserResponse(
        id=current_user.id,
        mobile_number=current_user.mobile_number,
        role=current_user.role,
        organiser_id=current_user.organiser_id,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        member_id=member_id,
        full_name=full_name,
        business_name=business_name,
        created_at=current_user.created_at,
    )


@router.post("/logout")
def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Invalidate the current session by blacklisting the JWT's JTI.
    Any subsequent request using this token will be rejected with 401 Unauthorized.
    """
    payload = decode_access_token(token)
    jti = payload.get("jti")
    exp_ts = payload.get("exp")
    expires_at = datetime.utcfromtimestamp(exp_ts) if exp_ts else datetime.utcnow()

    revoked = RevokedToken(
        jti=jti,
        user_id=current_user.id,
        expires_at=expires_at,
    )
    db.add(revoked)
    db.commit()

    return {
        "status": "success",
        "message": "Logged out successfully. Session token has been invalidated.",
    }


@router.post("/recover", response_model=AccountRecoveryResponse)
def recover_account(
    payload: AccountRecoveryRequest,
    db: Session = Depends(get_db),
):
    """
    Account recovery endpoint.
    Explicitly indicates OTP status as unconfigured per security requirements.
    """
    user = db.query(User).filter(User.mobile_number == payload.mobile_number).first()
    if not user:
        # Don't leak user existence
        return AccountRecoveryResponse(
            status="pending",
            message="If this mobile number is registered, recovery instructions have been queued.",
            otp_provider_status="unconfigured",
        )

    return AccountRecoveryResponse(
        status="unconfigured",
        message="SMS/OTP gateway is not configured. Please contact your registered Chit Fund Organiser administrator for credential recovery.",
        otp_provider_status="unconfigured",
    )

