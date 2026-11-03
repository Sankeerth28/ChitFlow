import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Receipt,
  FileText,
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react';
import { getMemberEnrolledChits, getMemberDues } from '../api/members';
import type { EnrolledSchemeItem, MemberDueDetail } from '../api/members';
import { useToast } from '../components/Toast';

interface MemberDashboardViewProps {
  memberId: string;
  onNavigateTab: (tab: string) => void;
}

export const MemberDashboardView: React.FC<MemberDashboardViewProps> = ({ memberId, onNavigateTab }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [enrolledChits, setEnrolledChits] = useState<EnrolledSchemeItem[]>([]);
  const [dues, setDues] = useState<MemberDueDetail[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [chitsData, duesData] = await Promise.all([
          getMemberEnrolledChits(memberId),
          getMemberDues(memberId),
        ]);
        if (mounted) {
          setEnrolledChits(chitsData);
          setDues(duesData);
        }
      } catch (err: any) {
        if (mounted) {
          showToast(err.message || 'Failed to load subscriber dashboard metrics', 'error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [memberId, showToast]);

  const totalPaid = enrolledChits.reduce((acc, c) => acc + (c.total_paid || 0), 0);
  const totalDividend = enrolledChits.reduce((acc, c) => acc + (c.total_dividend_earned || 0), 0);
  const totalNetDue = dues.reduce((acc, d) => acc + (d.net_due || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Welcome Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '24px',
          border: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
              <ShieldCheck size={14} />
              Chit Funds Act, 1982 Compliant
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
              My 10-Second Financial Dashboard
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
              Instant real-time visibility into your subscriptions, auction dividends, and ledger balance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => onNavigateTab('receipts')}
              className="btn"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Receipt size={16} />
              My Receipts & Dues
            </button>
            <button
              onClick={() => onNavigateTab('chits')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FileText size={16} />
              Enrolled Schemes
            </button>
          </div>
        </div>
      </div>

      {/* 4 Instant KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Paid */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Total Paid So Far
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
            ₹{loading ? '...' : totalPaid.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Verified double-entry subscription payments
          </div>
        </div>

        {/* Card 2: Dividends Earned */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Dividends Earned
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
            ₹{loading ? '...' : totalDividend.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Distributed monthly auction dividend savings
          </div>
        </div>

        {/* Card 3: Net Outstanding Dues */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Net Dues Payable
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: totalNetDue > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: totalNetDue > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {totalNetDue > 0 ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: totalNetDue > 0 ? 'var(--danger)' : 'var(--success)' }}>
            ₹{loading ? '...' : totalNetDue.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {totalNetDue > 0 ? 'After deducting monthly dividend' : 'All subscriptions up to date!'}
          </div>
        </div>

        {/* Card 4: Enrolled Schemes */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Active Chits
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
            {loading ? '...' : enrolledChits.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {enrolledChits.filter(c => c.is_prized).length} prized, {enrolledChits.filter(c => !c.is_prized).length} active bidder
          </div>
        </div>
      </div>

      {/* Statutory Formula Explanation Card */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--surface-alt)',
          borderLeft: '4px solid var(--primary)',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '14px' }}>
          <Info size={16} />
          <span>Statutory Monthly Contribution Formula (Section 21, Chit Funds Act, 1982)</span>
        </div>
        <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Your monthly payable is not the full subscription value. You receive an immediate deduction for the auction dividend:
        </p>
        <div
          style={{
            fontFamily: 'monospace',
            backgroundColor: 'var(--surface)',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            fontWeight: 700,
            fontSize: '13px',
            display: 'inline-block',
          }}
        >
          Net Payable Due = Gross Monthly Subscription − Distributed Auction Dividend
        </div>
      </div>

      {/* Two Columns: Active Schemes & Upcoming Dues */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Left Column: My Enrolled Chits Summary */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              My Enrolled Chits
            </h3>
            <button
              onClick={() => onNavigateTab('chits')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View Full Details <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
              <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
              <div>Loading chits...</div>
            </div>
          ) : enrolledChits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              You are not currently enrolled in any chit scheme.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {enrolledChits.map((c) => (
                <div
                  key={c.scheme_member_id}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface-alt)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '14px' }}>
                        {c.scheme_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Scheme: {c.scheme_code} | Ticket: #{c.ticket_number}
                      </div>
                    </div>
                    <span className={`badge ${c.is_prized ? 'badge-primary' : 'badge-secondary'}`}>
                      {c.is_prized ? `Prized Month ${c.prize_month}` : 'Non-Prized'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Chit Value:</span>
                      <div style={{ fontWeight: 600 }}>₹{c.chit_value.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Paid:</span>
                      <div style={{ fontWeight: 600, color: 'var(--success)' }}>₹{c.total_paid.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Balance Due:</span>
                      <div style={{ fontWeight: 600, color: 'var(--danger)' }}>₹{(c.balance_due || 0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Pending Dues & Pay Now */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Outstanding Subscription Dues
            </h3>
            <button
              onClick={() => onNavigateTab('receipts')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View Receipts <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
              <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
              <div>Loading dues...</div>
            </div>
          ) : dues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--success)', fontSize: '13px' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>All Subscriptions Clear!</div>
              <div>There are no outstanding dues on your account at this time.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dues.map((d, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface-alt)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>
                        {d.scheme_name}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Instalment #{d.instalment_number} | Due Date: {d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN') : 'Immediate'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--danger)' }}>
                        ₹{d.net_due.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        Gross: ₹{d.gross_subscription.toLocaleString('en-IN')} | Div: ₹{d.dividend_amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button
                      onClick={() => onNavigateTab('receipts')}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Receipt size={13} />
                      Pay Online / Submit Slip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
