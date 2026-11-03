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

export interface ChitSchemeItem {
  id: string;
  organiser_id: string;
  scheme_code: string;
  scheme_name: string;
  chit_value: number;
  monthly_subscription: number;
  duration_months: number;
  total_months?: number;
  current_month?: number;
  total_members: number;
  commission_percentage: number;
  foreman_commission_rate?: number;
  max_discount_percentage: number;
  max_bid_discount_rate?: number;
  start_date: string;
  monthly_due_day: number;
  auction_day: number;
  pso_number?: string;
  registrar_pso_number?: string;
  fd_receipt_number?: string;
  status: 'draft' | 'active' | 'completed' | 'terminated';
  rules_locked: boolean;
  enrolled_members_count?: number;
  created_at: string;
}

export interface SchemeCreatePayload {
  scheme_code: string;
  scheme_name: string;
  chit_value: number;
  monthly_subscription: number;
  duration_months?: number;
  total_months?: number;
  total_members?: number;
  commission_percentage?: number;
  foreman_commission_rate?: number;
  max_discount_percentage?: number;
  max_bid_discount_rate?: number;
  min_bid_discount_rate?: number;
  start_date?: string;
  monthly_due_day?: number;
  auction_day?: number;
  pso_number?: string;
  registrar_pso_number?: string;
  fd_receipt_number?: string;
}

export async function fetchSchemes(): Promise<ChitSchemeItem[]> {
  const res = await fetch(`${API_BASE_URL}/schemes`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch chit schemes.');
  }
  const data = await res.json();
  return data.map((s: any) => ({
    ...s,
    total_months: s.total_months ?? s.duration_months,
    foreman_commission_rate: s.foreman_commission_rate ?? s.commission_percentage,
    max_bid_discount_rate: s.max_bid_discount_rate ?? s.max_discount_percentage,
    registrar_pso_number: s.registrar_pso_number ?? s.pso_number,
  }));
}

export async function createScheme(payload: SchemeCreatePayload): Promise<ChitSchemeItem> {
  const body = {
    scheme_code: payload.scheme_code,
    scheme_name: payload.scheme_name,
    chit_value: payload.chit_value,
    monthly_subscription: payload.monthly_subscription,
    duration_months: payload.duration_months ?? payload.total_months ?? 10,
    total_members: payload.total_members ?? payload.total_months ?? 10,
    commission_percentage: payload.commission_percentage ?? payload.foreman_commission_rate ?? 5,
    max_discount_percentage: payload.max_discount_percentage ?? payload.max_bid_discount_rate ?? 30,
    start_date: payload.start_date || new Date().toISOString().split('T')[0],
    monthly_due_day: payload.monthly_due_day || 5,
    auction_day: payload.auction_day || 10,
    pso_number: payload.pso_number || payload.registrar_pso_number || 'PSO-DEFAULT',
    fd_receipt_number: payload.fd_receipt_number || 'FD-100-VERIFIED',
  };

  const res = await fetch(`${API_BASE_URL}/schemes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create chit scheme.');
  }
  return res.json();
}

export async function activateScheme(schemeId: string): Promise<ChitSchemeItem> {
  const res = await fetch(`${API_BASE_URL}/schemes/${schemeId}/activate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to activate scheme.');
  }
  return res.json();
}

export async function enrollMemberInScheme(schemeId: string, memberId: string, ticketNumber: number): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/schemes/${schemeId}/members`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      member_id: memberId,
      chit_ticket_number: ticketNumber,
      enrollment_date: new Date().toISOString().split('T')[0],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to enroll member.');
  }
  return res.json();
}

export async function fetchSchemeEnrolledMembers(schemeId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/schemes/${schemeId}/members`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch enrolled members.');
  }
  return res.json();
}

// Aliases
export type SchemeItem = ChitSchemeItem;
export const listSchemes = fetchSchemes;
export const enrolMemberInScheme = enrollMemberInScheme;
