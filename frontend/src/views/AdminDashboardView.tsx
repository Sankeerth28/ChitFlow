import React, { useEffect, useState } from 'react';
import {
  Users,
  BookOpen,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Clock,
} from 'lucide-react';
import { fetchAdminDashboardMetrics } from '../api/dashboard';
import type { AdminDashboardMetrics } from '../api/dashboard';
import { useToast } from '../components/Toast';

interface AdminDashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddMember?: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onNavigateTab,
  onOpenAddMember,
}) => {
  const { error } = useToast();
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminDashboardMetrics();
      setMetrics(data);
    } catch (err: any) {
      error(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const formatINR = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.5px' }}>
            Administrative Dashboard
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Real-time statutory chit accounting & subscriber lifecycle operations
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadMetrics}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={onOpenAddMember}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'var(--secondary)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Plus size={16} /> Add Member
          </button>
        </div>
      </div>

      {/* Actionable Alerts Banner */}
      {metrics?.action_alerts && metrics.action_alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {metrics.action_alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                backgroundColor: alert.level === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)',
                border: `1px solid ${alert.level === 'warning' ? 'var(--warning-border)' : 'var(--info-border)'}`,
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle
                  size={18}
                  color={alert.level === 'warning' ? 'var(--warning)' : 'var(--info)'}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {alert.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {alert.message}
                  </div>
                </div>
              </div>
              {alert.target_tab && (
                <button
                  onClick={() => onNavigateTab(alert.target_tab!)}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Review Now <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPI Stat Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Members */}
        <div
          onClick={() => onNavigateTab('members')}
          style={{
            backgroundColor: 'var(--surface)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Subscribers
            </span>
            <span style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--surface-alt)', color: 'var(--secondary)' }}>
              <Users size={18} />
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px' }}>
            {metrics?.total_members ?? 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px' }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{metrics?.active_members ?? 0} Active</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-muted)' }}>{metrics?.inactive_members ?? 0} Inactive</span>
          </div>
        </div>

        {/* Card 2: Active Schemes */}
        <div
          onClick={() => onNavigateTab('schemes')}
          style={{
            backgroundColor: 'var(--surface)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Chit Schemes
            </span>
            <span style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--surface-alt)', color: 'var(--secondary)' }}>
              <BookOpen size={18} />
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px' }}>
            {metrics?.active_chits ?? 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {metrics?.total_enrolled_tickets ?? 0} enrolled member tickets
          </div>
        </div>

        {/* Card 3: Total Collections */}
        <div
          onClick={() => onNavigateTab('payments')}
          style={{
            backgroundColor: 'var(--surface)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Total Collections
            </span>
            <span style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
              <Receipt size={18} />
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)', marginTop: '8px' }}>
            {formatINR(metrics?.monthly_collections)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Reconciled bank vouchers
          </div>
        </div>

        {/* Card 4: Outstanding Dues */}
        <div
          onClick={() => onNavigateTab('payments')}
          style={{
            backgroundColor: 'var(--surface)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Outstanding Dues
            </span>
            <span style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <Clock size={18} />
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warning)', marginTop: '8px' }}>
            {formatINR(metrics?.outstanding_amount)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Unpaid instalments pending
          </div>
        </div>
      </div>

      {/* Second Row: Secondary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Auctions Conducted
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
              {metrics?.auctions_conducted ?? 0}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Foreman Commission
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--secondary)', marginTop: '2px' }}>
              {formatINR(metrics?.recorded_commission)}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Upcoming Auctions
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
              {metrics?.upcoming_auctions ?? 0}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Pending Disbursements
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: (metrics?.pending_payouts || 0) > 0 ? 'var(--warning)' : 'var(--text-secondary)', marginTop: '2px' }}>
              {metrics?.pending_payouts ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Transactions & Recent Registrations */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
          gap: '24px',
        }}
      >
        {/* Recent Transactions Feed */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>
              Recent Transactions
            </h3>
            <button
              onClick={() => onNavigateTab('payments')}
              style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary)' }}
            >
              View All
            </button>
          </div>

          {metrics?.recent_transactions && metrics.recent_transactions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.recent_transactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-alt)',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{tx.party}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {tx.title} • {tx.date}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                      +{formatINR(tx.amount)}
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: tx.status === 'paid' ? 'var(--success-bg)' : 'var(--warning-bg)',
                        color: tx.status === 'paid' ? 'var(--success)' : 'var(--warning)',
                        display: 'inline-block',
                        marginTop: '2px',
                      }}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No transactions recorded yet.
            </div>
          )}
        </div>

        {/* Recent Member Registrations Feed */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>
              Recent Member Registrations
            </h3>
            <button
              onClick={() => onNavigateTab('members')}
              style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary)' }}
            >
              Manage Members
            </button>
          </div>

          {metrics?.recent_registrations && metrics.recent_registrations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.recent_registrations.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-alt)',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#e2e8f0',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                    >
                      {m.full_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{m.full_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {m.member_code} • {m.city} • {m.mobile_number}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--success-bg)',
                        color: 'var(--success)',
                      }}
                    >
                      KYC Verified
                    </span>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {m.created_at}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No subscribers registered yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
