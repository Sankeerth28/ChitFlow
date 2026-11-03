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

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function getAuthHeaders(): HeadersInit {
  const token = authStorage.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface MemberItem {
  id: string;
  organiser_id: string;
  member_code: string;
  full_name: string;
  mobile_number?: string;
  email?: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  emergency_contact?: string;
  kyc_status: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at?: string;
  active_schemes_count?: number;
}

export interface MemberPaginatedResponse {
  items: MemberItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface EnrolledSchemeItem {
  scheme_member_id: string;
  scheme_id: string;
  scheme_code: string;
  scheme_name: string;
  chit_value: number;
  monthly_subscription: number;
  duration_months: number;
  chit_ticket_number: number;
  ticket_number?: number;
  enrollment_date: string;
  has_prized?: boolean;
  is_prized?: boolean;
  prize_month?: number;
  scheme_status?: string;
  current_month?: number;
  total_paid: number;
  total_dividend?: number;
  total_dividend_earned?: number;
  outstanding_balance?: number;
  balance_due?: number;
}

export interface MemberReceiptItem {
  id?: string;
  payment_id: string;
  receipt_number: string;
  payment_date: string;
  scheme_name: string;
  instalment_number: number;
  amount: number;
  amount_received?: number;
  payment_mode: string;
  payment_method?: string;
  transaction_ref?: string;
  payment_reference_no?: string;
  status: string;
  verification_status?: string;
}

export interface MemberDueItem {
  instalment_id?: string;
  scheme_id: string;
  scheme_code?: string;
  scheme_name: string;
  instalment_number: number;
  gross_subscription: number;
  dividend_amount: number;
  net_due: number;
  amount_paid?: number;
  due_date?: string;
  status?: string;
}

export interface MemberProfile {
  member: MemberItem;
  enrolled_schemes: EnrolledSchemeItem[];
  payment_receipts: MemberReceiptItem[];
  outstanding_dues: MemberDueItem[];
}

export interface MemberDashboardSummary {
  member_id: string;
  member_code: string;
  full_name: string;
  total_active_chits: number;
  total_chit_value: number;
  total_paid_so_far: number;
  total_dividends_earned: number;
  total_balance_payable: number;
  next_auction_date?: string;
  next_auction_scheme?: string;
  next_payment_date?: string;
  next_due_amount: number;
  has_prized_any: boolean;
}

export interface MemberCreatePayload {
  member_code?: string;
  full_name: string;
  mobile_number: string;
  email?: string;
  address_line1: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergency_contact?: string;
  kyc_status?: string;
  status?: string;
}

export interface CsvImportResult {
  total_rows?: number;
  imported_count: number;
  success_count: number;
  skipped_count: number;
  error_count: number;
  errors: Array<{ row: number; error: string; field?: string; reason?: string; raw_data?: Record<string, any> }>;
}

export async function fetchMembers(params?: {
  search?: string;
  status?: string;
  kyc_status?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
}): Promise<MemberPaginatedResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.status) query.append('status', params.status);
  if (params?.kyc_status) query.append('kyc_status', params.kyc_status);
  if (params?.sort_by) query.append('sort_by', params.sort_by);
  if (params?.sort_order) query.append('sort_order', params.sort_order);
  query.append('page', String(params?.page || 1));
  query.append('page_size', String(params?.page_size || 10));

  const res = await fetch(`${API_BASE_URL}/members?${query.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch members.');
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      page_size: data.length,
      total_pages: 1,
    };
  }
  return data;
}

export async function createMember(payload: MemberCreatePayload): Promise<MemberItem> {
  const res = await fetch(`${API_BASE_URL}/members`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create member subscriber.');
  }
  return res.json();
}

export async function updateMember(memberId: string, payload: Partial<MemberCreatePayload>): Promise<MemberItem> {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update member information.');
  }
  return res.json();
}

export async function updateMemberStatus(memberId: string, status: string, reason?: string): Promise<MemberItem> {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update member status.');
  }
  return res.json();
}

export async function fetchMemberProfile(memberId: string): Promise<MemberProfile> {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}/profile`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch member 360 profile.');
  }
  const profile: MemberProfile = await res.json();
  // Normalize fields (the API exposes `recent_payments`, the portal calls them receipts)
  profile.enrolled_schemes = (profile.enrolled_schemes || []).map((s) => ({
    ...s,
    ticket_number: s.ticket_number ?? s.chit_ticket_number,
    is_prized: s.is_prized ?? s.has_prized,
    chit_value: toNumber(s.chit_value),
    monthly_subscription: toNumber(s.monthly_subscription),
    total_paid: toNumber(s.total_paid),
    total_dividend_earned: toNumber(s.total_dividend_earned ?? s.total_dividend),
    balance_due: toNumber(s.balance_due ?? s.outstanding_balance),
  }));
  const rawReceipts = (profile as any).payment_receipts || (profile as any).recent_payments || [];
  profile.payment_receipts = rawReceipts.map((r: any) => ({
    ...r,
    id: r.id || r.payment_id,
    amount: toNumber(r.amount ?? r.amount_received),
    payment_mode: r.payment_mode || r.payment_method || 'CASH',
    transaction_ref: r.transaction_ref || r.payment_reference_no || '',
    status: r.status || r.verification_status || 'verified',
  }));
  profile.outstanding_dues = (profile.outstanding_dues || []).map((d: any) => ({
    ...d,
    scheme_id: d.scheme_id || '',
    gross_subscription: toNumber(d.gross_subscription),
    dividend_amount: toNumber(d.dividend_amount ?? d.dividend_credit),
    net_due: toNumber(d.net_due ?? d.balance_due ?? d.net_amount_due),
  }));
  return profile;
}

export async function fetchMemberEnrolledChits(memberId: string): Promise<EnrolledSchemeItem[]> {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}/enrolled-chits`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch enrolled chit schemes.');
  }
  const list: EnrolledSchemeItem[] = await res.json();
  return list.map((s) => ({
    ...s,
    ticket_number: s.ticket_number ?? s.chit_ticket_number,
    is_prized: s.is_prized ?? s.has_prized,
    chit_value: toNumber(s.chit_value),
    monthly_subscription: toNumber(s.monthly_subscription),
    total_paid: toNumber(s.total_paid),
    total_dividend_earned: toNumber(s.total_dividend_earned ?? s.total_dividend),
    balance_due: toNumber(s.balance_due ?? s.outstanding_balance),
  }));
}

export async function fetchMemberReceipts(memberId: string): Promise<MemberReceiptItem[]> {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}/receipts`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch payment receipts.');
  }
  const list: MemberReceiptItem[] = await res.json();
  return list.map((r) => ({
    ...r,
    id: r.id || r.payment_id,
    amount: toNumber(r.amount ?? r.amount_received),
    payment_mode: r.payment_mode || r.payment_method || 'CASH',
    transaction_ref: r.transaction_ref || r.payment_reference_no || '',
    status: r.status || r.verification_status || 'verified',
  }));
}

export async function fetchMemberDues(memberId: string): Promise<MemberDueItem[]> {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}/dues`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch instalment dues.');
  }
  const list: any[] = await res.json();
  return list.map((d) => ({
    ...d,
    scheme_id: d.scheme_id || '',
    gross_subscription: toNumber(d.gross_subscription),
    dividend_amount: toNumber(d.dividend_amount ?? d.dividend_credit),
    net_due: toNumber(d.net_due ?? d.balance_due ?? d.net_amount_due),
  }));
}

export async function fetchMember10SecDashboard(memberId: string): Promise<MemberDashboardSummary> {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}/dashboard`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch member dashboard summary.');
  }
  return res.json();
}

export async function importMembersCsv(csvContent: string, _hasHeader?: boolean): Promise<CsvImportResult> {
  const res = await fetch(`${API_BASE_URL}/members/import-csv`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ csv_content: csvContent }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to import CSV members.');
  }
  const data = await res.json();
  return {
    ...data,
    success_count: data.success_count ?? data.imported_count ?? 0,
    error_count: data.error_count ?? (data.errors ? data.errors.length : 0),
    errors: (data.errors || []).map((e: any) => ({
      row: e.row,
      error: e.error || `${e.field}: ${e.reason}`,
      field: e.field || '',
      reason: e.reason || e.error || '',
      raw_data: e.raw_data,
    })),
  };
}

// Aliases for backwards and alternative naming compatibility
export const listMembers = fetchMembers;
export const getMember = async (memberId: string): Promise<MemberItem> => {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Member not found');
  return res.json();
};
export const getMemberProfile = fetchMemberProfile;
export const getMemberEnrolledChits = fetchMemberEnrolledChits;
export const getMemberReceipts = fetchMemberReceipts;
export const getMemberDues = fetchMemberDues;

export type MemberFullProfile = MemberProfile;
export type MemberPaymentReceipt = MemberReceiptItem;
export type MemberDueDetail = MemberDueItem;
