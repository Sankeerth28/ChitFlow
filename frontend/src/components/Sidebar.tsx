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
      style={{
        width: '260px',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '20px 20px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
          }}
        >
          <Scale size={22} />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
            ChitFlow
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Statutory Engine
          </div>
        </div>
      </div>

      {/* Role Pill */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Access Scope
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
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
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', padding: '0 8px 8px', letterSpacing: '0.5px' }}>
          Menu
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={() => onSelectTab(item.key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isActive ? '#2563eb' : 'transparent',
                    color: isActive ? '#ffffff' : '#cbd5e1',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#cbd5e1';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '11px',
          color: '#64748b',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Section 21 & 23 Certified</span>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '4px',
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
