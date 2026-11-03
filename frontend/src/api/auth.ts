/**
 * ChitFlow Authentication API Service
 * Manages JWT tokens securely in sessionStorage (cleared upon tab close, avoiding permanent localStorage persistence).
 */

export function getApiBaseUrl(): string {
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

export interface UserProfile {
  id: string;
  mobile_number: string;
  role: 'super_admin' | 'organiser' | 'accountant' | 'member';
  organiser_id?: string;
  is_active: boolean;
  is_verified: boolean;
  member_id?: string;
  full_name?: string;
  business_name?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
}

const TOKEN_KEY = 'chitflow_auth_token';

export const authStorage = {
  getToken: (): string | null => {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  setToken: (token: string): void => {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  clearToken: (): void => {
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

export async function checkApiHealth(): Promise<boolean> {
  try {
    const rootUrl = API_BASE_URL.replace('/api/v1', '');
    const res = await fetch(`${rootUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loginUser(mobileNumber: string, password?: string, pin?: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile_number: mobileNumber,
        password: password || undefined,
        pin: pin || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Authentication failed. Please verify credentials.');
    }

    const data: AuthResponse = await response.json();
    authStorage.setToken(data.access_token);
    return data;
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
      throw new Error(
        `Unable to reach ChitFlow Cloud Backend (${API_BASE_URL}). If the server is in cold standby (Render free tier), please wait 15-20 seconds and click Sign In again.`
      );
    }
    throw err;
  }
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const token = authStorage.getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      authStorage.clearToken();
      return null;
    }

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  const token = authStorage.getToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch {
      // Best-effort server-side logout
    }
  }
  authStorage.clearToken();
}
