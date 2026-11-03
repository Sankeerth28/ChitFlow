import React, { useState, useEffect } from 'react';
import {
  Gavel,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { listSchemes } from '../api/schemes';
import type { SchemeItem } from '../api/schemes';
import { listMembers } from '../api/members';
import type { MemberItem } from '../api/members';
import { confirmAuction } from '../api/auctions';
import { useToast } from '../components/Toast';

export const AuctionsView: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('');

  // Auction Form State
  const [monthNumber, setMonthNumber] = useState<number>(2);
  const [bidDiscount, setBidDiscount] = useState<number>(26000);
  const [winnerMemberId, setWinnerMemberId] = useState<string>('');
  const [confirming, setConfirming] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [schemesData, membersData] = await Promise.all([
          listSchemes(),
          listMembers({ page: 1, page_size: 100 }),
        ]);
        setSchemes(schemesData);
        setMembers(membersData.items);
        const active = schemesData.find((s: SchemeItem) => s.status === 'active');
        if (active) {
          setSelectedSchemeId(active.id);
          setMonthNumber(active.current_month || 2);
        } else if (schemesData.length > 0) {
          setSelectedSchemeId(schemesData[0].id);
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to initialize auction data', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [showToast]);

  const currentScheme = schemes.find((s) => s.id === selectedSchemeId);

  // Dynamic calculations
  const chitValue = currentScheme?.chit_value || 100000;
  const totalMonths = currentScheme?.total_months || 10;
  const isMonth1 = monthNumber === 1;

  // Limits
  const foremanCommission = Math.round(chitValue * 0.05); // 5% cap Sec 21
  const maxDiscountCeiling = Math.round(chitValue * 0.30); // 30% ceiling 2019 Amendment
  const actualDiscount = isMonth1 ? 0 : Math.min(Math.max(bidDiscount, foremanCommission), maxDiscountCeiling);

  const dividendPool = isMonth1 ? 0 : Math.max(0, actualDiscount - foremanCommission);
  const dividendPerMember = totalMonths > 0 ? Math.round(dividendPool / totalMonths) : 0;
  const prizeAmount = chitValue - actualDiscount;
  const netDueNextMonth = Math.round(chitValue / totalMonths) - dividendPerMember;

  const handleConfirmAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentScheme) return;
    if (!isMonth1 && !winnerMemberId) {
      showToast('Please select the winning bidder subscriber.', 'warning');
      return;
    }
    setConfirming(true);
    try {
      await confirmAuction(currentScheme.id, {
        instalment_number: monthNumber,
        winner_member_id: isMonth1 ? undefined : winnerMemberId,
        winning_bid_discount: actualDiscount,
      });
      showToast(`Month #${monthNumber} auction confirmed! Double-entry ledger journals posted.`, 'success');
      setMonthNumber((m) => m + 1);
    } catch (err: any) {
      showToast(err.message || 'Auction confirmation failed', 'error');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto' }} />
        <div>Loading auction room and scheme rosters...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
          Monthly Reverse Auction Room
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
          Statutory reverse bidding and dividend distribution engine compliant with Section 21 and the 2019 Amendment.
        </p>
      </div>

      {/* Scheme Selector Strip */}
      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
          <Gavel size={18} style={{ color: 'var(--primary)' }} />
          <span>Active Chit Scheme:</span>
        </div>

        <select
          value={selectedSchemeId}
          onChange={(e) => {
            setSelectedSchemeId(e.target.value);
            const found = schemes.find((s) => s.id === e.target.value);
            if (found) setMonthNumber(found.current_month || 2);
          }}
          style={{
            flex: 1,
            minWidth: '240px',
            padding: '9px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface-alt)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {schemes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.scheme_name} ({s.scheme_code}) — ₹{s.chit_value.toLocaleString('en-IN')} [{s.status.toUpperCase()}]
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Instalment Month:</span>
          <input
            type="number"
            min={1}
            max={totalMonths}
            value={monthNumber}
            onChange={(e) => setMonthNumber(Number(e.target.value))}
            style={{ width: '80px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700 }}
          />
        </div>
      </div>

      {/* Main Grid: Bidding Controls (Left) & Mathematical Breakdown (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Left Card: Reverse Auction Form */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text)' }}>
            {isMonth1 ? 'Foreman First Month Settlement (Sec 15)' : `Month #${monthNumber} Reverse Auction Bidding`}
          </h3>

          {isMonth1 ? (
            <div style={{ padding: '16px', backgroundColor: 'var(--surface-alt)', borderRadius: '8px', borderLeft: '4px solid var(--primary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
              <strong>Section 15, Chit Funds Act, 1982:</strong><br />
              The first month chit pool is legally reserved for the Foreman. The Foreman receives full prize value with <strong>0% auction discount</strong> without bidding.
            </div>
          ) : (
            <form onSubmit={handleConfirmAuction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Winning Bid Discount (Paise Accuracy)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min={foremanCommission}
                    max={maxDiscountCeiling}
                    step={500}
                    value={bidDiscount}
                    onChange={(e) => setBidDiscount(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={foremanCommission}
                    max={maxDiscountCeiling}
                    value={bidDiscount}
                    onChange={(e) => setBidDiscount(Number(e.target.value))}
                    style={{ width: '120px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, textAlign: 'right' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>Min (5% Foreman Cap): ₹{foremanCommission.toLocaleString('en-IN')}</span>
                  <span>Max (30% Statutory Ceiling): ₹{maxDiscountCeiling.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Winning Bidder Subscriber:
                </label>
                <select
                  value={winnerMemberId}
                  onChange={(e) => setWinnerMemberId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                >
                  <option value="">-- Select Highest Eligible Bidder --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.member_code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={confirming}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 700 }}
                >
                  {confirming && <RefreshCw size={14} className="spin" />}
                  Confirm Auction & Disburse Prize
                </button>
              </div>
            </form>
          )}

          {isMonth1 && (
            <button
              onClick={handleConfirmAuction}
              className="btn btn-primary"
              disabled={confirming}
              style={{ width: '100%', padding: '12px', fontWeight: 700 }}
            >
              {confirming ? 'Confirming...' : 'Disburse Foreman Month 1 Pool (₹' + chitValue.toLocaleString('en-IN') + ')'}
            </button>
          )}
        </div>

        {/* Right Card: Real-Time Statutory Distribution Preview */}
        <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-alt)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calculator size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Deterministic Settlement Breakdown
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span>Gross Chit Pool Value:</span>
              <span style={{ fontWeight: 700 }}>₹{chitValue.toLocaleString('en-IN')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span>Winning Bid Discount:</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>− ₹{actualDiscount.toLocaleString('en-IN')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span>Prize Disbursed to Winner:</span>
              <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '15px' }}>₹{prizeAmount.toLocaleString('en-IN')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span>Foreman Commission (5% Cap Sec 21):</span>
              <span style={{ fontWeight: 600 }}>₹{foremanCommission.toLocaleString('en-IN')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span>Distributed Dividend Pool:</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{dividendPool.toLocaleString('en-IN')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span>Dividend Per Subscriber:</span>
              <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '15px' }}>₹{dividendPerMember.toLocaleString('en-IN')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>
              <span>Net Contribution Due Next Month:</span>
              <span style={{ color: 'var(--primary)' }}>₹{netDueNextMonth.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
