import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  PlusCircle,
  PlayCircle,
  RefreshCw,
  CheckCircle2,
  Users
} from 'lucide-react';
import { listSchemes, createScheme, activateScheme, enrolMemberInScheme } from '../api/schemes';
import type { SchemeItem } from '../api/schemes';
import { listMembers } from '../api/members';
import type { MemberItem } from '../api/members';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const SchemesView: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEnrolModal, setShowEnrolModal] = useState<boolean>(false);
  const [selectedScheme, setSelectedScheme] = useState<SchemeItem | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    scheme_code: '',
    scheme_name: '',
    chit_value: 100000,
    total_months: 10,
    monthly_subscription: 10000,
    foreman_commission_rate: 5,
    min_bid_discount_rate: 5,
    max_bid_discount_rate: 30,
    registrar_pso_number: 'PSO-HYD-2026-08',
  });
  const [creating, setCreating] = useState<boolean>(false);

  // Enrol Form State
  const [enrolMemberId, setEnrolMemberId] = useState<string>('');
  const [enrolTicketNumber, setEnrolTicketNumber] = useState<number>(1);
  const [enrolling, setEnrolling] = useState<boolean>(false);

  const fetchSchemesData = async () => {
    setLoading(true);
    try {
      const data = await listSchemes();
      setSchemes(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load chit schemes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembersList = async () => {
    try {
      const data = await listMembers({ page: 1, page_size: 100 });
      setMembers(data.items);
    } catch {
      // Best-effort
    }
  };

  useEffect(() => {
    fetchSchemesData();
    fetchMembersList();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createScheme(createForm);
      showToast('Chit Scheme created in Draft status!', 'success');
      setShowCreateModal(false);
      fetchSchemesData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create scheme', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (scheme: SchemeItem) => {
    if (!window.confirm(`Activate scheme ${scheme.scheme_name}? This verifies Section 20 100% Fixed Deposit guarantee and enables monthly auctions.`)) {
      return;
    }
    try {
      await activateScheme(scheme.id);
      showToast(`Scheme ${scheme.scheme_code} activated successfully!`, 'success');
      fetchSchemesData();
    } catch (err: any) {
      showToast(err.message || 'Failed to activate scheme', 'error');
    }
  };

  const handleEnrolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheme || !enrolMemberId) {
      showToast('Please select a subscriber to enrol.', 'warning');
      return;
    }
    setEnrolling(true);
    try {
      await enrolMemberInScheme(selectedScheme.id, enrolMemberId, enrolTicketNumber);
      showToast(`Enrolled subscriber as Ticket #${enrolTicketNumber}!`, 'success');
      setShowEnrolModal(false);
      fetchSchemesData();
    } catch (err: any) {
      showToast(err.message || 'Enrolment failed', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
            Chit Schemes Management
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Lifecycle management for chit fund schemes compliant with Chit Funds Act, 1982.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setCreateForm({
                scheme_code: `CF-${Date.now().toString().slice(-4)}`,
                scheme_name: 'Lakshmi Deepam 1 Lakh Chit',
                chit_value: 100000,
                total_months: 10,
                monthly_subscription: 10000,
                foreman_commission_rate: 5,
                min_bid_discount_rate: 5,
                max_bid_discount_rate: 30,
                registrar_pso_number: 'PSO-HYD-2026-08',
              });
              setShowCreateModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusCircle size={16} />
            Create New Scheme
          </button>

          <button
            onClick={fetchSchemesData}
            className="btn btn-secondary"
            style={{ padding: '10px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Schemes Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto' }} />
          <div>Loading registered chit schemes...</div>
        </div>
      ) : schemes.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <FolderKanban size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0' }}>No Chit Schemes Registered</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
            Create your first statutory chit scheme to enrol members and initiate reverse auctions.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            Create Scheme
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '20px' }}>
          {schemes.map((s) => (
            <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                    {s.scheme_code}
                  </span>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--text)' }}>
                    {s.scheme_name}
                  </h3>
                </div>
                <span
                  className={`badge ${
                    s.status === 'active'
                      ? 'badge-success'
                      : s.status === 'completed'
                      ? 'badge-secondary'
                      : 'badge-warning'
                  }`}
                >
                  {s.status.toUpperCase()}
                </span>
              </div>

              {/* Financial Metrics Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  padding: '12px',
                  backgroundColor: 'var(--surface-alt)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Chit Value:</span>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
                    ₹{s.chit_value.toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Monthly Gross:</span>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
                    ₹{s.monthly_subscription.toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
                  <div style={{ fontWeight: 600 }}>{s.total_months || s.duration_months} Months</div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Current Month:</span>
                  <div style={{ fontWeight: 600 }}>Month #{s.current_month || 1}</div>
                </div>
              </div>

              {/* Statutory Specs */}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                • Foreman Commission: <strong>{s.foreman_commission_rate || s.commission_percentage}%</strong> (Sec 21 capped)<br />
                • Max Discount Ceiling: <strong>{s.max_bid_discount_rate || s.max_discount_percentage}%</strong> (2019 Amendment)<br />
                • PSO Sanction: <strong>{s.registrar_pso_number || s.pso_number || 'Section 4 Sanctioned'}</strong>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                {s.status === 'draft' ? (
                  <button
                    onClick={() => handleActivate(s)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                  >
                    <PlayCircle size={14} />
                    Verify FD & Activate
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '12px', fontWeight: 600 }}>
                    <CheckCircle2 size={14} />
                    Active Auctioning
                  </div>
                )}

                <button
                  onClick={() => {
                    setSelectedScheme(s);
                    setEnrolTicketNumber(1);
                    setShowEnrolModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                >
                  <Users size={14} />
                  Enrol Subscriber
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== MODAL: CREATE SCHEME ==================== */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Register Statutory Chit Scheme"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Scheme Code
            </label>
            <input
              type="text"
              required
              value={createForm.scheme_code}
              onChange={(e) => setCreateForm({ ...createForm, scheme_code: e.target.value.toUpperCase() })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Scheme Name
            </label>
            <input
              type="text"
              required
              value={createForm.scheme_name}
              onChange={(e) => setCreateForm({ ...createForm, scheme_name: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Chit Value (₹)
              </label>
              <input
                type="number"
                required
                value={createForm.chit_value}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCreateForm({
                    ...createForm,
                    chit_value: val,
                    monthly_subscription: Math.round(val / createForm.total_months),
                  });
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Duration (Months)
              </label>
              <input
                type="number"
                required
                value={createForm.total_months}
                onChange={(e) => {
                  const months = Number(e.target.value);
                  setCreateForm({
                    ...createForm,
                    total_months: months,
                    monthly_subscription: Math.round(createForm.chit_value / months),
                  });
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Prior Sanction Order (PSO) Reference
            </label>
            <input
              type="text"
              value={createForm.registrar_pso_number}
              onChange={(e) => setCreateForm({ ...createForm, registrar_pso_number: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Save Scheme'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: ENROL MEMBER ==================== */}
      <Modal
        isOpen={showEnrolModal}
        onClose={() => setShowEnrolModal(false)}
        title={`Enrol Subscriber into ${selectedScheme?.scheme_name}`}
        size="md"
      >
        <form onSubmit={handleEnrolSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Select Registered Subscriber:
            </label>
            <select
              value={enrolMemberId}
              onChange={(e) => setEnrolMemberId(e.target.value)}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
            >
              <option value="">-- Choose Subscriber --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.member_code} - {m.mobile_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Ticket Number (1 to {selectedScheme?.total_members || selectedScheme?.duration_months || 20})
            </label>
            <input
              type="number"
              min={1}
              max={selectedScheme?.total_members || selectedScheme?.duration_months || 20}
              value={enrolTicketNumber}
              onChange={(e) => setEnrolTicketNumber(Number(e.target.value))}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setShowEnrolModal(false)}
              className="btn btn-secondary"
              disabled={enrolling}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={enrolling}
            >
              {enrolling ? 'Enrolling...' : 'Confirm Enrolment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
