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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
            My Enrolled Chit Schemes
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Comprehensive view of all your chit fund tickets, subscription schedules, and prize status.
          </p>
        </div>

        <button
          onClick={fetchChits}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Enrolled Tickets
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginTop: '4px' }}>
            {loading ? '...' : chits.length}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Chit Value
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            ₹{loading ? '...' : chits.reduce((acc, c) => acc + (c.chit_value || 0), 0).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Paid
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
            ₹{loading ? '...' : chits.reduce((acc, c) => acc + (c.total_paid || 0), 0).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Dividends Saved
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            ₹{loading ? '...' : chits.reduce((acc, c) => acc + (c.total_dividend_earned || 0), 0).toLocaleString('en-IN')}
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
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                    <div>Loading your enrolled chit schemes...</div>
                  </td>
                </tr>
              ) : chits.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <FileText size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>No Enrolled Schemes Found</div>
                    <div>You are not currently allocated to any chit group. Contact your organiser to enrol.</div>
                  </td>
                </tr>
              ) : (
                chits.map((c) => {
                  const isExpanded = expandedSchemeId === c.scheme_id;
                  return (
                    <React.Fragment key={c.scheme_member_id}>
                      <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setExpandedSchemeId(isExpanded ? null : c.scheme_id)}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{c.scheme_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
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

                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>
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
                            className="btn btn-secondary"
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                              <div style={{ padding: '12px', backgroundColor: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                  Statutory Protections (Act of 1982)
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                                  • Section 21(1)(b): Foreman commission capped strictly at 5%.<br />
                                  • 2019 Amendment: Max auction discount capped at 30% (₹{(c.chit_value * 0.3).toLocaleString('en-IN')}).<br />
                                  • Section 20: 100% Fixed Deposit in Scheduled Bank before launch.
                                </div>
                              </div>

                              <div style={{ padding: '12px', backgroundColor: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                  Auction Eligibility
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                                  {c.is_prized ? (
                                    <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                      Prize disbursed in Month {c.prize_month}. You are now a non-bidding paying subscriber until chit maturity.
                                    </div>
                                  ) : (
                                    <div style={{ color: 'var(--success)', fontWeight: 600 }}>
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
