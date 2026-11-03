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

export interface RecentTransactionItem {
  id: string;
  type: string;
  title: string;
  amount: number;
  date: string;
  status: string;
  party: string;
  method?: string;
}

export interface RecentRegistrationItem {
  id: string;
  member_code: string;
  full_name: string;
  mobile_number?: string;
  city: string;
  status: string;
  kyc_status: string;
  created_at: string;
}

export interface ActionAlertItem {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  target_tab?: string;
}

export interface AdminDashboardMetrics {
  active_chits: number;
  total_members: number;
  monthly_collections: number;
  pending_collections: number;
  upcoming_auctions: number;
  pending_payouts: number;
  outstanding_amount: number;
  recorded_commission: number;
  active_members: number;
  inactive_members: number;
  total_enrolled_tickets: number;
  total_active_schemes: number;
  pending_verification_count: number;
  pending_verification_amount: number;
  auctions_conducted: number;
  recent_transactions: RecentTransactionItem[];
  recent_registrations: RecentRegistrationItem[];
  action_alerts: ActionAlertItem[];
}

export async function fetchAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const res = await fetch(`${API_BASE_URL}/reports/dashboard/admin`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch administrative dashboard metrics.');
  }
  return res.json();
}

