import { authStorage } from './auth';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.includes('chitflow-api.onrender.com')) {
    return envUrl.replace('chitflow-api.onrender.com', 'chitflow-api-weyi.onrender.com');
  }
  if (envUrl) {
    return envUrl;
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://chitflow-api-weyi.onrender.com/api/v1';
  }
  return 'http://localhost:8000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

function getAuthHeaders(): HeadersInit {
  const token = authStorage.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface TrialBalanceLine {
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  net_balance: number;
}

export interface TrialBalanceResponse {
  as_of_date: string;
  lines: TrialBalanceLine[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

export interface JournalLine {
  id?: string;
  account_code: string;
  account_name: string;
  debit_amount?: number;
  credit_amount?: number;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  transaction_date: string;
  entry_date?: string;
  description: string;
  reference_entity_type?: string;
  reference_entity_id?: string;
  reference_id?: string;
  total_amount: number;
  is_reversal: boolean;
  created_at: string;
  lines: JournalLine[];
}

export async function fetchTrialBalance(): Promise<TrialBalanceResponse> {
  const res = await fetch(`${API_BASE_URL}/reports/trial-balance`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch trial balance.');
  }
  return res.json();
}

export async function fetchJournalEntries(): Promise<JournalEntry[]> {
  const res = await fetch(`${API_BASE_URL}/reports/journal-entries`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch journal entries.');
  }
  const data = await res.json();
  return data.map((j: any) => ({
    ...j,
    entry_date: j.entry_date || j.transaction_date,
    reference_id: j.reference_id || j.reference_entity_id || '',
    total_amount: j.total_amount || (j.lines ? j.lines.reduce((s: number, l: any) => s + (l.debit_amount || l.debit || 0), 0) : 0),
    lines: (j.lines || []).map((l: any) => ({
      ...l,
      debit: l.debit ?? l.debit_amount ?? 0,
      credit: l.credit ?? l.credit_amount ?? 0,
    })),
  }));
}

// Aliases
export interface TrialBalanceItem {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

export async function getTrialBalance(): Promise<{
  accounts: TrialBalanceItem[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}> {
  const res = await fetchTrialBalance();
  return {
    accounts: (res.lines || []).map((l) => ({
      code: l.account_code,
      name: l.account_name,
      type: l.account_type,
      debit: l.total_debit,
      credit: l.total_credit,
    })),
    total_debit: res.total_debits || 0,
    total_credit: res.total_credits || 0,
    is_balanced: res.is_balanced,
  };
}

export const listJournalEntries = fetchJournalEntries;
export type JournalEntryItem = JournalEntry;
