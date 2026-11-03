import React from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Scale,
  Receipt,
  FileText,
  ShieldCheck,
  LogOut,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { UserProfile } from '../api/auth';

interface SidebarProps {
  currentUser?: UserProfile | null;
  userRole?: 'super_admin' | 'organiser' | 'accountant' | 'member';
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  userRole,
  activeTab,
  onSelectTab,
  onLogout,
}) => {
  const role = userRole || currentUser?.role || 'organiser';

  let navItems: NavItem[] = [];

  if (role === 'member') {
    navItems = [
      { key: 'dashboard', label: '10-Sec Dashboard', icon: <TrendingUp size={18} /> },
      { key: 'chits', label: 'My Enrolled Chits', icon: <BookOpen size={18} /> },
      { key: 'receipts', label: 'My Receipts & Dues', icon: <Receipt size={18} /> },
    ];
  } else if (role === 'accountant') {
    navItems = [
      { key: 'dashboard', label: 'Accountant Overview', icon: <LayoutDashboard size={18} /> },
      { key: 'payments', label: 'Collections & Verify', icon: <Receipt size={18} /> },
      { key: 'members', label: 'Subscriber Records', icon: <Users size={18} /> },
      { key: 'ledger', label: 'General Ledger', icon: <FileText size={18} /> },
    ];
  } else if (role === 'super_admin') {
    navItems = [
      { key: 'super_admin', label: 'Platform Console', icon: <LayoutDashboard size={18} /> },
      { key: 'ledger', label: 'Platform Audit Logs', icon: <ShieldCheck size={18} /> },
    ];
  } else {
    // Default: Organiser
    navItems = [
      { key: 'dashboard', label: 'Admin Overview', icon: <LayoutDashboard size={18} /> },
      { key: 'members', label: 'Subscribers & Members', icon: <Users size={18} /> },
      { key: 'schemes', label: 'Chit Schemes', icon: <BookOpen size={18} /> },
      { key: 'auctions', label: 'Reverse Auctions', icon: <Scale size={18} /> },
      { key: 'payments', label: 'Payment Collections', icon: <Receipt size={18} /> },
      { key: 'ledger', label: 'Double-Entry Ledger', icon: <FileText size={18} /> },
    ];
  }

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    organiser: 'Chit Organiser',
    accountant: 'Senior Accountant',
    member: 'Subscribing Member',
  };

  return (
    <aside
      className="flex flex-col"
      style={{
        width: '260px',
        backgroundColor: 'var(--primary)',
        color: '#f8fafc',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Brand Header */}
      <div
        className="flex items-center gap-3"
        style={{
          padding: '20px 20px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: 'var(--secondary)',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
          }}
        >
          <Scale size={22} />
        </div>
        <div>
          <div className="text-bold" style={{ fontSize: '16px', color: '#ffffff', letterSpacing: '-0.3px' }}>
            ChitFlow
          </div>
          <div className="text-xs uppercase text-muted" style={{ letterSpacing: '0.5px', fontWeight: 600 }}>
            Statutory Engine
          </div>
        </div>
      </div>

      {/* Role Pill */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div
          className="flex items-center justify-between"
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div>
            <div className="text-xs uppercase text-muted" style={{ fontWeight: 600 }}>
              Access Scope
            </div>
            <div className="text-sm text-bold" style={{ color: '#38bdf8' }}>
              {roleLabels[role] || role.toUpperCase()}
            </div>
          </div>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
            }}
          />
        </div>
      </div>

      {/* Navigation Items */}
      <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
        <div className="text-xs uppercase text-muted text-bold" style={{ padding: '0 8px 8px', letterSpacing: '0.5px' }}>
          Menu
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={() => onSelectTab(item.key)}
                  className={`btn btn-interactive ${isActive ? 'text-bold' : ''}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isActive ? 'var(--secondary)' : 'transparent',
                    color: isActive ? '#ffffff' : '#cbd5e1',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: isActive ? '#ffffff' : '#94a3b8' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight size={14} style={{ color: '#ffffff' }} />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="flex flex-col gap-2"
        style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '11px',
          color: '#64748b',
        }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Section 21 & 23 Certified</span>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="btn btn-interactive"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'transparent',
              color: '#ef4444',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'var(--transition-fast)',
            }}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
};
