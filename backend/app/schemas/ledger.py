from decimal import Decimal
from app.schemas.base import APIModel
from typing import List, Optional
from datetime import date, datetime


class LedgerAccountResponse(APIModel):
    id: str
    account_code: str
    account_name: str
    account_type: str
    current_balance: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class JournalLineResponse(APIModel):
    id: str
    account_code: str
    account_name: str
    debit_amount: Decimal
    credit_amount: Decimal
    memo: Optional[str] = None


class JournalEntryResponse(APIModel):
    id: str
    entry_number: str
    transaction_date: date
    description: str
    reference_entity_type: str
    reference_entity_id: str
    is_reversal: bool
    reversed_entry_id: Optional[str] = None
    created_at: datetime
    lines: List[JournalLineResponse] = []


class TrialBalanceLine(APIModel):
    account_code: str
    account_name: str
    account_type: str
    total_debit: Decimal
    total_credit: Decimal
    net_balance: Decimal


class TrialBalanceResponse(APIModel):
    as_of_date: date
    lines: List[TrialBalanceLine]
    total_debits: Decimal
    total_credits: Decimal
    is_balanced: bool

