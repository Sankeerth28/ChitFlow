import React, { useState, useEffect } from 'react';
import {
  Scale,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { getTrialBalance, listJournalEntries } from '../api/ledger';
import type { TrialBalanceItem, JournalEntryItem } from '../api/ledger';
import { useToast } from '../components/Toast';

export const LedgerView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'trial_balance' | 'journals'>('trial_balance');
  const [loading, setLoading] = useState<boolean>(true);

  const [trialBalance, setTrialBalance] = useState<TrialBalanceItem[]>([]);
  const [totalDebit, setTotalDebit] = useState<number>(0);
  const [totalCredit, setTotalCredit] = useState<number>(0);

  const [journals, setJournals] = useState<JournalEntryItem[]>([]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const [tbData, jData] = await Promise.all([
        getTrialBalance(),
        listJournalEntries(),
      ]);
      setTrialBalance(tbData.accounts);
      setTotalDebit(tbData.total_debit);
      setTotalCredit(tbData.total_credit);
      setJournals(jData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load general ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
            Statutory Double-Entry General Ledger
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Paise-quantized immutable accounting records compliant with Section 23 of Chit Funds Act, 1982.
          </p>
        </div>

        <button
          onClick={fetchLedger}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh Ledger
        </button>
      </div>

      {/* Balance Verification Strip */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isBalanced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          borderLeft: `5px solid ${isBalanced ? 'var(--success)' : 'var(--danger)'}`,
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isBalanced ? (
            <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', color: '#ffffff' }}>
              <Scale size={20} />
            </div>
          ) : (
            <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)', color: '#ffffff' }}>
              <AlertTriangle size={20} />
            </div>
          )}

          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: isBalanced ? 'var(--success)' : 'var(--danger)' }}>
              {isBalanced ? 'TRIAL BALANCE IS BALANCED (DEBITS = CREDITS)' : 'TRIAL BALANCE IMBALANCE DETECTED'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Total Debits: ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Total Credits: ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--surface)' }}>
          <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
          Zero Paise Leakage Assurance
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', gap: '20px' }}>
        <button
          onClick={() => setActiveTab('trial_balance')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'trial_balance' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'trial_balance' ? 700 : 500,
            color: activeTab === 'trial_balance' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Scale size={16} />
          Chart of Accounts & Trial Balance
        </button>

        <button
          onClick={() => setActiveTab('journals')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'journals' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'journals' ? 700 : 500,
            color: activeTab === 'journals' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpen size={16} />
          Immutable Journal Entries Log ({journals.length})
        </button>
      </div>

      {/* TAB 1: TRIAL BALANCE TABLE */}
      {activeTab === 'trial_balance' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Account Code</th>
                  <th style={{ padding: '12px 16px' }}>Account Name</th>
                  <th style={{ padding: '12px 16px' }}>Classification</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Debit Balance (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Credit Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                      <div>Computing trial balance across general ledger accounts...</div>
                    </td>
                  </tr>
                ) : trialBalance.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No ledger accounts initialized.
                    </td>
                  </tr>
                ) : (
                  <>
                    {trialBalance.map((acc) => (
                      <tr key={acc.code} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                          {acc.code}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{acc.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge badge-secondary" style={{ textTransform: 'uppercase' }}>
                            {acc.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: acc.debit > 0 ? 700 : 400 }}>
                          {acc.debit > 0 ? `₹${acc.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: acc.credit > 0 ? 700 : 400 }}>
                          {acc.credit > 0 ? `₹${acc.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr style={{ backgroundColor: 'var(--surface-alt)', fontWeight: 800, fontSize: '14px', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3} style={{ padding: '14px 16px', textAlign: 'right' }}>
                        TOTAL TRIAL BALANCE:
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--primary)' }}>
                        ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--primary)' }}>
                        ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: JOURNAL ENTRIES */}
      {activeTab === 'journals' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Voucher #</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Description / Statutory Event</th>
                  <th style={{ padding: '12px 16px' }}>Ledger Distribution (DR / CR)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Voucher Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                      <div>Loading journal voucher entries...</div>
                    </td>
                  </tr>
                ) : journals.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No journal entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  journals.map((j) => (
                    <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                        {j.entry_number}
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(j.entry_date || j.transaction_date).toLocaleDateString('en-IN')}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{j.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          Ref: {j.reference_id || 'System Auto-Generated'}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                          {j.lines?.map((line, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                              <span style={{ color: line.debit > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                {line.debit > 0 ? 'DR ' : '   CR '} {line.account_code} - {line.account_name}
                              </span>
                              <span style={{ fontWeight: 600 }}>
                                ₹{(line.debit || line.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                        ₹{j.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
