import React, { useState, useEffect } from 'react';
import {
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getMemberEnrolledChits } from '../api/members';
import type { EnrolledSchemeItem } from '../api/members';
import { useToast } from '../components/Toast';

// Helper Component for Skeleton Loading
const SkeletonValue = ({ width = '100%' }: { width?: string }) => (
  <div className="skeleton" style={{ width, height: '24px', borderRadius: '4px' }} />
);

interface MemberEnrolledChitsViewProps {
  memberId: string;
}

export const MemberEnrolledChitsView: React.FC<MemberEnrolledChitsViewProps> = ({ memberId }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [chits, setChits] = useState<EnrolledSchemeItem[]>([]);
  const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);

  const fetchChits = async () => {
    setLoading(true);
    try {
      const data = await getMemberEnrolledChits(memberId);
      setChits(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load enrolled chits', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChits();
  }, [memberId]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-bold" style={{ fontSize: '24px', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            My Enrolled Chit Schemes
          </h1>
          <p className="text-sm text-secondary" style={{ margin: 0 }}>
            Comprehensive view of all your chit fund tickets, subscription schedules, and prize status.
          </p>
        </div>

        <button
          onClick={fetchChits}
          className="btn btn-secondary btn-interactive"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card-kpi">
          <div className="text-xs uppercase text-muted text-bold">
            Total Enrolled Tickets
          </div>
          <div className="text-bold" style={{ fontSize: '24px', color: 'var(--text-primary)', marginTop: '4px' }}>
            {loading ? <SkeletonValue width="30%" /> : chits.length}
          </div>
        </div>

        <div className="card-kpi" style={{ borderTop: '4px solid var(--primary)' }}>
          <div className="text-xs uppercase text-muted text-bold">
            Total Chit Value
          </div>
          <div className="text-bold" style={{ fontSize: '24px', color: 'var(--primary)', marginTop: '4px' }}>
            {loading ? <SkeletonValue width="60%" /> : `₹${chits.reduce((acc, c) => acc + Number(c.chit_value || 0), 0).toLocaleString('en-IN')}`}
          </div>
        </div>

        <div className="card-kpi" style={{ borderTop: '4px solid var(--success)' }}>
          <div className="text-xs uppercase text-muted text-bold">
            Total Paid
          </div>
          <div className="text-bold" style={{ fontSize: '24px', color: 'var(--success)', marginTop: '4px' }}>
            {loading ? <SkeletonValue width="60%" /> : `₹${chits.reduce((acc, c) => acc + Number(c.total_paid || 0), 0).toLocaleString('en-IN')}`}
          </div>
        </div>

        <div className="card-kpi" style={{ borderTop: '4px solid var(--secondary)' }}>
          <div className="text-xs uppercase text-muted text-bold">
            Dividends Saved
          </div>
          <div className="text-bold" style={{ fontSize: '24px', color: 'var(--secondary)', marginTop: '4px' }}>
            {loading ? <SkeletonValue width="60%" /> : `₹${chits.reduce((acc, c) => acc + Number(c.total_dividend_earned || 0), 0).toLocaleString('en-IN')}`}
          </div>
        </div>
      </div>

      {/* Chits List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Scheme Name & Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ticket #</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Chit Value</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Monthly Gross</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Paid</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Dividends</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Balance Due</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Prized Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} style={{ padding: '20px', textAlign: 'center' }}>
                      <SkeletonValue width="100%" />
                    </td>
                  </tr>
                ))
              ) : chits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="flex flex-col items-center justify-center" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <FileText size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                    <div className="text-bold" style={{ color: 'var(--text)', marginBottom: '4px' }}>No Enrolled Schemes Found</div>
                    <div className="text-sm">You are not currently allocated to any chit group. Contact your organiser to enrol.</div>
                  </td>
                </tr>
              ) : (
                chits.map((c) => {
                  const isExpanded = expandedSchemeId === c.scheme_id;
                  return (
                    <React.Fragment key={c.scheme_member_id}>
                      <tr
                        className="btn-interactive"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                        onClick={() => setExpandedSchemeId(isExpanded ? null : c.scheme_id)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-alt)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div className="text-bold" style={{ color: 'var(--text-primary)' }}>{c.scheme_name}</div>
                          <div className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
                            {c.scheme_code}
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>
                          #{c.ticket_number}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                          ₹{c.chit_value.toLocaleString('en-IN')}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          ₹{c.monthly_subscription.toLocaleString('en-IN')}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                          ₹{c.total_paid.toLocaleString('en-IN')}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>
                          ₹{(c.total_dividend_earned || 0).toLocaleString('en-IN')}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--error)', fontWeight: 700 }}>
                          ₹{(c.balance_due || 0).toLocaleString('en-IN')}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span className={`badge ${c.is_prized ? 'badge-primary' : 'badge-secondary'}`}>
                            {c.is_prized ? `PRIZED (M${c.prize_month})` : 'NON-PRIZED'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSchemeId(isExpanded ? null : c.scheme_id);
                            }}
                            className="btn btn-secondary btn-interactive"
                            style={{ padding: '4px 8px' }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Statutory Details Drawer */}
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'var(--surface-alt)' }}>
                          <td colSpan={9} style={{ padding: '16px 24px' }}>
                            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                              <div className="card-kpi" style={{ padding: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                                <div className="text-xs uppercase text-muted text-bold mb-2">
                                  Statutory Protections (Act of 1982)
                                </div>
                                <div className="text-xs text-secondary" style={{ lineHeight: '1.6' }}>
                                  • Section 21(1)(b): Foreman commission capped strictly at 5%.<br />
                                  • 2019 Amendment: Max auction discount capped at 30% (₹{(c.chit_value * 0.3).toLocaleString('en-IN')}).<br />
                                  • Section 20: 100% Fixed Deposit in Scheduled Bank before launch.
                                </div>
                              </div>

                              <div className="card-kpi" style={{ padding: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                                <div className="text-xs uppercase text-muted text-bold mb-2">
                                  Auction Eligibility
                                </div>
                                <div className="text-xs text-secondary">
                                  {c.is_prized ? (
                                    <div className="text-bold" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                      Prize disbursed in Month {c.prize_month}. You are now a non-bidding paying subscriber until chit maturity.
                                    </div>
                                  ) : (
                                    <div className="text-bold" style={{ color: 'var(--success)', fontWeight: 600 }}>
                                      Eligible to participate in monthly reverse auction bidding!
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
