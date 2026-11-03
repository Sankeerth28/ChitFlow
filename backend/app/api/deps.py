from typing import Generator
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Organiser


def get_current_organiser(db: Session = Depends(get_db)) -> Organiser:
    """
    Dependency to obtain the default or current tenant organiser.
    Creates a default demo organiser if none exists.
    """
    org = db.query(Organiser).first()
    if not org:
        org = Organiser(
            business_name="Sri Balaji Chit Funds Pvt. Ltd.",
            trade_license_number="TL/HYD/2026/8941",
            chit_registrar_registration_no="REG/TS/HYD/CHIT/2026/042",
            state="Telangana",
            contact_phone="9849012345",
            contact_email="accounts@sribalajichits.in",
        )
        db.add(org)
        db.commit()
        db.refresh(org)
    return org
