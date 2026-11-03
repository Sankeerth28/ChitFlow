from pydantic import Field, field_validator
from app.schemas.base import APIModel
from typing import Optional
from datetime import datetime


class LoginRequest(APIModel):
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$", example="9849012345")
    password: Optional[str] = Field(None, min_length=6, max_length=72, example="OrganiserPassword123!")
    pin: Optional[str] = Field(None, min_length=4, max_length=6, example="1234")

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.encode("utf-8")) > 72:
            raise ValueError("Password cannot exceed 72 bytes in UTF-8 encoding.")
        return v


class RegisterRequest(APIModel):
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$", example="9876543299")
    password: str = Field(..., min_length=6, max_length=72, example="SecurePassword123!")
    full_name: str = Field(..., min_length=2, max_length=255, example="K. Venkat Rao")
    role: str = Field(default="member", example="member")  # organiser, accountant, member
    organiser_id: Optional[str] = Field(None, description="Organiser ID if member or accountant")
    business_name: Optional[str] = Field(None, description="Required if registering as a new Organiser")

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password cannot exceed 72 bytes in UTF-8 encoding.")
        return v


class UserResponse(APIModel):
    id: str
    mobile_number: str
    role: str
    organiser_id: Optional[str] = None
    is_active: bool
    is_verified: bool
    member_id: Optional[str] = None
    full_name: Optional[str] = None
    business_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class AccountRecoveryRequest(APIModel):
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$", example="9849012345")


class AccountRecoveryResponse(APIModel):
    status: str
    message: str
    otp_provider_status: str = "unconfigured"

