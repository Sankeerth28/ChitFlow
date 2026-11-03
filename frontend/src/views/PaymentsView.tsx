import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  PlusCircle,
  RefreshCw,
  Receipt
} from 'lucide-react';
import { listPayments, recordPayment, verifyPayment, rejectPayment } from '../api/payments';
import type { PaymentRecord } from '../api/payments';
import { listMembers } from '../api/members';
import type { MemberItem } from '../api/members';
import { listSchemes } from '../api/schemes';
import type { SchemeItem } from '../api/schemes';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const PaymentsView: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);

  // Record Counter Payment Modal
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [recordForm, setRecordForm] = useState({
    member_id: '',
    scheme_id: '',
    instalment_number: 1,
    amount: 10000,
    payment_mode: 'cash',
    transaction_ref: 'COUNTER-CASH',
  });
  const [submittingRecord, setSubmittingRecord] = useState<boolean>(false);

  const fetchPaymentsData = async () => {
    setLoading(true);
    try {
      const data = await listPayments({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setPayments(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();
    listMembers({ page: 1, page_size: 100 }).then((res) => setMembers(res.items)).catch(() => {});
    listSchemes().then(setSchemes).catch(() => {});
  }, [statusFilter]);

  const handleVerify = async (paymentId: string) => {
    try {
      await verifyPayment(paymentId);
      showToast('Payment verified! Double-entry ledger journals posted.', 'success');
      fetchPaymentsData();
    } catch (err: any) {
      showToast(err.message || 'Verification failed', 'error');
    }
  };

  const handleReject = async (paymentId: string) => {
    const reason = prompt('Please enter the reason for rejecting this payment slip:');
    if (!reason) return;
    try {
      await rejectPayment(paymentId, reason);
      showToast('Payment slip marked as rejected.', 'warning');
      fetchPaymentsData();
    } catch (err: any) {
      showToast(err.message || 'Rejection failed', 'error');
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.member_id || !recordForm.scheme_id) {
      showToast('Please select both a subscriber and a chit scheme.', 'warning');
      return;
    }
    setSubmittingRecord(true);
    try {
      await recordPayment(recordForm);
      showToast('Counter collection recorded successfully!', 'success');
      setShowRecordModal(false);
      fetchPaymentsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setSubmittingRecord(false);
    }
  };

  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const verifiedPayments = payments.filter((p) => p.status === 'verified');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
            Collections & Payment Verification
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Accountant verification workbench for UPI slips, bank deposits, and counter cash collections.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowRecordModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusCircle size={16} />
            Record Collection
          </button>

          <button
            onClick={fetchPaymentsData}
            className="btn btn-secondary"
            style={{ padding: '10px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Pending Verification
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>
            {pendingPayments.length} Records
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            ₹{pendingPayments.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')} pending
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Verified Collections
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
            {verifiedPayments.length} Records
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            ₹{verifiedPayments.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')} credited
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Status Filter
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '6px', fontSize: '13px' }}
          >
            <option value="all">All Payments ({payments.length})</option>
            <option value="pending">Pending Verification Only</option>
            <option value="verified">Verified Records Only</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Receipt / Slip #</th>
                <th style={{ padding: '12px 16px' }}>Date</th>
                <th style={{ padding: '12px 16px' }}>Subscriber & Member Code</th>
                <th style={{ padding: '12px 16px' }}>Scheme & Month</th>
                <th style={{ padding: '12px 16px' }}>Payment Mode & Ref</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount Paid</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Verification Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                    <div>Loading payment transactions...</div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Receipt size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>No Payments Found</div>
                    <div>Recorded subscription receipts will appear here.</div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                      {p.receipt_number}
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {new Date(p.payment_date).toLocaleDateString('en-IN')}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{p.member_name || 'Subscriber'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.member_code || p.member_id.slice(0, 8)}</div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{p.scheme_name || 'Chit Scheme'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Instalment #{p.instalment_number}</div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--surface-alt)' }}>
                        {p.payment_mode}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                        {p.transaction_ref || 'Counter'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontSize: '14px' }}>
                      ₹{p.amount.toLocaleString('en-IN')}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${p.status === 'verified' ? 'badge-success' : p.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {p.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleVerify(p.id)}
                            className="btn btn-primary"
                            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckCircle2 size={13} />
                            Verify
                          </button>
                          <button
                            onClick={() => handleReject(p.id)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}
                          >
                            <XCircle size={13} />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {p.status === 'verified' ? 'Ledger Balanced' : 'Rejected'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== MODAL: RECORD COUNTER PAYMENT ==================== */}
      <Modal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        title="Record Subscriber Payment Collection"
        size="md"
      >
        <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Select Subscriber <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={recordForm.member_id}
              onChange={(e) => setRecordForm({ ...recordForm, member_id: e.target.value })}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
            >
              <option value="">-- Choose Subscriber --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.member_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Select Chit Scheme <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={recordForm.scheme_id}
              onChange={(e) => setRecordForm({ ...recordForm, scheme_id: e.target.value })}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
            >
              <option value="">-- Choose Scheme --</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.scheme_name} ({s.scheme_code})
                </option>
              ))}
            </select>
          </div>

          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Instalment Month #
              </label>
              <input
                type="number"
                min={1}
                value={recordForm.instalment_number}
                onChange={(e) => setRecordForm({ ...recordForm, instalment_number: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Amount Paid (₹)
              </label>
              <input
                type="number"
                min={1}
                value={recordForm.amount}
                onChange={(e) => setRecordForm({ ...recordForm, amount: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700 }}
              />
            </div>
          </div>

          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Payment Method
              </label>
              <select
                value={recordForm.payment_mode}
                onChange={(e) => setRecordForm({ ...recordForm, payment_mode: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              >
                <option value="cash">Cash Collection</option>
                <option value="upi">UPI / QR Code</option>
                <option value="bank_transfer">NEFT / RTGS</option>
                <option value="cheque">Cheque Deposit</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Ref / Cheque #
              </label>
              <input
                type="text"
                value={recordForm.transaction_ref}
                onChange={(e) => setRecordForm({ ...recordForm, transaction_ref: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setShowRecordModal(false)}
              className="btn btn-secondary"
              disabled={submittingRecord}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingRecord}
            >
              {submittingRecord ? 'Saving...' : 'Save Collection Slip'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
