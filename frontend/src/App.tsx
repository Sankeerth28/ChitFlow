import React, { useState, useEffect } from 'react';
import {
  Scale,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Server,
  Menu,
} from 'lucide-react';
import {
  loginUser,
  getCurrentUser,
  logoutUser,
  checkApiHealth,
} from './api/auth';
import type { UserProfile } from './api/auth';
import { ToastProvider, useToast } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { Modal } from './components/Modal';

// Role Views
import { AdminDashboardView } from './views/AdminDashboardView';
import { MembersManagementView } from './views/MembersManagementView';
import { MemberDashboardView } from './views/MemberDashboardView';
import { MemberEnrolledChitsView } from './views/MemberEnrolledChitsView';
import { MemberReceiptsDuesView } from './views/MemberReceiptsDuesView';
import { SchemesView } from './views/SchemesView';
import { AuctionsView } from './views/AuctionsView';
import { PaymentsView } from './views/PaymentsView';
import { LedgerView } from './views/LedgerView';
import { SuperAdminView } from './views/SuperAdminView';

const AppContent: React.FC = () => {
  const { showToast } = useToast();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginMobile, setLoginMobile] = useState<string>('9849012345');
  const [loginPassword, setLoginPassword] = useState<string>('OrganiserPassword123!');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false);

  // Cloud API Health Monitor
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'standby'>('checking');

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);

  // Check initial authentication and backend health
  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      try {
        const user = await getCurrentUser();
        if (mounted) {
          setCurrentUser(user);
          if (user?.role === 'super_admin') setActiveTab('super_admin');
          else setActiveTab('dashboard');
        }
      } catch {
        // Unauthenticated
      } finally {
        if (mounted) setAuthLoading(false);
      }

      // Check cloud health
      const isOnline = await checkApiHealth();
      if (mounted) {
        setBackendStatus(isOnline ? 'online' : 'standby');
      }
    }
    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  // Mobile drawer: lock scroll, close on Escape or when the viewport grows
  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth > 900) setMobileNavOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  // Navigate and collapse the mobile drawer in one step
  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingLogin(true);
    try {
      const data = await loginUser(loginMobile.trim(), loginPassword);
      setCurrentUser(data.user);
      setBackendStatus('online');
      showToast(`Welcome back, ${data.user.full_name || data.user.role.toUpperCase()}!`, 'success');
      if (data.user.role === 'super_admin') setActiveTab('super_admin');
      else setActiveTab('dashboard');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check mobile number and password.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setActiveTab('dashboard');
      setMobileNavOpen(false);
      showToast('Logged out securely.', 'info');
    } catch {
      setCurrentUser(null);
    }
  };

  // Demo Quick-Fill
  const handleQuickFill = (role: 'organiser' | 'member' | 'accountant' | 'super_admin') => {
    setAuthError(null);
    if (role === 'organiser') {
      setLoginMobile('9849012345');
      setLoginPassword('OrganiserPassword123!');
    } else if (role === 'member') {
      setLoginMobile('9876543204');
      setLoginPassword('Member@3204!');
    } else if (role === 'accountant') {
      setLoginMobile('9849012346');
      setLoginPassword('AccountantPassword123!');
    } else if (role === 'super_admin') {
      setLoginMobile('9999999999');
      setLoginPassword('AdminPassword123!');
    }
  };

  // Initial loading splash
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)' }}>
        <Scale size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>ChitFlow Statutory Platform</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>Initializing cryptographic session & ledger security...</div>
        <RefreshCw size={20} className="spin" style={{ color: 'var(--primary)', marginTop: '20px' }} />
      </div>
    );
  }

  // ==================== UNAUTHENTICATED: LOGIN VIEW ====================
  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        {/* Platform Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', backgroundColor: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.3)', marginBottom: '12px' }}>
            <Scale size={32} style={{ color: '#38bdf8' }} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
            ChitFlow
          </h1>
          <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
            Every Chit. Every Member. Every Rupee. Accounted For.
          </div>
          <div style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              Chit Funds Act, 1982 Compliant (Telangana)
            </span>
          </div>
        </div>

        {/* Login Card */}
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            padding: '32px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
              Secure Authentication Portal
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Enter registered mobile number and password
            </p>
          </div>

          {/* Cloud Health Indicator Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: backendStatus === 'online' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${backendStatus === 'online' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
              marginBottom: '16px',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={13} style={{ color: backendStatus === 'online' ? 'var(--success)' : 'var(--warning)' }} />
              <span style={{ fontWeight: 600, color: backendStatus === 'online' ? 'var(--success)' : 'var(--warning)' }}>
                {backendStatus === 'online' ? 'Cloud API: Online & Operational' : 'Cloud API: Standby (Free-Tier Cold Boot ~20s)'}
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                setBackendStatus('checking');
                const ok = await checkApiHealth();
                setBackendStatus(ok ? 'online' : 'standby');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
            >
              Ping
            </button>
          </div>

          {/* Error Alert Box */}
          {authError && (
            <div
              style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                lineHeight: 1.4,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{authError}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
                Registered Mobile Number
              </label>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="10-digit mobile"
                value={loginMobile}
                onChange={(e) => setLoginMobile(e.target.value.replace(/\D/g, ''))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Password / PIN</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingLogin}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}
            >
              {isSubmittingLogin ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In to ChitFlow'
              )}
            </button>
          </form>

          {/* Demo Quick-Fill Buttons */}
          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
              Quick Demo One-Click Fill:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleQuickFill('organiser')}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px', fontWeight: 600 }}
              >
                🏢 Organiser
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('member')}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px', fontWeight: 600 }}
              >
                👤 Subscriber
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('accountant')}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px', fontWeight: 600 }}
              >
                💼 Accountant
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('super_admin')}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px', fontWeight: 600 }}
              >
                🛡️ Super Admin
              </button>
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        <Modal
          isOpen={showForgotModal}
          onClose={() => setShowForgotModal(false)}
          title="Account Recovery & PIN Reset"
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#fffbe8', border: '1px solid #fde68a', color: '#92400e', lineHeight: 1.5 }}>
              <strong>Notice:</strong> SMS OTP gateway is not configured on this environment.
              To reset your credentials, please contact your authorized Chit Fund Foreman or System Administrator with statutory KYC documentation.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button onClick={() => setShowForgotModal(false)} className="btn btn-primary">
                Understood
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ==================== AUTHENTICATED APPLICATION SHELL ====================
  const userRole = currentUser.role;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Sidebar Navigation (drawer below 900px) */}
      <div
        className={`sidebar-backdrop${mobileNavOpen ? ' is-open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />
      <Sidebar
        currentUser={currentUser}
        userRole={userRole}
        activeTab={activeTab}
        onSelectTab={selectTab}
        onLogout={handleLogout}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
        {/* Top Navbar */}
        <header
          className="app-header"
          style={{
            height: '64px',
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {/* Left Title */}
          <div className="app-title-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span className="app-title" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
              {currentUser.business_name || 'Sri Balaji Chit Funds Pvt. Ltd.'}
            </span>
            <span className="badge badge-success hide-mobile" style={{ fontSize: '11px' }}>
              TS-REG-2026
            </span>
          </div>

          {/* Right User Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="hide-mobile" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                {currentUser.full_name || currentUser.mobile_number}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                <span className={`badge ${userRole === 'super_admin' ? 'badge-danger' : userRole === 'organiser' ? 'badge-primary' : 'badge-secondary'}`}>
                  {userRole.toUpperCase()}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              title="Secure Sign Out"
              aria-label="Sign Out"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '12px' }}
            >
              <LogOut size={14} />
              <span className="hide-mobile">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic Main Body Content */}
        <main className="app-main" style={{ flex: 1, padding: '24px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {/* Organiser Views */}
          {userRole === 'organiser' && (
            <>
              {activeTab === 'dashboard' && <AdminDashboardView onNavigateTab={setActiveTab} onOpenAddMember={() => setActiveTab('members')} />}
              {activeTab === 'members' && <MembersManagementView />}
              {activeTab === 'schemes' && <SchemesView />}
              {activeTab === 'auctions' && <AuctionsView />}
              {activeTab === 'payments' && <PaymentsView />}
              {activeTab === 'ledger' && <LedgerView />}
            </>
          )}

          {/* Member Views (Fully Decoupled & Unique!) */}
          {userRole === 'member' && (
            <>
              {activeTab === 'dashboard' && (
                <MemberDashboardView
                  memberId={currentUser.member_id || currentUser.id}
                  onNavigateTab={setActiveTab}
                />
              )}
              {activeTab === 'chits' && (
                <MemberEnrolledChitsView
                  memberId={currentUser.member_id || currentUser.id}
                />
              )}
              {activeTab === 'receipts' && (
                <MemberReceiptsDuesView
                  memberId={currentUser.member_id || currentUser.id}
                />
              )}
            </>
          )}

          {/* Accountant Views */}
          {userRole === 'accountant' && (
            <>
              {activeTab === 'dashboard' && <AdminDashboardView onNavigateTab={setActiveTab} onOpenAddMember={() => setActiveTab('members')} />}
              {activeTab === 'payments' && <PaymentsView />}
              {activeTab === 'ledger' && <LedgerView />}
              {activeTab === 'members' && <MembersManagementView />}
            </>
          )}

          {/* Super Admin Views */}
          {userRole === 'super_admin' && (
            <>
              {activeTab === 'super_admin' && <SuperAdminView />}
              {activeTab === 'ledger' && <LedgerView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
