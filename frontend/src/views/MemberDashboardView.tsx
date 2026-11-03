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

// Helper Component for Skeleton Loading
const SkeletonValue = ({ width = '100%' }: { width?: string }) => (
  <div className="skeleton" style={{ width, height: '24px', borderRadius: '4px' }} />
);

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
    <div className="flex flex-col gap-5">
      {/* Top Welcome Banner - Glassmorphic */}
      <div
        className="card card-glass animate-fade-in"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
          color: '#ffffff',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div
              className="flex items-center gap-2"
              style={{
                padding: '4px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '12px',
                width: 'fit-content'
              }}
            >
              <ShieldCheck size={14} />
              Chit Funds Act, 1982 Compliant
            </div>
            <h1 className="text-bold" style={{ fontSize: '28px', margin: '0 0 8px 0', color: '#ffffff' }}>
              Financial Command Center
            </h1>
            <p className="text-muted" style={{ margin: 0, fontSize: '15px' }}>
              Instant real-time visibility into your subscriptions, auction dividends, and ledger balance.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onNavigateTab('receipts')}
              className="btn btn-interactive"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}
            >
              <Receipt size={16} />
              Receipts & Dues
            </button>
            <button
              onClick={() => onNavigateTab('chits')}
              className="btn btn-primary btn-interactive"
            >
              <FileText size={16} />
              Enrolled Schemes
            </button>
          </div>
        </div>
      </div>

      {/* 4 Instant KPI Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Paid */}
        <div className="card-kpi" style={{ borderTop: '4px solid var(--success)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase text-muted text-bold">
              Total Paid So Far
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-bold" style={{ fontSize: '26px', color: 'var(--text-primary)' }}>
            {loading ? <SkeletonValue width="60%" /> : `₹${totalPaid.toLocaleString('en-IN')}`}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
            Verified double-entry subscription payments
          </div>
        </div>

        {/* Card 2: Dividends Earned */}
        <div className="card-kpi" style={{ borderTop: '4px solid var(--secondary)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase text-muted text-bold">
              Dividends Earned
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--secondary)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-bold" style={{ fontSize: '26px', color: 'var(--secondary)' }}>
            {loading ? <SkeletonValue width="60%" /> : `₹${totalDividend.toLocaleString('en-IN')}`}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
            Distributed monthly auction dividend savings
          </div>
        </div>

        {/* Card 3: Net Outstanding Dues */}
        <div className="card-kpi" style={{ borderTop: `4px solid ${totalNetDue > 0 ? 'var(--error)' : 'var(--success)'}` }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase text-muted text-bold">
              Net Dues Payable
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: totalNetDue > 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(22, 163, 74, 0.1)', color: totalNetDue > 0 ? 'var(--error)' : 'var(--success)' }}>
              {totalNetDue > 0 ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </div>
          </div>
          <div className="text-bold" style={{ fontSize: '26px', color: totalNetDue > 0 ? 'var(--error)' : 'var(--success)' }}>
            {loading ? <SkeletonValue width="60%" /> : `₹${totalNetDue.toLocaleString('en-IN')}`}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
            {totalNetDue > 0 ? 'After deducting monthly dividend' : 'All subscriptions up to date!'}
          </div>
        </div>

        {/* Card 4: Enrolled Schemes */}
        <div className="card-kpi" style={{ borderTop: '4px solid var(--warning)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase text-muted text-bold">
              Active Chits
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: 'var(--warning)' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div className="text-bold" style={{ fontSize: '26px', color: 'var(--text-primary)' }}>
            {loading ? <SkeletonValue width="30%" /> : enrolledChits.length}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
            {loading ? <SkeletonValue width="80%" /> : `${enrolledChits.filter(c => c.is_prized).length} prized, ${enrolledChits.filter(c => !c.is_prized).length} active bidder`}
          </div>
        </div>
      </div>

      {/* Statutory Formula Explanation Card */}
      <div
        className="card animate-slide-down"
        style={{
          backgroundColor: 'var(--surface-alt)',
          borderLeft: '4px solid var(--primary)',
          padding: '20px',
        }}
      >
        <div className="flex items-center gap-2 mb-2 text-bold" style={{ color: 'var(--primary)', fontSize: '14px' }}>
          <Info size={16} />
          <span>Statutory Monthly Contribution Formula (Section 21, Chit Funds Act, 1982)</span>
        </div>
        <p className="text-sm text-secondary mb-3" style={{ lineHeight: 1.6 }}>
          Your monthly payable is not the full subscription value. You receive an immediate deduction for the auction dividend:
        </p>
        <div
          style={{
            fontFamily: 'monospace',
            backgroundColor: 'var(--surface)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontWeight: 700,
            fontSize: '13px',
            display: 'inline-block',
            boxShadow: 'var(--shadow-inner)',
            color: 'var(--text-primary)'
          }}
        >
          Net Payable Due = Gross Monthly Subscription − Distributed Auction Dividend
        </div>
      </div>

      {/* Two Columns: Active Schemes & Upcoming Dues */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Left Column: My Enrolled Chits Summary */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-bold" style={{ fontSize: '16px', margin: 0, color: 'var(--text-primary)' }}>
              My Enrolled Chits
            </h3>
            <button
              onClick={() => onNavigateTab('chits')}
              className="btn-interactive text-sm text-bold"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View Full Details <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: '30px', color: 'var(--text-secondary)' }}>
              <RefreshCw size={20} className="spin" style={{ margin: '0 auto 12px auto' }} />
              <div className="text-sm">Loading your schemes...</div>
            </div>
          ) : enrolledChits.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: '40px', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>
              You are not currently enrolled in any chit scheme.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {enrolledChits.map((c) => (
                <div
                  key={c.scheme_member_id}
                  className="card-kpi"
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--surface-alt)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-bold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                        {c.scheme_name}
                      </div>
                      <div className="text-xs text-muted">
                        Scheme: {c.scheme_code} | Ticket: #{c.ticket_number}
                      </div>
                    </div>
                    <span className={`badge ${c.is_prized ? 'badge-primary' : 'badge-secondary'}`}>
                      {c.is_prized ? `Prized Month ${c.prize_month}` : 'Non-Prized'}
                    </span>
                  </div>

                  <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <div>
                      <span className="text-muted">Chit Value:</span>
                      <div className="text-bold">₹{c.chit_value.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span className="text-muted">Total Paid:</span>
                      <div className="text-bold" style={{ color: 'var(--success)' }}>₹{c.total_paid.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span className="text-muted">Balance Due:</span>
                      <div className="text-bold" style={{ color: 'var(--error)' }}>₹{(c.balance_due || 0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Pending Dues & Pay Now */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-bold" style={{ fontSize: '16px', margin: 0, color: 'var(--text-primary)' }}>
              Outstanding Subscription Dues
            </h3>
            <button
              onClick={() => onNavigateTab('receipts')}
              className="btn-interactive text-sm text-bold"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View Receipts <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: '30px', color: 'var(--text-secondary)' }}>
              <RefreshCw size={20} className="spin" style={{ margin: '0 auto 12px auto' }} />
              <div className="text-sm">Loading your dues...</div>
            </div>
          ) : dues.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: '40px', color: 'var(--success)', fontSize: '13px', textAlign: 'center' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 12px auto' }} />
              <div className="text-bold" style={{ fontSize: '15px', marginBottom: '4px' }}>All Subscriptions Clear!</div>
              <div className="text-muted">There are no outstanding dues on your account at this time.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dues.map((d, idx) => (
                <div
                  key={idx}
                  className="card-kpi"
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--surface-alt)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="text-bold" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                        {d.scheme_name}
                      </span>
                      <div className="text-xs text-muted">
                        Instalment #{d.instalment_number} | Due Date: {d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN') : 'Immediate'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="text-bold" style={{ fontSize: '16px', color: 'var(--error)' }}>
                        ₹{d.net_due.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-muted">
                        Gross: ₹{d.gross_subscription.toLocaleString('en-IN')} | Div: ₹{d.dividend_amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => onNavigateTab('receipts')}
                      className="btn btn-primary btn-interactive"
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
