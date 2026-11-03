import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Download,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';
import {
  listMembers,
  getMemberProfile,
  createMember,
  updateMember,
  updateMemberStatus,
  importMembersCsv,
} from '../api/members';
import type {
  MemberItem,
  MemberFullProfile,
  MemberCreatePayload,
  CsvImportResult
} from '../api/members';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';

export const MembersManagementView: React.FC = () => {
  const { showToast } = useToast();

  // State: Member List & Pagination
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

  // State: Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [kycFilter, setKycFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);

  // Selected Member & Profile Data
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberFullProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileActiveTab, setProfileActiveTab] = useState<'schemes' | 'receipts' | 'dues'>('schemes');

  // Add/Edit Form State
  const [formState, setFormState] = useState<MemberCreatePayload>({
    full_name: '',
    mobile_number: '',
    email: '',
    member_code: '',
    address_line1: '',
    city: '',
    state: 'Telangana',
    pincode: '',
    emergency_contact: '',
    kyc_status: 'pending',
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Status Change State
  const [newStatus, setNewStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [statusReason, setStatusReason] = useState<string>('');

  // CSV Import State
  const [csvText, setCsvText] = useState<string>('');
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResult | null>(null);
  const [csvImporting, setCsvImporting] = useState<boolean>(false);

  // Fetch Members
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMembers({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        kyc_status: kycFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setMembers(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err: any) {
      showToast(err.message || 'Failed to load member records', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, kycFilter, sortBy, sortOrder, showToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Load Member 360 Profile
  const handleOpenProfile = async (member: MemberItem) => {
    setSelectedMember(member);
    setMemberProfile(null);
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      const profile = await getMemberProfile(member.id);
      setMemberProfile(profile);
    } catch (err: any) {
      showToast(err.message || 'Failed to load member 360 profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (member: MemberItem) => {
    setSelectedMember(member);
    setFormState({
      full_name: member.full_name,
      mobile_number: member.mobile_number || '',
      email: member.email || '',
      member_code: member.member_code,
      address_line1: member.address_line1,
      city: member.city,
      state: member.state,
      pincode: member.pincode,
      emergency_contact: member.emergency_contact || '',
      kyc_status: member.kyc_status as any,
    });
    setShowEditModal(true);
  };

  // Open Status Modal
  const handleOpenStatus = (member: MemberItem) => {
    setSelectedMember(member);
    setNewStatus(member.status);
    setStatusReason('');
    setShowStatusModal(true);
  };

  // Handle Add Member Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.full_name.trim() || !formState.mobile_number?.trim() || !formState.address_line1.trim()) {
      showToast('Please provide Name, Mobile Number, and Address.', 'warning');
      return;
    }
    setFormSubmitting(true);
    try {
      await createMember(formState);
      showToast('Member created successfully!', 'success');
      setShowAddModal(false);
      fetchMembers();
    } catch (err: any) {
      showToast(err.message || 'Failed to create member', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Edit Member Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setFormSubmitting(true);
    try {
      await updateMember(selectedMember.id, formState);
      showToast('Member details updated successfully!', 'success');
      setShowEditModal(false);
      fetchMembers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update member', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Status Update Submit
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setFormSubmitting(true);
    try {
      await updateMemberStatus(selectedMember.id, newStatus, statusReason);
      showToast(`Member status changed to ${newStatus.toUpperCase()}`, 'success');
      setShowStatusModal(false);
      fetchMembers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update member status', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle CSV Import Submit
  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      showToast('Please paste valid CSV data or upload a file.', 'warning');
      return;
    }
    setCsvImporting(true);
    setCsvImportResult(null);
    try {
      const result = await importMembersCsv(csvText, true);
      setCsvImportResult(result);
      if (result.success_count > 0) {
        showToast(`Successfully imported ${result.success_count} subscriber(s)!`, 'success');
        fetchMembers();
      } else {
        showToast(`Import processed with 0 new additions. Check errors below.`, 'warning');
      }
    } catch (err: any) {
      showToast(err.message || 'CSV Import failed', 'error');
    } finally {
      setCsvImporting(false);
    }
  };

  // Handle CSV File Pick
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
      }
    };
    reader.readAsText(file);
  };

  // Sample CSV Template Generator
  const downloadSampleCsv = () => {
    const header = 'full_name,mobile_number,email,address_line1,city,state,pincode,emergency_contact,kyc_status\n';
    const row1 = 'Ravi Shankar,9876543201,ravi@example.com,Plot 14 Jubilee Hills,Hyderabad,Telangana,500033,9876543299,verified\n';
    const row2 = 'Lakshmi Priya,9876543202,lakshmi@example.com,Flat 402 Banjara Hills,Hyderabad,Telangana,500034,9876543298,pending\n';
    const blob = new Blob([header + row1 + row2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'chitflow_members_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
            Subscriber & Member Management
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Authoritative registry of subscribers, scheme allocations, KYC status, and bulk onboarding.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setFormState({
                full_name: '',
                mobile_number: '',
                email: '',
                member_code: '',
                address_line1: '',
                city: '',
                state: 'Telangana',
                pincode: '',
                emergency_contact: '',
                kyc_status: 'pending',
              });
              setShowAddModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600 }}
          >
            <UserPlus size={16} />
            Add Subscriber
          </button>

          <button
            onClick={() => {
              setCsvImportResult(null);
              setShowCsvModal(true);
            }}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600 }}
          >
            <FileSpreadsheet size={16} />
            Bulk CSV Import
          </button>

          <button
            onClick={fetchMembers}
            className="btn btn-secondary"
            title="Refresh List"
            style={{ padding: '10px', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search by name, code, mobile, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface-alt)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-alt)',
              fontSize: '13px',
            }}
          >
            <option value="">All Statuses (Active, Inactive, Suspended)</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="suspended">Suspended Only</option>
          </select>

          {/* KYC Filter */}
          <select
            value={kycFilter}
            onChange={(e) => {
              setKycFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-alt)',
              fontSize: '13px',
            }}
          >
            <option value="">All KYC Statuses</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending Verification</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Sort By */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface-alt)',
                fontSize: '13px',
              }}
            >
              <option value="created_at">Date Registered</option>
              <option value="full_name">Subscriber Name</option>
              <option value="member_code">Member Code</option>
              <option value="status">Account Status</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn btn-secondary"
              title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }}
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>

        {/* Quick Filter Counts */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span>Total Records Matching: <strong style={{ color: 'var(--text)' }}>{total}</strong></span>
          {(search || statusFilter || kycFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setKycFilter('');
                setPage(1);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Members Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Code & Status</th>
                <th style={{ padding: '12px 16px' }}>Subscriber Info</th>
                <th style={{ padding: '12px 16px' }}>Contact & Address</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Active Chits</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>KYC</th>
                <th style={{ padding: '12px 16px' }}>Registered</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
                    <div>Loading subscriber records from database...</div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Users size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>No Subscribers Found</div>
                    <div>Try adjusting your search criteria or register a new subscriber.</div>
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Code & Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', fontSize: '13px' }}>
                        {m.member_code}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <span
                          className={`badge ${
                            m.status === 'active'
                              ? 'badge-success'
                              : m.status === 'suspended'
                              ? 'badge-danger'
                              : 'badge-secondary'
                          }`}
                        >
                          {m.status.toUpperCase()}
                        </span>
                      </div>
                    </td>

                    {/* Subscriber Info */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>
                        {m.full_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                        <Phone size={12} />
                        <span>{m.mobile_number || 'No Mobile'}</span>
                      </div>
                      {m.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                          <Mail size={12} />
                          <span>{m.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact & Address */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        <MapPin size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          {m.address_line1}, {m.city}, {m.state} - {m.pincode}
                        </span>
                      </div>
                      {m.emergency_contact && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Emerg: {m.emergency_contact}
                        </div>
                      )}
                    </td>

                    {/* Enrolled Schemes Count */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--surface-alt)',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}
                      >
                        {m.active_schemes_count ?? 0}
                      </span>
                    </td>

                    {/* KYC Status */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        className={`badge ${
                          m.kyc_status === 'verified'
                            ? 'badge-success'
                            : m.kyc_status === 'rejected'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {m.kyc_status.toUpperCase()}
                      </span>
                    </td>

                    {/* Registered Date */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('en-IN') : '-'}
                    </td>

                    {/* Action Buttons */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenProfile(m)}
                          className="btn btn-secondary"
                          title="View 360° Profile & Ledgers"
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={13} />
                          Profile
                        </button>

                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="btn btn-secondary"
                          title="Edit Subscriber Details"
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => handleOpenStatus(m)}
                          className="btn btn-secondary"
                          title="Change Account Status"
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <ShieldAlert size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>
              Showing {members.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, total)} of {total} entries
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-alt)',
                  fontSize: '12px',
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ==================== MODAL: ADD SUBSCRIBER ==================== */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register New Subscriber"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Full Legal Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. S. Venkata Rao"
                value={formState.full_name}
                onChange={(e) => setFormState({ ...formState, full_name: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Mobile Number (10 digits) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="e.g. 9849012347"
                value={formState.mobile_number}
                onChange={(e) => setFormState({ ...formState, mobile_number: e.target.value.replace(/\D/g, '') })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. subscriber@example.com"
                value={formState.email}
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Custom Member Code (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank for MEM-XXXX"
                value={formState.member_code}
                onChange={(e) => setFormState({ ...formState, member_code: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Residential / Business Address <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Door No, Street name"
                value={formState.address_line1}
                onChange={(e) => setFormState({ ...formState, address_line1: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                City <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Hyderabad"
                value={formState.city}
                onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                State <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formState.state}
                onChange={(e) => setFormState({ ...formState, state: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Pincode <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="500001"
                value={formState.pincode}
                onChange={(e) => setFormState({ ...formState, pincode: e.target.value.replace(/\D/g, '') })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Emergency Contact (Optional)
              </label>
              <input
                type="text"
                placeholder="Name & 10-digit Phone"
                value={formState.emergency_contact}
                onChange={(e) => setFormState({ ...formState, emergency_contact: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Initial KYC Status
              </label>
              <select
                value={formState.kyc_status}
                onChange={(e) => setFormState({ ...formState, kyc_status: e.target.value as any })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              >
                <option value="pending">Pending Document Verification</option>
                <option value="verified">Verified (Aadhaar / PAN Verified)</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="btn btn-secondary"
              disabled={formSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {formSubmitting && <RefreshCw size={14} className="spin" />}
              Save Subscriber
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: EDIT SUBSCRIBER ==================== */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Subscriber: ${selectedMember?.full_name} (${selectedMember?.member_code})`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Full Legal Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formState.full_name}
                onChange={(e) => setFormState({ ...formState, full_name: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Mobile Number
              </label>
              <input
                type="text"
                maxLength={10}
                value={formState.mobile_number}
                onChange={(e) => setFormState({ ...formState, mobile_number: e.target.value.replace(/\D/g, '') })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={formState.email}
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Address Line 1 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formState.address_line1}
                onChange={(e) => setFormState({ ...formState, address_line1: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                City
              </label>
              <input
                type="text"
                required
                value={formState.city}
                onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                State
              </label>
              <input
                type="text"
                required
                value={formState.state}
                onChange={(e) => setFormState({ ...formState, state: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Pincode
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={formState.pincode}
                onChange={(e) => setFormState({ ...formState, pincode: e.target.value.replace(/\D/g, '') })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Emergency Contact
              </label>
              <input
                type="text"
                value={formState.emergency_contact}
                onChange={(e) => setFormState({ ...formState, emergency_contact: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                KYC Verification Status
              </label>
              <select
                value={formState.kyc_status}
                onChange={(e) => setFormState({ ...formState, kyc_status: e.target.value as any })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
              >
                <option value="pending">Pending Document Verification</option>
                <option value="verified">Verified (Aadhaar / PAN Verified)</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="btn btn-secondary"
              disabled={formSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {formSubmitting && <RefreshCw size={14} className="spin" />}
              Update Subscriber
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: CHANGE ACCOUNT STATUS ==================== */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title={`Change Status: ${selectedMember?.full_name}`}
        size="md"
      >
        <form onSubmit={handleStatusSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--surface-alt)', borderRadius: '6px', fontSize: '13px' }}>
            Current Status: <strong style={{ textTransform: 'uppercase' }}>{selectedMember?.status}</strong>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Select New Account Status:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={newStatus === 'active'}
                  onChange={() => setNewStatus('active')}
                />
                <span className="badge badge-success">ACTIVE</span>
                <span>Subscriber can participate in chit auctions and make payments.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={newStatus === 'inactive'}
                  onChange={() => setNewStatus('inactive')}
                />
                <span className="badge badge-secondary">INACTIVE</span>
                <span>Subscriber is not currently participating in new schemes.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="status"
                  value="suspended"
                  checked={newStatus === 'suspended'}
                  onChange={() => setNewStatus('suspended')}
                />
                <span className="badge badge-danger">SUSPENDED</span>
                <span>Account locked due to compliance / statutory default under Section 28.</span>
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Reason for Status Change (Audit Trail Log)
            </label>
            <textarea
              rows={3}
              placeholder="Provide reason for this status transition..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setShowStatusModal(false)}
              className="btn btn-secondary"
              disabled={formSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {formSubmitting && <RefreshCw size={14} className="spin" />}
              Confirm Status Change
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: 360° MEMBER PROFILE ==================== */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title={`Subscriber 360° Profile: ${selectedMember?.full_name} (${selectedMember?.member_code})`}
        size="xl"
      >
        {profileLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto' }} />
            <div>Fetching unified financial profile and double-entry records...</div>
          </div>
        ) : !memberProfile ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
            Failed to load member profile details.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top KPI Banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'var(--surface-alt)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Account Status</div>
                <div style={{ marginTop: '4px' }}>
                  <span className={`badge ${memberProfile.member.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {memberProfile.member.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Schemes</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                  {memberProfile.enrolled_schemes.length}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Collections Paid</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                  ₹{memberProfile.payment_receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pending Net Dues</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)', marginTop: '2px' }}>
                  ₹{memberProfile.outstanding_dues.reduce((sum, d) => sum + Number(d.net_due || 0), 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Profile Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', gap: '4px 16px' }}>
              <button
                onClick={() => setProfileActiveTab('schemes')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileActiveTab === 'schemes' ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: profileActiveTab === 'schemes' ? 700 : 500,
                  color: profileActiveTab === 'schemes' ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Enrolled Chits ({memberProfile.enrolled_schemes.length})
              </button>

              <button
                onClick={() => setProfileActiveTab('receipts')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileActiveTab === 'receipts' ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: profileActiveTab === 'receipts' ? 700 : 500,
                  color: profileActiveTab === 'receipts' ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Payment Receipts ({memberProfile.payment_receipts.length})
              </button>

              <button
                onClick={() => setProfileActiveTab('dues')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileActiveTab === 'dues' ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: profileActiveTab === 'dues' ? 700 : 500,
                  color: profileActiveTab === 'dues' ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Outstanding Dues ({memberProfile.outstanding_dues.length})
              </button>
            </div>

            {/* Tab 1: Enrolled Schemes */}
            {profileActiveTab === 'schemes' && (
              <div>
                {memberProfile.enrolled_schemes.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Subscriber is not yet enrolled in any chit scheme.
                  </div>
                ) : (
                  <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Scheme</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Ticket #</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Chit Value</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Monthly Subs.</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Total Paid</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Dividends</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Prized Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberProfile.enrolled_schemes.map((s) => (
                        <tr key={s.scheme_member_id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 600 }}>{s.scheme_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.scheme_code}</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>
                            #{s.ticket_number}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>
                            ₹{s.chit_value.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            ₹{s.monthly_subscription.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                            ₹{s.total_paid.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: 'var(--primary)' }}>
                            ₹{(s.total_dividend_earned || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span className={`badge ${s.is_prized ? 'badge-primary' : 'badge-secondary'}`}>
                              {s.is_prized ? `Prized (M${s.prize_month})` : 'Non-Prized'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 2: Payment Receipts */}
            {profileActiveTab === 'receipts' && (
              <div>
                {memberProfile.payment_receipts.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No payment receipts recorded yet.
                  </div>
                ) : (
                  <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Receipt #</th>
                        <th style={{ padding: '10px' }}>Date</th>
                        <th style={{ padding: '10px' }}>Scheme</th>
                        <th style={{ padding: '10px' }}>Payment Mode</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberProfile.payment_receipts.map((r) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 700 }}>
                            {r.receipt_number}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                            {new Date(r.payment_date).toLocaleDateString('en-IN')}
                          </td>
                          <td style={{ padding: '10px' }}>{r.scheme_name}</td>
                          <td style={{ padding: '10px', textTransform: 'uppercase', fontSize: '11px' }}>
                            {r.payment_mode}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                            ₹{r.amount.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span className={`badge ${r.status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 3: Outstanding Dues */}
            {profileActiveTab === 'dues' && (
              <div>
                {memberProfile.outstanding_dues.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--success)', fontSize: '13px' }}>
                    <CheckCircle2 size={24} style={{ margin: '0 auto 8px auto' }} />
                    <div>All instalments are fully cleared! Zero outstanding balance.</div>
                  </div>
                ) : (
                  <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Scheme</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Instalment</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Gross Due</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Dividend</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Net Payable</th>
                        <th style={{ padding: '10px' }}>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberProfile.outstanding_dues.map((d, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{d.scheme_name}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>
                            Month {d.instalment_number}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            ₹{d.gross_subscription.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: 'var(--primary)' }}>
                            ₹{d.dividend_amount.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                            ₹{d.net_due.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                            {d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN') : 'Immediate'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ==================== MODAL: BULK CSV IMPORT ==================== */}
      <Modal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        title="Bulk Subscriber CSV Import"
        size="lg"
      >
        <form onSubmit={handleCsvSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-alt)', padding: '12px', borderRadius: '6px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Required Format:</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                full_name, mobile_number, email, address_line1, city, state, pincode, emergency_contact, kyc_status
              </div>
            </div>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              <Download size={13} />
              Sample CSV
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Upload .CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileUpload}
              style={{ fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Or Paste CSV Data Directly:
            </label>
            <textarea
              rows={6}
              placeholder="full_name,mobile_number,email,address_line1,city,state,pincode,emergency_contact,kyc_status&#10;Ramesh Kumar,9849011111,ramesh@example.com,Plot 12 Road 1,Hyderabad,Telangana,500001,9849022222,verified"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          </div>

          {/* Validation Results Panel */}
          {csvImportResult && (
            <div
              style={{
                padding: '14px',
                borderRadius: '6px',
                backgroundColor: csvImportResult.success_count > 0 ? 'var(--surface-alt)' : '#fff5f5',
                border: '1px solid var(--border)',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', gap: '16px', fontWeight: 600, marginBottom: '8px' }}>
                <span style={{ color: 'var(--success)' }}>Added: {csvImportResult.imported_count ?? csvImportResult.success_count ?? 0}</span>
                <span style={{ color: 'var(--warning)' }}>Skipped Duplicates: {csvImportResult.skipped_count}</span>
                <span style={{ color: 'var(--danger)' }}>Failed: {csvImportResult.error_count ?? csvImportResult.errors.length}</span>
              </div>

              {csvImportResult.errors.length > 0 && (
                <div style={{ maxHeight: '140px', overflowY: 'auto', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>
                    Validation Errors:
                  </div>
                  {csvImportResult.errors.map((err, idx) => (
                    <div key={idx} style={{ fontSize: '11px', color: 'var(--danger)', marginBottom: '2px' }}>
                      Row {err.row}: {err.error || (err.field ? `${err.field}: ${err.reason}` : 'Validation failed')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setShowCsvModal(false)}
              className="btn btn-secondary"
              disabled={csvImporting}
            >
              Close
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={csvImporting || !csvText.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {csvImporting && <RefreshCw size={14} className="spin" />}
              Process & Import Records
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
