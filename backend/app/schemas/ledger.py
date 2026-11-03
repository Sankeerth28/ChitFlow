from pydantic import BaseModel
from decimal import Decimal
from typing import List, Optional
from datetime import date, datetime


class LedgerAccountResponse(BaseModel):
    id: str
    account_code: str
    account_name: str
    account_type: str
    current_balance: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class JournalLineResponse(BaseModel):
    id: str
    account_code: str
    account_name: str
    debit_amount: Decimal
    credit_amount: Decimal
    memo: Optional[str] = None


class JournalEntryResponse(BaseModel):
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


class TrialBalanceLine(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    total_debit: Decimal
    total_credit: Decimal
    net_balance: Decimal


class TrialBalanceResponse(BaseModel):
    as_of_date: date
    lines: List[TrialBalanceLine]
    total_debits: Decimal
    total_credits: Decimal
    is_balanced: bool

