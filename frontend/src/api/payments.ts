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

export interface PaymentItem {
  id: string;
  receipt_number: string;
  scheme_name: string;
  scheme_code?: string;
  instalment_number: number;
  member_id: string;
  member_name: string;
  member_code?: string;
  gross_subscription?: number;
  dividend_credit?: number;
  net_amount_due?: number;
  amount_received?: number;
  amount: number;
  payment_method?: string;
  payment_mode: string;
  payment_reference_no?: string;
  transaction_ref?: string;
  payment_date: string;
  verification_status?: 'submitted' | 'paid' | 'rejected';
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
}

export async function fetchPayments(params?: {
  status_filter?: string;
  status?: string;
  scheme_id?: string;
  member_id?: string;
  limit?: number;
}): Promise<PaymentItem[]> {
  const query = new URLSearchParams();
  const filter = params?.status || params?.status_filter;
  if (filter && filter !== 'all') query.append('status_filter', filter);
  if (params?.scheme_id) query.append('scheme_id', params.scheme_id);
  if (params?.member_id) query.append('member_id', params.member_id);
  if (params?.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/payments?${query.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch payments.');
  }
  const data = await res.json();
  return data.map((p: any) => ({
    ...p,
    id: p.id || p.payment_id || p.receipt_number,
    amount: p.amount ?? p.amount_received ?? 0,
    payment_mode: p.payment_mode || p.payment_method || 'CASH',
    transaction_ref: p.transaction_ref || p.payment_reference_no || '',
    status: p.status || (p.verification_status === 'paid' ? 'verified' : p.verification_status || 'pending'),
  }));
}

export async function recordPayment(payload: {
  member_id: string;
  scheme_id: string;
  instalment_number: number;
  amount: number;
  payment_mode: string;
  transaction_ref?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/payments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to record payment collection.');
  }
  return res.json();
}

export async function submitPayment(payload: {
  instalment_id?: string;
  scheme_id?: string;
  member_id?: string;
  instalment_number?: number;
  amount_received?: number;
  amount?: number;
  payment_method?: string;
  payment_mode?: string;
  payment_reference_no?: string;
  transaction_ref?: string;
  payment_date?: string;
  proof_document_url?: string;
}): Promise<PaymentItem> {
  const res = await fetch(`${API_BASE_URL}/payments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      scheme_id: payload.scheme_id,
      member_id: payload.member_id,
      instalment_number: payload.instalment_number || 1,
      amount: payload.amount ?? payload.amount_received ?? 0,
      payment_mode: payload.payment_mode || payload.payment_method || 'UPI',
      transaction_ref: payload.transaction_ref || payload.payment_reference_no || `TXN-${Date.now()}`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit payment.');
  }
  return res.json();
}

export async function verifyPayment(
  paymentId: string,
  statusVal: 'paid' | 'rejected' = 'paid',
  notes?: string
): Promise<PaymentItem> {
  const res = await fetch(`${API_BASE_URL}/payments/${paymentId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      status: statusVal,
      verification_notes: notes || 'Verified by accountant against bank credit voucher.',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to verify payment.');
  }
  return res.json();
}

export async function rejectPayment(paymentId: string, notes?: string): Promise<PaymentItem> {
  return verifyPayment(paymentId, 'rejected', notes);
}

// Aliases
export const listPayments = fetchPayments;
export type PaymentRecord = PaymentItem;
