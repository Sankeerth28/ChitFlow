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

export interface AuctionItem {
  id: string;
  scheme_id: string;
  auction_number: number;
  scheduled_datetime: string;
  actual_datetime?: string;
  status: 'scheduled' | 'bidding_open' | 'bidding_closed' | 'confirmed';
  winning_member_id?: string;
  winning_member_name?: string;
  winning_member_code?: string;
  winning_bid_discount: number;
  winning_payout: number;
  foreman_commission: number;
  dividend_pool: number;
  dividend_per_member: number;
  rounding_residual: number;
  minutes_of_auction?: string;
}

export async function fetchAuctionsByScheme(schemeId: string): Promise<AuctionItem[]> {
  const res = await fetch(`${API_BASE_URL}/auctions/schemes/${schemeId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch auctions.');
  }
  return res.json();
}

export async function submitBid(auctionId: string, memberId: string, discountAmount: number): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/auctions/${auctionId}/bids`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      member_id: memberId,
      bid_discount_amount: discountAmount,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit auction bid.');
  }
  return res.json();
}

export async function confirmAuction(
  auctionOrSchemeId: string,
  arg2?: string | { instalment_number?: number; winner_member_id?: string; winning_bid_discount?: number; minutes?: string },
  arg3?: number,
  arg4?: string
): Promise<AuctionItem> {
  let memberId: string | undefined;
  let discount: number | undefined;
  let minutes: string | undefined;

  if (typeof arg2 === 'object' && arg2 !== null) {
    memberId = arg2.winner_member_id;
    discount = arg2.winning_bid_discount;
    minutes = arg2.minutes;
  } else {
    memberId = arg2;
    discount = arg3;
    minutes = arg4;
  }

  const res = await fetch(`${API_BASE_URL}/auctions/${auctionOrSchemeId}/confirm`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      winning_member_id: memberId || null,
      winning_bid_discount: discount || 0,
      minutes_of_auction: minutes || `Auction confirmed under Telangana Chit Funds Rules.`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to confirm auction.');
  }
  return res.json();
}
