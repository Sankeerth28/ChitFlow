import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Printer,
  CheckCircle2,
  CreditCard,
  Calendar,
  RefreshCw,
  Eye,
} from 'lucide-react';
import {
  getMemberReceipts,
  getMemberDues,
} from '../api/members';
import { submitPayment } from '../api/payments';
import type {
  MemberPaymentReceipt,
  MemberDueDetail,
} from '../api/members';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

interface MemberReceiptsDuesViewProps {
  memberId: string;
}

export const MemberReceiptsDuesView: React.FC<MemberReceiptsDuesViewProps> = ({ memberId }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'receipts' | 'dues'>('receipts');
  const [loading, setLoading] = useState<boolean>(true);

  const [receipts, setReceipts] = useState<MemberPaymentReceipt[]>([]);
  const [dues, setDues] = useState<MemberDueDetail[]>([]);

  // Selected receipt for printable voucher modal
  const [selectedReceipt, setSelectedReceipt] = useState<MemberPaymentReceipt | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);

  // Pay Now Modal
  const [selectedDue, setSelectedDue] = useState<MemberDueDetail | null>(null);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<string>('upi');
  const [referenceId, setReferenceId] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [receiptsData, duesData] = await Promise.all([
        getMemberReceipts(memberId),
        getMemberDues(memberId),
      ]);
      setReceipts(receiptsData);
      setDues(duesData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load receipts and dues', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [memberId]);

  const handlePrint = () => {
    window.print();
  };

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDue) return;
    setSubmittingPayment(true);
    try {
      // Submit payment via centralized API service
      await submitPayment({
        scheme_id: selectedDue.scheme_id,
        member_id: memberId,
        instalment_number: selectedDue.instalment_number,
        amount: selectedDue.net_due,
        payment_mode: paymentMode,
        transaction_ref: referenceId.trim() || undefined,
      });

      showToast('Payment submitted successfully! Marked for accountant verification.', 'success');
      setShowPayModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Payment submission failed', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
            Financial Records: Receipts & Dues
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Authoritative double-entry receipts, statutory deductions, and upcoming subscription instalments.
          </p>
        </div>

        <button
          onClick={loadData}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid var(--border)', gap: '24px' }}>
        <button
          onClick={() => setActiveTab('receipts')}
          style={{
            padding: '12px 16px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'receipts' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'receipts' ? 700 : 500,
            color: activeTab === 'receipts' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Receipt size={18} />
          Official Payment Receipts ({receipts.length})
        </button>

        <button
          onClick={() => setActiveTab('dues')}
          style={{
            padding: '12px 16px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'dues' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'dues' ? 700 : 500,
            color: activeTab === 'dues' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Calendar size={18} />
          Upcoming & Pending Dues ({dues.length})
        </button>
      </div>

      {/* TAB 1: RECEIPTS */}
      {activeTab === 'receipts' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Receipt #</th>
                  <th style={{ padding: '12px 16px' }}>Payment Date</th>
                  <th style={{ padding: '12px 16px' }}>Scheme</th>
                  <th style={{ padding: '12px 16px' }}>Payment Mode</th>
                  <th style={{ padding: '12px 16px' }}>Transaction Ref</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount Paid</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Verification</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                      <div>Loading official payment receipts...</div>
                    </td>
                  </tr>
                ) : receipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Receipt size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>No Payment Receipts Found</div>
                      <div>Payments recorded will appear here with printable statutory receipts.</div>
                    </td>
                  </tr>
                ) : (
                  receipts.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                        {r.receipt_number}
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {new Date(r.payment_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{r.scheme_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Instalment #{r.instalment_number}</div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--surface-alt)' }}>
                          {r.payment_mode}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {r.transaction_ref || 'CASH-COUNTER'}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontSize: '14px' }}>
                        ₹{r.amount.toLocaleString('en-IN')}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className={`badge ${r.status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedReceipt(r);
                            setShowVoucherModal(true);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={13} />
                          Print Voucher
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DUES */}
      {activeTab === 'dues' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Scheme Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Instalment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Gross Subscription</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Auction Dividend Saved</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Net Contribution Due</th>
                  <th style={{ padding: '12px 16px' }}>Due Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                      <div>Calculating current subscription dues...</div>
                    </td>
                  </tr>
                ) : dues.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--success)' }}>
                      <CheckCircle2 size={32} style={{ margin: '0 auto 12px auto' }} />
                      <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>All Subscriptions Cleared!</div>
                      <div>Zero outstanding dues. All instalment payments are recorded and balanced.</div>
                    </td>
                  </tr>
                ) : (
                  dues.map((d, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{d.scheme_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Monthly Chit Pool</div>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                        Month {d.instalment_number}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        ₹{d.gross_subscription.toLocaleString('en-IN')}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>
                        − ₹{d.dividend_amount.toLocaleString('en-IN')}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--danger)', fontSize: '14px' }}>
                        ₹{d.net_due.toLocaleString('en-IN')}
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN') : 'Due Now'}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedDue(d);
                            setShowPayModal(true);
                          }}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <CreditCard size={13} />
                          Pay Online
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL: PRINTABLE STATUTORY RECEIPT VOUCHER ==================== */}
      <Modal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        title="Statutory Subscription Receipt Voucher"
        size="lg"
      >
        {selectedReceipt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* The Printable Area */}
            <div
              id="printable-receipt"
              style={{
                border: '2px solid #000000',
                padding: '24px',
                backgroundColor: '#ffffff',
                color: '#000000',
                fontFamily: 'serif',
                position: 'relative',
              }}
            >
              {/* Receipt Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Sri Balaji Chit Funds Pvt. Ltd.
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Registered Office: Road No. 12, Banjara Hills, Hyderabad, Telangana - 500034
                </div>
                <div style={{ fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>
                  Registered under Chit Funds Act, 1982 | Registrar of Chits, Govt. of Telangana
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px', textDecoration: 'underline' }}>
                  OFFICIAL SUBSCRIPTION RECEIPT VOUCHER
                </div>
              </div>

              {/* Receipt Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
                <div>
                  <strong>Receipt No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedReceipt.receipt_number}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>Date:</strong> {new Date(selectedReceipt.payment_date).toLocaleDateString('en-IN')}
                </div>
                <div>
                  <strong>Scheme:</strong> {selectedReceipt.scheme_name}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>Instalment Month:</strong> #{selectedReceipt.instalment_number}
                </div>
                <div>
                  <strong>Payment Mode:</strong> {selectedReceipt.payment_mode.toUpperCase()}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>Ref / Cheque No:</strong> {selectedReceipt.transaction_ref || 'CASH'}
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', fontSize: '13px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #000000' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #000000' }}>Description</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #000000' }}>
                    <td style={{ padding: '8px', borderRight: '1px solid #000000' }}>
                      Subscription for Instalment #{selectedReceipt.instalment_number} ({selectedReceipt.scheme_name})
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                      ₹{selectedReceipt.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 800, backgroundColor: '#f9fafb' }}>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>
                      TOTAL NET RECEIVED:
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      ₹{selectedReceipt.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Statutory Note & Double-Entry Ledger Signoff */}
              <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.4, marginBottom: '24px' }}>
                * This receipt constitutes legal acknowledgement of subscription paid in accordance with Section 23 of the Chit Funds Act, 1982.
                General Ledger Accounts Credited: 1100 (Member Subscriptions Receivable).
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '30px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderTop: '1px dashed #000000', width: '180px', paddingTop: '4px', fontSize: '12px' }}>
                    Subscriber Signature
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>
                    [DIGITALLY VERIFIED]
                  </div>
                  <div style={{ borderTop: '1px solid #000000', width: '220px', paddingTop: '4px', fontSize: '12px' }}>
                    For Sri Balaji Chit Funds Pvt. Ltd.<br />
                    (Authorised Signatory / Foreman)
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} />
                Print Voucher (PDF)
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== MODAL: PAY NOW SIMULATION ==================== */}
      <Modal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title={`Pay Subscription: ${selectedDue?.scheme_name} (M#${selectedDue?.instalment_number})`}
        size="md"
      >
        {selectedDue && (
          <form onSubmit={handleSimulatePayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--surface-alt)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Gross Subscription:</span>
                <span>₹{selectedDue.gross_subscription.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--primary)' }}>
                <span>Auction Dividend Deduction:</span>
                <span>− ₹{selectedDue.dividend_amount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)', fontWeight: 800, fontSize: '16px', color: 'var(--danger)' }}>
                <span>Net Payable Amount:</span>
                <span>₹{selectedDue.net_due.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Payment Method
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              >
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="bank_transfer">NEFT / RTGS / IMPS Bank Transfer</option>
                <option value="cheque">Cheque Deposit</option>
                <option value="cash">Cash at Organiser Counter</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Transaction / UTR Reference ID
              </label>
              <input
                type="text"
                placeholder="e.g. 334455667788 or Cheque #104050"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="btn btn-secondary"
                disabled={submittingPayment}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingPayment}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {submittingPayment && <RefreshCw size={14} className="spin" />}
                Submit Payment Slip
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
