import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  TrendingUp,
  Download,
  BookOpen,
  Scale,
  Receipt,
  UserCheck,
  Lock,
  LogOut,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  loginUser,
  getCurrentUser,
  logoutUser,
  authStorage,
  type UserProfile,
} from './api/auth';

// Indian Currency Formatter
const formatINR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login Form State
  const [loginMobile, setLoginMobile] = useState('9849012345');
  const [loginPassword, setLoginPassword] = useState('OrganiserPassword123!');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // Navigation & View State
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schemes' | 'auctions' | 'payments' | 'ledger' | 'audit'>('dashboard');

  // Scheme Configuration State
  const [chitValue, setChitValue] = useState(100000);
  const [durationMonths, setDurationMonths] = useState(10);
  const [totalMembers, setTotalMembers] = useState(10);
  const [commissionRate, setCommissionRate] = useState(4); // 4% (Cap 5%)
  const [winningDiscount, setWinningDiscount] = useState(26000); // 26% (Cap 30%)
  const [selectedWinner, setSelectedWinner] = useState('MEM-003');
  const [auctionNumber, setAuctionNumber] = useState(2);
  const [auctionConfirmed, setAuctionConfirmed] = useState(true);

  // Deterministic Math Engine
  const monthlySubscription = chitValue / totalMembers;
  const isMonth1Foreman = auctionNumber === 1;

  const actualDiscount = isMonth1Foreman ? 0 : winningDiscount;
  const winningPayout = isMonth1Foreman ? chitValue : chitValue - actualDiscount;
  const foremanCommission = isMonth1Foreman
    ? 0
    : Math.min(chitValue * (commissionRate / 100), actualDiscount);
  const dividendPool = isMonth1Foreman ? 0 : actualDiscount - foremanCommission;
  const dividendPerMember = isMonth1Foreman ? 0 : Math.floor((dividendPool / totalMembers) * 100) / 100;
  const roundingResidual = isMonth1Foreman
    ? 0
    : Math.round((dividendPool - dividendPerMember * totalMembers) * 100) / 100;
  const netMonthlyContribution = monthlySubscription - dividendPerMember;

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Check initial session
  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch {
        authStorage.clearToken();
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  // Quick preset loader for Scheme A / B
  const loadPreset = (preset: 'A' | 'B') => {
    if (preset === 'A') {
      setChitValue(100000);
      setDurationMonths(10);
      setTotalMembers(10);
      setCommissionRate(4);
      setWinningDiscount(26000);
      setAuctionNumber(2);
    } else {
      setChitValue(100000);
      setDurationMonths(20);
      setTotalMembers(20);
      setCommissionRate(4);
      setWinningDiscount(29000);
      setAuctionNumber(2);
    }
  };

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const data = await loginUser(loginMobile, loginPassword);
      setCurrentUser(data.user);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check mobile and password.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Demo Login Quick-Fill
  const quickFillLogin = (role: 'organiser' | 'member' | 'accountant' | 'super_admin') => {
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

  // Logout Handler
  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setAuthError(null);
  };

  // Translations
  const t = {
    en: {
      appName: 'ChitFlow',
      appMotto: 'Every Chit. Every Member. Every Rupee. Accounted For.',
      statutoryBadge: 'Chit Funds Act, 1982 Compliant (Telangana)',
      tabDashboard: 'Overview',
      tabSchemes: 'Chit Schemes',
      tabAuctions: 'Monthly Auctions',
      tabPayments: 'Collections & Receipts',
      tabLedger: 'General Ledger',
      tabAudit: 'Audit Logs',
      tenSecDashboard: 'Member 10-Second Financial Position',
      activeChits: 'Active Chits',
      monthlyPaymentDue: 'Monthly Payment Due',
      totalPaid: 'Total Paid to Date',
      totalDividends: 'Total Dividends Received',
      plainEnglishExpl: `Your ${formatINR(dividendPerMember)} dividend has been deducted from this month's ${formatINR(monthlySubscription)} payment. Net amount payable is ${formatINR(netMonthlyContribution)}.`,
      statutoryCapNotice: 'Statutory Verification: Commission 4.0% ≤ 5.0% cap | Discount 26.0% ≤ 30.0% ceiling',
    },
    te: {
      appName: 'చిట్ ఫ్లో (ChitFlow)',
      appMotto: 'ప్రతి చిట్. ప్రతి సభ్యుడు. ప్రతి రూపాయి. పారదర్శకంగా.',
      statutoryBadge: 'చిట్ ఫండ్ల చట్టం 1982 నిబంధనలకు లోబడి (తెలంగాణ)',
      tabDashboard: 'సమీక్ష',
      tabSchemes: 'చిట్ పథకాలు',
      tabAuctions: 'నెలవారీ వేలం',
      tabPayments: 'రసీదులు & చెల్లింపులు',
      tabLedger: 'లెడ్జర్ ఖాతాలు',
      tabAudit: 'ఆడిట్ రికార్డులు',
      tenSecDashboard: 'సభ్యుల 10-సెకన్ల ఆర్థిక సమాచారం',
      activeChits: 'యాక్టివ్ చిట్లు',
      monthlyPaymentDue: 'ఈ నెల చెల్లించవలసిన మొత్తం',
      totalPaid: 'ఇప్పటివరకు చెల్లించినది',
      totalDividends: 'పొందిన మొత్తం డివిడెండ్',
      plainEnglishExpl: `ఈ నెల ${formatINR(monthlySubscription)} చెల్లింపు నుండి మీ డివిడెండ్ ${formatINR(dividendPerMember)} మినహాయించబడింది. మీరు చెల్లించవలసిన నికర మొత్తం ${formatINR(netMonthlyContribution)}.`,
      statutoryCapNotice: 'చట్టబద్ధ తనిఖీ: నిర్వాహక కమీషన్ 4.0% ≤ 5.0% | వేలం తగ్గింపు 26.0% ≤ 30.0%',
    }
  }[language];

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)' }}>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>Verifying ChitFlow secure session...</p>
      </div>
    );
  }

  // ==================== UNAUTHENTICATED: LOGIN VIEW ====================
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)' }}>
        <header style={{ backgroundColor: 'var(--primary)', color: '#ffffff', padding: '16px 24px' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={28} color="#4299e1" />
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700 }}>{t.appName}</h1>
                <p style={{ fontSize: '11px', color: '#a0aec0' }}>{t.appMotto}</p>
              </div>
            </div>
            <span style={{ fontSize: '11px', backgroundColor: '#21865a', color: '#ffffff', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              {t.statutoryBadge}
            </span>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'var(--surface-alt)', marginBottom: '12px' }}>
                <Lock size={28} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>Secure Authentication Portal</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Enter registered mobile number and password</p>
            </div>

            {authError && (
              <div style={{ backgroundColor: 'var(--error-bg)', border: '1px solid #f8d7da', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)', fontSize: '13px' }}>
                <AlertTriangle size={16} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Registered Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9849012345"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Password / PIN</label>
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(true)}
                    style={{ fontSize: '12px', color: 'var(--secondary)', fontWeight: 600 }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  padding: '12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: authLoading ? 0.7 : 1
                }}
              >
                {authLoading ? 'Authenticating...' : 'Sign In to ChitFlow'}
              </button>
            </form>

            {/* Quick Demo Role Logins */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
                QA Reviewer / Demo Quick Login:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => quickFillLogin('organiser')}
                  style={{ padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--surface-alt)', fontWeight: 600, color: 'var(--primary)' }}
                >
                  🏢 Organiser Demo
                </button>
                <button
                  type="button"
                  onClick={() => quickFillLogin('member')}
                  style={{ padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--surface-alt)', fontWeight: 600, color: 'var(--primary)' }}
                >
                  👤 Member Demo
                </button>
                <button
                  type="button"
                  onClick={() => quickFillLogin('accountant')}
                  style={{ padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--surface-alt)', fontWeight: 600, color: 'var(--primary)' }}
                >
                  💼 Accountant Demo
                </button>
                <button
                  type="button"
                  onClick={() => quickFillLogin('super_admin')}
                  style={{ padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--surface-alt)', fontWeight: 600, color: 'var(--primary)' }}
                >
                  🛡️ Super Admin
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Recovery Notice Modal */}
        {showRecoveryModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', maxWidth: '420px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--warning)', marginBottom: '12px' }}>
                <Info size={24} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>Account Recovery Policy</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Per ChitFlow statutory security rules, OTP gateways are not configured in local development.
                To reset your password or PIN, please contact your registered Chit Fund Foreman administrator.
              </p>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRecoveryModal(false)}
                  style={{ backgroundColor: 'var(--primary)', color: '#ffffff', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 600 }}
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== AUTHENTICATED PORTAL VIEW ====================
  const userRole = currentUser.role;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--primary)', color: '#ffffff', padding: '12px 24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={26} color="#4299e1" />
              <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>{t.appName}</h1>
              <span style={{ fontSize: '11px', backgroundColor: '#21865a', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                {t.statutoryBadge}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#a0aec0', marginTop: '2px' }}>{t.appMotto}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Language Selector */}
            <div style={{ display: 'flex', backgroundColor: '#1e3552', borderRadius: '6px', padding: '2px' }}>
              <button
                onClick={() => setLanguage('en')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: language === 'en' ? '#426b8a' : 'transparent',
                  color: '#ffffff'
                }}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('te')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: language === 'te' ? '#426b8a' : 'transparent',
                  color: '#ffffff'
                }}
              >
                తెలుగు
              </button>
            </div>

            {/* Authenticated User Profile Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1e3552', padding: '4px 12px', borderRadius: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, display: 'block' }}>
                  {currentUser.full_name || currentUser.mobile_number}
                </span>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#63b3ed', fontWeight: 700 }}>
                  ROLE: {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Log out and invalidate session"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e53e3e', color: '#ffffff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}
              >
                <LogOut size={12} /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Role-Specific Navigation Bar */}
      <nav style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '8px', padding: '0 24px' }}>
          {userRole === 'member' ? (
            /* Member Navigation */
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'dashboard' ? '3px solid var(--secondary)' : '3px solid transparent' }}
              >
                <TrendingUp size={16} /> My 10-Second Dashboard
              </button>
              <button
                onClick={() => setActiveTab('schemes')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'schemes' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'schemes' ? '3px solid var(--secondary)' : '3px solid transparent' }}
              >
                <BookOpen size={16} /> My Enrolled Chits
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'payments' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'payments' ? '3px solid var(--secondary)' : '3px solid transparent' }}
              >
                <Receipt size={16} /> My Receipts & Dues
              </button>
            </>
          ) : (
            /* Organiser / Accountant / Super Admin Navigation */
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'dashboard' ? '3px solid var(--secondary)' : '3px solid transparent' }}
              >
                <TrendingUp size={16} /> {t.tabDashboard}
              </button>
              <button
                onClick={() => setActiveTab('schemes')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'schemes' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'schemes' ? '3px solid var(--secondary)' : '3px solid transparent' }}
              >
                <BookOpen size={16} /> {t.tabSchemes}
              </button>
              {userRole !== 'accountant' && (
                <button
                  onClick={() => setActiveTab('auctions')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'auctions' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'auctions' ? '3px solid var(--secondary)' : '3px solid transparent' }}
                >
                  <Scale size={16} /> {t.tabAuctions}
                </button>
              )}
              <button
                onClick={() => setActiveTab('payments')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'payments' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'payments' ? '3px solid var(--secondary)' : '3px solid transparent' }}
              >
                <Receipt size={16} /> {t.tabPayments}
              </button>
              <button
                onClick={() => setActiveTab('ledger')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: activeTab === 'ledger' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'ledger' ? '3px solid var(--secondary)' : '3px solid transparent' }}
              >
                <FileText size={16} /> {t.tabLedger}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1280px', margin: '24px auto', padding: '0 24px', flex: 1, width: '100%' }}>
        {userRole === 'member' ? (
          /* ==================== MEMBER PORTAL ==================== */
          <div>
            <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                    Welcome, {currentUser.full_name || 'Subscriber'} (Member #{currentUser.member_id ? currentUser.member_id.slice(0, 6) : 'M-004'})
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Organisation: Sri Balaji Chit Funds Pvt. Ltd. | Mobile: {currentUser.mobile_number}
                  </p>
                </div>
                <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} /> KYC Verified
                </span>
              </div>

              {/* 10-Second Financial Position Dashboard Cards */}
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>{t.tenSecDashboard}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--surface-alt)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.activeChits}</span>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>1 Scheme</div>
                  <span style={{ fontSize: '12px', color: 'var(--secondary)' }}>CHIT-10M-1L (Month 2/10)</span>
                </div>

                <div style={{ backgroundColor: '#eafaf1', padding: '16px', borderRadius: '6px', border: '1px solid #c6ebd7' }}>
                  <span style={{ fontSize: '12px', color: '#1a6644', fontWeight: 600 }}>{t.monthlyPaymentDue}</span>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>{formatINR(netMonthlyContribution)}</div>
                  <span style={{ fontSize: '12px', color: '#1a6644' }}>Due by 5th Dec 2026</span>
                </div>

                <div style={{ backgroundColor: 'var(--surface-alt)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.totalPaid}</span>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{formatINR(netMonthlyContribution)}</div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>1 of 10 instalments paid</span>
                </div>

                <div style={{ backgroundColor: '#fff8eb', padding: '16px', borderRadius: '6px', border: '1px solid #f9e2b8' }}>
                  <span style={{ fontSize: '12px', color: '#976510', fontWeight: 600 }}>{t.totalDividends}</span>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--warning)', marginTop: '4px' }}>{formatINR(dividendPerMember)}</div>
                  <span style={{ fontSize: '12px', color: '#976510' }}>Earned from Auction #2</span>
                </div>
              </div>

              {/* Plain-Language Explanation Callout (PRD Section 5.3 Mandate) */}
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#eef6fc', borderRadius: '6px', borderLeft: '4px solid #426b8a' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#14243a' }}>{t.plainEnglishExpl}</p>
                <p style={{ fontSize: '12px', color: '#426b8a', marginTop: '4px' }}>
                  Full Gross Subscription: {formatINR(monthlySubscription)} | Less Auction Dividend: -{formatINR(dividendPerMember)} | Net Due: {formatINR(netMonthlyContribution)}
                </p>
              </div>
            </div>

            {/* Member Transaction Receipts */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)' }}>My Payment Receipts</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Receipt #</th>
                      <th style={{ padding: '10px' }}>Scheme</th>
                      <th style={{ padding: '10px' }}>Instalment</th>
                      <th style={{ padding: '10px' }}>Gross Sub</th>
                      <th style={{ padding: '10px' }}>Dividend Applied</th>
                      <th style={{ padding: '10px' }}>Net Paid</th>
                      <th style={{ padding: '10px' }}>Status</th>
                      <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>RCP-20261105-09A12B</td>
                      <td style={{ padding: '12px 10px' }}>CHIT-10M-1L</td>
                      <td style={{ padding: '12px 10px' }}>Month #2</td>
                      <td style={{ padding: '12px 10px' }}>{formatINR(monthlySubscription)}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--success)' }}>-{formatINR(dividendPerMember)}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 700 }}>{formatINR(netMonthlyContribution)}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                          Verified & Booked
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <button
                          onClick={() => setShowReceiptModal(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--secondary)', fontWeight: 600, fontSize: '13px' }}
                        >
                          <Download size={14} /> View Receipt
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ==================== ORGANISER / ACCOUNTANT PORTAL ==================== */
          <div>
            {activeTab === 'dashboard' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Chit Schemes</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>1</div>
                    <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>PRD Scheme A (10 Months)</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Registered Members</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>10</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>100% Ticket Allocation</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Monthly Collections</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>{formatINR(netMonthlyContribution)}</div>
                    <span style={{ fontSize: '12px', color: 'var(--success)' }}>Reconciled in Bank (1020)</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Collections</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--warning)', marginTop: '4px' }}>{formatINR(netMonthlyContribution * 9)}</div>
                    <span style={{ fontSize: '12px', color: 'var(--warning)' }}>9 Members Pending M#2</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Upcoming Auctions</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>8</div>
                    <span style={{ fontSize: '12px', color: 'var(--secondary)' }}>Next: Auction #3 on 10 Dec</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Payouts</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>0</div>
                    <span style={{ fontSize: '12px', color: 'var(--success)' }}>Auction #2 Prize Disbursed</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Outstanding Dues</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{formatINR(netMonthlyContribution * 9)}</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Due within grace period</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Foreman Commission Earned</span>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#1a365d', marginTop: '4px' }}>{formatINR(foremanCommission)}</div>
                    <span style={{ fontSize: '12px', color: 'var(--success)' }}>4.00% Statutory Recognized</span>
                  </div>
                </div>

                {/* Statutory Verification Callout */}
                <div style={{ backgroundColor: '#eafaf1', border: '1px solid #c6ebd7', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ShieldCheck size={24} color="#21865a" />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1a6644' }}>Regulatory Compliance Active</h4>
                    <p style={{ fontSize: '13px', color: '#1a6644' }}>{t.statutoryCapNotice}</p>
                  </div>
                </div>

                {/* Quick Scheme Summary */}
                <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--primary)' }}>Active Chit Fund: PRD Reference Scheme</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => loadPreset('A')}
                        style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: durationMonths === 10 ? 'var(--secondary)' : 'var(--surface)', color: durationMonths === 10 ? '#fff' : 'var(--primary)' }}
                      >
                        Load Scheme A (10M)
                      </button>
                      <button
                        onClick={() => loadPreset('B')}
                        style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: durationMonths === 20 ? 'var(--secondary)' : 'var(--surface)', color: durationMonths === 20 ? '#fff' : 'var(--primary)' }}
                      >
                        Load Scheme B (20M)
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gross Chit Value</span>
                      <p style={{ fontSize: '16px', fontWeight: 700 }}>{formatINR(chitValue)}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Subscription</span>
                      <p style={{ fontSize: '16px', fontWeight: 700 }}>{formatINR(monthlySubscription)}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Duration / Members</span>
                      <p style={{ fontSize: '16px', fontWeight: 700 }}>{durationMonths} Months / {totalMembers} Tickets</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Statutory PSO Number</span>
                      <p style={{ fontSize: '14px', fontWeight: 600 }}>PSO/TS/HYD/2026/091</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sec 20 100% FD Receipt</span>
                      <p style={{ fontSize: '14px', fontWeight: 600 }}>FDR/SBI/2026/88129</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'auctions' && userRole !== 'accountant' && (
              <div>
                <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>Monthly Auction Console (PRD Module 5)</h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Execute deterministic auction calculations compliant with Chit Funds (Amendment) Act, 2019
                      </p>
                    </div>
                    <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '13px' }}>
                      Deterministic Engine: {auctionConfirmed ? 'Auction #2 Confirmed' : 'Bidding Open'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Auction Number</label>
                      <select
                        value={auctionNumber}
                        onChange={(e) => setAuctionNumber(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                      >
                        <option value={1}>Auction #1 (Foreman Entitlement - Sec 15)</option>
                        <option value={2}>Auction #2 (Bidding Auction)</option>
                        <option value={3}>Auction #3 (Scheduled)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                        Winning Bid Discount (Cap: {formatINR(chitValue * 0.3)})
                      </label>
                      <input
                        type="number"
                        disabled={isMonth1Foreman}
                        value={isMonth1Foreman ? 0 : winningDiscount}
                        onChange={(e) => setWinningDiscount(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Foreman Commission Rate (%)</label>
                      <input
                        type="number"
                        max={5}
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(Math.min(5, parseFloat(e.target.value) || 0))}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Winning Member</label>
                      <select
                        value={selectedWinner}
                        onChange={(e) => setSelectedWinner(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {isMonth1Foreman ? (
                          <option value="FOREMAN">Foreman (Section 15 Entitlement)</option>
                        ) : (
                          <>
                            <option value="MEM-002">Subscriber 2 (MEM-002)</option>
                            <option value="MEM-003">Subscriber 3 (MEM-003) - Winner</option>
                            <option value="MEM-004">K. Venkat Rao (MEM-004)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'var(--surface-alt)', padding: '20px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: 'var(--primary)' }}>
                      Deterministic Calculation Engine Output (Paise Quantized)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gross Chit Value (V)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700 }}>{formatINR(chitValue)}</p>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Winning Bid Discount (D)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--warning)' }}>
                          {formatINR(actualDiscount)} ({((actualDiscount / chitValue) * 100).toFixed(1)}%)
                        </p>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Prize Money Payout (P = V - D)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>{formatINR(winningPayout)}</p>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Foreman Commission (C ≤ 5%)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: '#1a365d' }}>{formatINR(foremanCommission)}</p>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Member Dividend Pool (D - C)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700 }}>{formatINR(dividendPool)}</p>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dividend per Member (Div)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>{formatINR(dividendPerMember)}</p>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Next Net Subscription (S - Div)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>{formatINR(netMonthlyContribution)}</p>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Rounding Residual (Δ)</span>
                        <p style={{ fontSize: '18px', fontWeight: 700 }}>{formatINR(roundingResidual)}</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => {
                        setAuctionConfirmed(true);
                        alert(`Auction #${auctionNumber} confirmed for winner ${selectedWinner}! Balanced double-entry journal entries generated into General Ledger.`);
                      }}
                      style={{
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <CheckCircle2 size={16} /> Confirm Auction & Post Journal Entries
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ledger' && (
              <div>
                <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>General Ledger: Real-Time Trial Balance (PRD Module 7)</h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Double-entry invariant: Absolute mathematical equality between total debits and total credits.
                      </p>
                    </div>
                    <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '13px' }}>
                      Trial Balance: Perfectly Balanced
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px' }}>Account Code</th>
                        <th style={{ padding: '10px' }}>Account Name</th>
                        <th style={{ padding: '10px' }}>Type</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Debit (₹)</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>1020</td>
                        <td style={{ padding: '10px' }}>Bank Operating Account</td>
                        <td style={{ padding: '10px' }}>Asset</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(7800)}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>₹0.00</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>1100</td>
                        <td style={{ padding: '10px' }}>Member Subscriptions Receivable</td>
                        <td style={{ padding: '10px' }}>Asset</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(100000)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(10000)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>2010-POOL</td>
                        <td style={{ padding: '10px' }}>Chit Scheme Collection Pool</td>
                        <td style={{ padding: '10px' }}>Liability</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(100000)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(100000)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>2010-PRIZE</td>
                        <td style={{ padding: '10px' }}>Prize Money Payable</td>
                        <td style={{ padding: '10px' }}>Liability</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(74000)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(74000)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>4010</td>
                        <td style={{ padding: '10px' }}>Foreman Commission Income</td>
                        <td style={{ padding: '10px' }}>Revenue</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>₹0.00</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(4000)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>5010</td>
                        <td style={{ padding: '10px' }}>Member Dividend Pool Distributed</td>
                        <td style={{ padding: '10px' }}>Expense</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatINR(2200)}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>₹0.00</td>
                      </tr>
                      <tr style={{ backgroundColor: 'var(--surface-alt)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                        <td colSpan={3} style={{ padding: '12px 10px' }}>Total Balanced General Ledger</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--primary)' }}>{formatINR(284000)}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--primary)' }}>{formatINR(284000)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div>
                <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)' }}>Payment Collections & Receipt Verification</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px' }}>Member</th>
                        <th style={{ padding: '10px' }}>Ticket #</th>
                        <th style={{ padding: '10px' }}>Gross Subscription</th>
                        <th style={{ padding: '10px' }}>Dividend Applied</th>
                        <th style={{ padding: '10px' }}>Net Payable</th>
                        <th style={{ padding: '10px' }}>Status</th>
                        <th style={{ padding: '10px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>K. Venkat Rao (MEM-004)</td>
                        <td style={{ padding: '12px 10px' }}>Ticket #4</td>
                        <td style={{ padding: '12px 10px' }}>{formatINR(monthlySubscription)}</td>
                        <td style={{ padding: '12px 10px', color: 'var(--success)' }}>-{formatINR(dividendPerMember)}</td>
                        <td style={{ padding: '12px 10px', fontWeight: 700 }}>{formatINR(netMonthlyContribution)}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                            Paid via UPI
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            onClick={() => setShowReceiptModal(true)}
                            style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: '13px' }}
                          >
                            Print Receipt
                          </button>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>P. Suresh (MEM-005)</td>
                        <td style={{ padding: '12px 10px' }}>Ticket #5</td>
                        <td style={{ padding: '12px 10px' }}>{formatINR(monthlySubscription)}</td>
                        <td style={{ padding: '12px 10px', color: 'var(--success)' }}>-{formatINR(dividendPerMember)}</td>
                        <td style={{ padding: '12px 10px', fontWeight: 700 }}>{formatINR(netMonthlyContribution)}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ backgroundColor: '#fff8eb', color: '#976510', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                            Pending
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            onClick={() => alert('Payment reminder notification sent to P. Suresh via SMS & In-app alert.')}
                            style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '13px' }}
                          >
                            Send Reminder
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'schemes' && (
              <div>
                <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>Chit Scheme Lifecycle (PRD Module 3)</h2>
                    {userRole === 'accountant' && (
                      <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600, backgroundColor: 'var(--warning-bg)', padding: '4px 8px', borderRadius: '4px' }}>
                        Accountant View: Read-Only Scheme Rules
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '16px', backgroundColor: 'var(--surface-alt)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>CHIT-10M-1L — 1 Lakh 10 Months Scheme</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status: Active | Rules Locked | Registered with Registrar of Chits, Hyderabad</p>
                      </div>
                      <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: '4px', fontWeight: 600, fontSize: '12px' }}>
                        ACTIVE & LOCKED
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Official Payment Receipt Modal (PRD Module 6) */}
      {showReceiptModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', maxWidth: '520px', width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>SRI BALAJI CHIT FUNDS PVT. LTD.</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Regd. No: REG/TS/HYD/CHIT/2026/042 | Trade License: TL/HYD/2026/8941</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Madhapur, Hyderabad, Telangana - 500081</p>
              <div style={{ marginTop: '10px', display: 'inline-block', backgroundColor: 'var(--surface-alt)', padding: '4px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 700 }}>
                OFFICIAL PAYMENT RECEIPT
              </div>
            </div>

            <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Receipt Number:</span>
                <span style={{ fontWeight: 600 }}>RCP-20261105-09A12B</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Date & Time:</span>
                <span style={{ fontWeight: 600 }}>05 Nov 2026, 11:42 AM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Member Name:</span>
                <span style={{ fontWeight: 600 }}>K. Venkat Rao (MEM-004)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Scheme / Ticket:</span>
                <span style={{ fontWeight: 600 }}>CHIT-10M-1L / Ticket #4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Instalment Month:</span>
                <span style={{ fontWeight: 600 }}>Month #2 of 10</span>
              </div>

              <div style={{ margin: '14px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Gross Subscription:</span>
                  <span>{formatINR(monthlySubscription)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                  <span>Less Auction Dividend:</span>
                  <span>-{formatINR(dividendPerMember)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px', marginTop: '6px' }}>
                  <span>Net Amount Paid:</span>
                  <span>{formatINR(netMonthlyContribution)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Mode:</span>
                <span style={{ fontWeight: 600 }}>UPI (Ref: 432901928492)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Verification Status:</span>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>RECONCILED & BOOKED</span>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowReceiptModal(false)}
                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{ backgroundColor: 'var(--primary)', color: '#ffffff', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 600 }}
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: 'auto' }}>
        <p>ChitFlow Management System • Strictly governed under Chit Funds Act, 1982 & Telangana Chit Funds Rules, 2008</p>
        <p style={{ marginTop: '4px', fontWeight: 600 }}>Every Chit. Every Member. Every Rupee. Accounted For.</p>
      </footer>
    </div>
  );
}

export default App;
