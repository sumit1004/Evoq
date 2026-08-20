import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext.jsx';
import {
  fetchRegistrations,
  reviewRegistration,
  bulkVerifyRegistrations,
  bulkRejectRegistrations,
  fetchPaymentSummary,
  downloadRegistrationWorkbook,
  downloadPaymentEvidence,
  fetchTournament
} from '../../services/tournamentApi.js';

export function OrganizerRegistrationsPage() {
  const { tournamentId } = useParams();
  const { joinTournament, leaveTournament, on } = useSocket();

  // State
  const [tournament, setTournament] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [summary, setSummary] = useState({ Pending: 0, Verified: 0, Rejected: 0 });
  const [paymentSummary, setPaymentSummary] = useState({ collected: 0, pending: 0, failed: 0, refunded: 0 });
  const [selectedReg, setSelectedReg] = useState(null);
  
  // Selection
  const [checkedIds, setCheckedIds] = useState([]);
  
  // Filters & Pagination
  const [filters, setFilters] = useState({ status: '', search: '', paymentStatus: '', sort: 'newest', page: 1 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [state, setState] = useState({ loading: true, error: '', notice: '' });

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Rejection Modal
  const [rejectionModal, setRejectionModal] = useState({ isOpen: false, regIds: [], reasonType: 'Invalid payment proof', customReason: '' });

  // Bulk Precheck Modal
  const [precheckModal, setPrecheckModal] = useState({ isOpen: false, prechecks: [], eligibleCount: 0, totalValue: 0 });

  // Load Metadata
  const loadMetadata = useCallback(async () => {
    try {
      const tourneyData = await fetchTournament(tournamentId);
      setTournament(tourneyData.tournament);
      
      const paySum = await fetchPaymentSummary(tournamentId);
      setPaymentSummary(paySum.summary);
    } catch (e) {
      console.error('Error loading metadata', e);
    }
  }, [tournamentId]);

  // Load Registrations & Summary counts
  const loadRegistrations = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      // Load paginated list
      const result = await fetchRegistrations(tournamentId, {
        status: filters.status || undefined,
        search: filters.search || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        sort: filters.sort,
        page: filters.page,
        limit: 15
      });
      setRegistrations(result.registrations || []);
      setPagination(result.pagination || { page: 1, totalPages: 1, total: 0 });

      // Load counts (Fetch all without pagination filters to count total aggregate states)
      const allPending = await fetchRegistrations(tournamentId, { status: 'PENDING', limit: 1 });
      const allVerified = await fetchRegistrations(tournamentId, { status: 'VERIFIED', limit: 1 });
      const allRejected = await fetchRegistrations(tournamentId, { status: 'REJECTED', limit: 1 });
      setSummary({
        Pending: allPending.pagination?.total || 0,
        Verified: allVerified.pagination?.total || 0,
        Rejected: allRejected.pagination?.total || 0,
      });

      setState((s) => ({ ...s, loading: false }));
    } catch (error) {
      setState({ loading: false, error: error.message, notice: '' });
    }
  }, [filters, tournamentId]);

  useEffect(() => {
    loadMetadata();
    loadRegistrations();
  }, [loadMetadata, loadRegistrations]);

  // Socket triggers
  useEffect(() => {
    joinTournament(tournamentId);
    
    const refreshData = () => {
      loadMetadata();
      loadRegistrations();
    };

    const removeRegCreated = on('registration_created', refreshData);
    const removeRegUpdated = on('registration_updated', refreshData);
    const removeRegVerified = on('registration_verified', refreshData);
    const removeRegRejected = on('registration_rejected', refreshData);
    const removePaymentUpdated = on('payment_updated', refreshData);

    return () => {
      leaveTournament(tournamentId);
      removeRegCreated();
      removeRegUpdated();
      removeRegVerified();
      removeRegRejected();
      removePaymentUpdated();
    };
  }, [tournamentId, joinTournament, leaveTournament, on, loadMetadata, loadRegistrations]);

  // Checkbox functions
  const handleCheckAll = (e) => {
    if (e.target.checked) {
      setCheckedIds(registrations.map(r => r.id));
    } else {
      setCheckedIds([]);
    }
  };

  const handleCheckRow = (id) => {
    setCheckedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Excel workbook download
  const handleExportWorkbook = async () => {
    try {
      const blob = await downloadRegistrationWorkbook(tournamentId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tournament-${tournamentId}-registrations.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setState(s => ({ ...s, error: e.message }));
    }
  };

  // CSV Export (client side generated or API)
  const handleExportCsv = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/tournaments/${tournamentId}/registrations/export`, {
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem('evoq.accessToken')}`
        }
      });
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tournament-${tournamentId}-registrations.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setState(s => ({ ...s, error: e.message }));
    }
  };

  // Single review
  const handleSingleVerify = async (registration) => {
    if (tournament?.status === 'COMPLETED') {
      window.alert('Completed tournaments are read-only.');
      return;
    }
    if (!window.confirm(`Verify registration for ${registration.teamName}?`)) return;
    try {
      await reviewRegistration(registration.id, { status: 'VERIFIED' });
      setSelectedReg(null);
      setState(s => ({ ...s, notice: 'Registration verified successfully.', error: '' }));
      loadRegistrations();
      loadMetadata();
    } catch (e) {
      setState(s => ({ ...s, error: e.message, notice: '' }));
    }
  };

  const handleSingleRejectPrompt = (registration) => {
    if (tournament?.status === 'COMPLETED') {
      window.alert('Completed tournaments are read-only.');
      return;
    }
    setRejectionModal({
      isOpen: true,
      regIds: [registration.id],
      reasonType: 'Invalid payment proof',
      customReason: ''
    });
  };

  // Rejection Submission
  const handleConfirmRejection = async () => {
    const reason = rejectionModal.reasonType === 'Other' 
      ? rejectionModal.customReason 
      : rejectionModal.reasonType;

    if (!reason.trim()) {
      window.alert('A rejection reason is required.');
      return;
    }

    try {
      if (rejectionModal.regIds.length === 1) {
        await reviewRegistration(rejectionModal.regIds[0], { status: 'REJECTED', rejectionReason: reason });
      } else {
        await bulkRejectRegistrations(rejectionModal.regIds, reason);
      }
      setRejectionModal({ isOpen: false, regIds: [], reasonType: 'Invalid payment proof', customReason: '' });
      setSelectedReg(null);
      setCheckedIds([]);
      setState(s => ({ ...s, notice: 'Registration(s) rejected successfully.', error: '' }));
      loadRegistrations();
      loadMetadata();
    } catch (e) {
      setState(s => ({ ...s, error: e.message, notice: '' }));
    }
  };

  // Bulk Verification Precheck
  const handleBulkVerifyClick = async () => {
    if (tournament?.status === 'COMPLETED') {
      window.alert('Completed tournaments are read-only.');
      return;
    }
    setState(s => ({ ...s, loading: true }));
    try {
      // We simulate prechecks client side or make validation calls
      const checks = checkedIds.map(id => {
        const reg = registrations.find(r => r.id === id);
        if (!reg) return { id, check: 'Invalid', reason: 'Not found' };
        if (reg.status !== 'PENDING') return { id, check: 'Invalid', reason: 'Not pending' };
        if (reg.entryType === 'PAID') {
          if (!reg.paymentScreenshotPath) return { id, check: 'Needs Review', reason: 'Missing screenshot' };
          if (!reg.transactionId) return { id, check: 'Needs Review', reason: 'Missing transaction ID' };
          if (reg.paymentStatus === 'REJECTED') return { id, check: 'Invalid', reason: 'Payment rejected' };
        }
        return { id, check: 'Eligible', reason: 'Ready' };
      });

      const eligibleCount = checks.filter(c => c.check === 'Eligible').length;
      const fee = tournament?.entryFee || 0;
      const totalValue = eligibleCount * fee;

      setPrecheckModal({
        isOpen: true,
        prechecks: checks,
        eligibleCount,
        totalValue
      });
      setState(s => ({ ...s, loading: false }));
    } catch (e) {
      setState(s => ({ ...s, error: e.message, loading: false }));
    }
  };

  const handleConfirmBulkVerify = async () => {
    setPrecheckModal(m => ({ ...m, isOpen: false }));
    setState(s => ({ ...s, loading: true }));
    try {
      const eligibleIds = precheckModal.prechecks
        .filter(c => c.check === 'Eligible')
        .map(c => c.id);

      if (eligibleIds.length === 0) {
        window.alert('No eligible registrations selected.');
        setState(s => ({ ...s, loading: false }));
        return;
      }

      const result = await bulkVerifyRegistrations(eligibleIds);
      setCheckedIds([]);
      setState(s => ({
        ...s,
        notice: `Successfully verified ${result.verifiedCount} registrations.`,
        error: result.failures.length > 0 ? `Failed to verify ${result.failures.length} registrations.` : '',
        loading: false
      }));
      loadRegistrations();
      loadMetadata();
    } catch (e) {
      setState(s => ({ ...s, error: e.message, loading: false }));
    }
  };

  const handleBulkRejectClick = () => {
    if (tournament?.status === 'COMPLETED') {
      window.alert('Completed tournaments are read-only.');
      return;
    }
    setRejectionModal({
      isOpen: true,
      regIds: checkedIds,
      reasonType: 'Invalid payment proof',
      customReason: ''
    });
  };

  // Image lightbox secure downloader
  const handleOpenLightbox = async (regId) => {
    try {
      const blob = await downloadPaymentEvidence(regId);
      const url = URL.createObjectURL(blob);
      setLightboxUrl(url);
      setLightboxZoom(1);
    } catch (e) {
      window.alert('Error downloading payment evidence: ' + e.message);
    }
  };

  const handleCloseLightbox = () => {
    if (lightboxUrl) {
      URL.revokeObjectURL(lightboxUrl);
    }
    setLightboxUrl(null);
  };

  const isCompleted = tournament?.status === 'COMPLETED';

  return (
    <section className="workspace-page registrations-mgmt-page" style={{ paddingBottom: '100px' }}>
      
      {/* LOCAL STYLES FOR PREMIUM LOOK */}
      <style>{`
        .registrations-mgmt-page {
          background: #0d1117;
          color: #f6f8fb;
        }
        .header-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-tile {
          flex: 1 1 200px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 15px;
          display: flex;
          flex-direction: column;
        }
        .stat-tile span {
          color: #91a0b3;
          font-size: 13px;
          text-transform: uppercase;
          font-weight: 700;
        }
        .stat-tile strong {
          font-size: 24px;
          margin-top: 5px;
          color: #fff;
        }
        .reg-table-container {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          overflow-x: auto;
          margin-top: 15px;
        }
        .reg-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .reg-table th, .reg-table td {
          padding: 12px 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 14px;
        }
        .reg-table th {
          background: rgba(255, 255, 255, 0.04);
          font-weight: 700;
          color: #91a0b3;
        }
        .reg-table tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge.pending { background: rgba(246, 196, 83, 0.15); color: #f6c453; border: 1px solid rgba(246, 196, 83, 0.3); }
        .status-badge.verified, .status-badge.paid { background: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); }
        .status-badge.rejected, .status-badge.failed { background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); }
        .status-badge.awaiting-payment { background: rgba(155, 89, 182, 0.15); color: #9b59b6; border: 1px solid rgba(155, 89, 182, 0.3); }
        .status-badge.payment-submitted { background: rgba(52, 152, 219, 0.15); color: #3498db; border: 1px solid rgba(52, 152, 219, 0.3); }
        
        .bulk-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #1c2128;
          border: 1px solid #7dd3fc;
          border-radius: 8px;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          z-index: 100;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5);
          width: min(700px, 90%);
        }
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }
        .modal-content {
          background: #1c2128;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 24px;
          width: min(500px, 100%);
          max-height: 90vh;
          overflow-y: auto;
        }
        .lightbox-img {
          max-width: 90vw;
          max-height: 80vh;
          object-fit: contain;
          transition: transform 0.2s;
        }
        .side-panel {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: min(480px, 100%);
          background: #141a23;
          border-left: 1px solid rgba(255,255,255,0.1);
          z-index: 150;
          box-shadow: -10px 0 30px rgba(0,0,0,0.5);
          padding: 24px;
          overflow-y: auto;
        }
        .mobile-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 44px;
        }
        @media (max-width: 768px) {
          .desktop-only { display: none; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none; }
        }
      `}</style>

      {/* Header */}
      <Link className="text-link" to={`/organizer/tournaments/${tournamentId}`}>Back to tournament</Link>
      <div className="page-kicker" style={{ marginTop: '10px' }}>Registration Management</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '25px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>{tournament?.name || 'Tournament'}</h1>
          <p style={{ margin: '5px 0 0 0', color: '#91a0b3' }}>
            {summary.Verified} / {tournament?.maxTeams || 0} teams registered · Registration {tournament?.status === 'REGISTRATION_OPEN' ? 'OPEN' : 'CLOSED'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="button ghost-button" style={{ minHeight: '44px' }} type="button" onClick={handleExportWorkbook}>Export Excel</button>
          <button className="button ghost-button" style={{ minHeight: '44px' }} type="button" onClick={handleExportCsv}>Export CSV</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="header-stats">
        <div className="stat-tile">
          <span>Pending Applications</span>
          <strong>{summary.Pending}</strong>
        </div>
        <div className="stat-tile">
          <span>Verified Teams</span>
          <strong>{summary.Verified} / {tournament?.maxTeams || 0}</strong>
        </div>
        <div className="stat-tile">
          <span>Rejected Applications</span>
          <strong>{summary.Rejected}</strong>
        </div>
        {tournament?.entryType === 'PAID' && (
          <>
            <div className="stat-tile" style={{ borderColor: 'rgba(46, 204, 113, 0.2)' }}>
              <span style={{ color: '#2ecc71' }}>Collected (PAID)</span>
              <strong>₹{paymentSummary.collected}</strong>
            </div>
            <div className="stat-tile" style={{ borderColor: 'rgba(52, 152, 219, 0.2)' }}>
              <span style={{ color: '#3498db' }}>Pending Review</span>
              <strong>₹{paymentSummary.pending}</strong>
            </div>
          </>
        )}
      </div>

      {/* Error & Notice Panels */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '20px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '20px' }}>{state.notice}</div>}

      {/* Filters Toolbar */}
      <div className="registration-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px' }}>
          {[
            { label: 'All', val: '' },
            { label: `Pending (${summary.Pending})`, val: 'PENDING' },
            { label: `Verified (${summary.Verified})`, val: 'VERIFIED' },
            { label: `Rejected (${summary.Rejected})`, val: 'REJECTED' }
          ].map(t => (
            <button
              key={t.label}
              className={filters.status === t.val ? 'button primary-button' : 'button secondary-button'}
              style={{ minHeight: '38px', padding: '0 12px', fontSize: '13px' }}
              type="button"
              onClick={() => setFilters(f => ({ ...f, status: t.val, page: 1 }))}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters and Search Inputs */}
        <div style={{ display: 'flex', gap: '10px', flex: '1 1 300px', flexWrap: 'wrap' }}>
          <input
            style={{ flex: '1 1 180px', minHeight: '40px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '0 10px', color: '#fff' }}
            aria-label="Search registrations"
            placeholder="Search team, reference, leader..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
          />

          {tournament?.entryType === 'PAID' && (
            <select
              style={{ minHeight: '40px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '0 8px', color: '#fff' }}
              aria-label="Payment status filter"
              value={filters.paymentStatus}
              onChange={(e) => setFilters(f => ({ ...f, paymentStatus: e.target.value, page: 1 }))}
            >
              <option value="">All Payment States</option>
              <option value="AWAITING_PAYMENT">Awaiting Payment</option>
              <option value="PAYMENT_SUBMITTED">Payment Submitted</option>
              <option value="VERIFIED">Verified / Captured</option>
              <option value="REJECTED">Failed / Rejected</option>
            </select>
          )}

          <select
            style={{ minHeight: '40px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '0 8px', color: '#fff' }}
            aria-label="Sort order"
            value={filters.sort}
            onChange={(e) => setFilters(f => ({ ...f, sort: e.target.value, page: 1 }))}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Main List Area */}
      <div className="registration-list-panel" style={{ marginTop: '20px' }}>
        {state.loading && <p className="status-panel">Loading registrations...</p>}
        
        {!state.loading && registrations.length === 0 && (
          <p className="empty-state">No matching registrations found for this tournament.</p>
        )}

        {/* Desktop Table View */}
        {!state.loading && registrations.length > 0 && (
          <div className="reg-table-container desktop-only">
            <table className="reg-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={checkedIds.length === registrations.length && registrations.length > 0} 
                      onChange={handleCheckAll}
                      disabled={isCompleted}
                    />
                  </th>
                  <th>Team Name</th>
                  <th>Team Leader</th>
                  <th>Members Count</th>
                  <th>Registration</th>
                  <th>Payment Status</th>
                  <th>Expected Amount</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => {
                  const isChecked = checkedIds.includes(reg.id);
                  return (
                    <tr key={reg.id} style={{ background: isChecked ? 'rgba(125,211,252,0.03)' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleCheckRow(reg.id)}
                          disabled={isCompleted}
                        />
                      </td>
                      <td>
                        <button 
                          className="text-button" 
                          style={{ fontWeight: 'bold', padding: 0, border: 'none', background: 'none', color: '#7dd3fc', cursor: 'pointer' }}
                          onClick={() => setSelectedReg(reg)}
                        >
                          {reg.teamName}
                        </button>
                      </td>
                      <td>{reg.members[0]?.name || 'N/A'}</td>
                      <td>{reg.members.length} members</td>
                      <td>
                        <span className={`status-badge ${reg.status.toLowerCase()}`}>{reg.status}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${reg.paymentStatus.toLowerCase().replaceAll('_', '-')}`}>
                          {reg.paymentStatus.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td>₹{reg.paymentAmount || (reg.entryType === 'PAID' ? tournament?.entryFee : 0)}</td>
                      <td>{new Date(reg.submittedAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="text-button" 
                          style={{ color: '#7dd3fc', marginRight: '10px' }}
                          onClick={() => setSelectedReg(reg)}
                        >
                          View
                        </button>
                        {reg.status === 'PENDING' && !isCompleted && (
                          <>
                            <button 
                              className="text-button" 
                              style={{ color: '#2ecc71', marginRight: '10px', fontWeight: 'bold' }}
                              onClick={() => handleSingleVerify(reg)}
                            >
                              Verify
                            </button>
                            <button 
                              className="text-button danger-text" 
                              style={{ color: '#e74c3c', fontWeight: 'bold' }}
                              onClick={() => handleSingleRejectPrompt(reg)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile List Cards */}
        {!state.loading && registrations.map((reg) => (
          <div className="mobile-card mobile-only" key={reg.id}>
            <div>
              <strong style={{ fontSize: '16px', display: 'block' }}>{reg.teamName}</strong>
              <span style={{ fontSize: '13px', color: '#91a0b3' }}>
                {reg.members.length} members · ₹{reg.paymentAmount || (reg.entryType === 'PAID' ? tournament?.entryFee : 0)}
              </span>
              <div style={{ marginTop: '8px', display: 'flex', gap: '5px' }}>
                <span className={`status-badge ${reg.status.toLowerCase()}`}>{reg.status}</span>
                <span className={`status-badge ${reg.paymentStatus.toLowerCase().replaceAll('_', '-')}`}>
                  {reg.paymentStatus.replaceAll('_', ' ')}
                </span>
              </div>
            </div>
            <div>
              <button 
                className="button secondary-button" 
                style={{ minHeight: '44px', padding: '0 15px' }}
                onClick={() => setSelectedReg(reg)}
              >
                Review
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Actions */}
      {!state.loading && pagination.totalPages > 1 && (
        <div className="pagination-actions" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
          <button 
            className="button secondary-button" 
            style={{ minHeight: '44px' }}
            disabled={pagination.page <= 1} 
            onClick={() => setFilters(f => ({ ...f, page: pagination.page - 1 }))}
          >
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button 
            className="button secondary-button" 
            style={{ minHeight: '44px' }}
            disabled={pagination.page >= pagination.totalPages} 
            onClick={() => setFilters(f => ({ ...f, page: pagination.page + 1 }))}
          >
            Next
          </button>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {checkedIds.length > 0 && !isCompleted && (
        <div className="bulk-bar">
          <span style={{ fontWeight: 'bold' }}>{checkedIds.length} selected</span>
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button className="button primary-button" style={{ minHeight: '44px' }} onClick={handleBulkVerifyClick}>
              Verify Eligible
            </button>
            <button className="button secondary-button" style={{ minHeight: '44px', color: '#ff6b6b' }} onClick={handleBulkRejectClick}>
              Reject Selected
            </button>
            <button className="button ghost-button" style={{ minHeight: '44px' }} onClick={() => setCheckedIds([])}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Registration Details Sidebar */}
      {selectedReg && (
        <div className="side-panel" role="dialog" aria-modal="true">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Registration details</h2>
            <button className="button ghost-button" style={{ minHeight: '38px', padding: '0 10px' }} onClick={() => setSelectedReg(null)}>Close</button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '13px', color: '#91a0b3' }}>Registration ID: {selectedReg.id}</span>
            <h3 style={{ margin: '5px 0 0 0', color: '#fff' }}>{selectedReg.teamName}</h3>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <span className={`status-badge ${selectedReg.status.toLowerCase()}`}>{selectedReg.status}</span>
              <span className={`status-badge ${selectedReg.paymentStatus.toLowerCase().replaceAll('_', '-')}`}>
                {selectedReg.paymentStatus.replaceAll('_', ' ')}
              </span>
            </div>
            {selectedReg.rejectionReason && (
              <p style={{ marginTop: '10px', color: '#ff6b6b', background: 'rgba(231,76,60,0.1)', padding: '8px', borderRadius: '4px', fontSize: '14px' }}>
                <strong>Rejection Reason:</strong> {selectedReg.rejectionReason}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', color: '#91a0b3' }}>Team members ({selectedReg.members.length})</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {selectedReg.members.map((member, i) => (
                <li key={member.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <strong>{member.name}</strong> {i === 0 && <span style={{ fontSize: '11px', color: '#f6c453', background: 'rgba(246,196,83,0.1)', padding: '2px 4px', borderRadius: '3px', marginLeft: '5px' }}>Leader</span>}
                  <div style={{ fontSize: '13px', color: '#91a0b3', marginTop: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    <span>UID: {member.uniquePlayerId}</span>
                    <span>Email: {member.email || 'N/A'}</span>
                    <span>IGN: {member.ign || 'N/A'}</span>
                    <span>Game ID: {member.uid || 'N/A'}</span>
                    <span>Mobile: {member.mobile || 'N/A'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', color: '#91a0b3' }}>Payment evidence</h4>
            <p><strong>Method:</strong> {selectedReg.paymentProvider || 'FREE'}</p>
            <p><strong>Amount:</strong> ₹{selectedReg.paymentAmount || 0}</p>
            {selectedReg.entryType === 'PAID' && (
              <>
                <p><strong>Transaction ID / Ref:</strong> {selectedReg.transactionId || 'Not provided'}</p>
                {selectedReg.paymentScreenshotPath ? (
                  <div style={{ marginTop: '10px' }}>
                    <span style={{ display: 'block', fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>Receipt Screenshot:</span>
                    <button 
                      onClick={() => handleOpenLightbox(selectedReg.id)}
                      style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer', display: 'block' }}
                    >
                      <img 
                        src={`${import.meta.env.VITE_API_BASE_URL || '/api'}/registrations/${selectedReg.id}/payment-evidence`}
                        alt="Evidence receipt"
                        style={{ maxWidth: '100%', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', maxHeight: '150px' }}
                      />
                    </button>
                    <span style={{ fontSize: '12px', color: '#91a0b3', marginTop: '5px', display: 'block' }}>Click image to zoom securely</span>
                  </div>
                ) : (
                  <p style={{ color: '#ff6b6b' }}>No payment receipt uploaded.</p>
                )}
              </>
            )}
          </div>

          {selectedReg.status === 'PENDING' && !isCompleted && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button 
                className="button primary-button" 
                style={{ flex: 1, minHeight: '44px' }}
                onClick={() => handleSingleVerify(selectedReg)}
              >
                Verify Registration
              </button>
              <button 
                className="button secondary-button" 
                style={{ flex: 1, color: '#ff6b6b', minHeight: '44px' }}
                onClick={() => handleSingleRejectPrompt(selectedReg)}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div className="modal-overlay" onClick={handleCloseLightbox}>
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img 
              className="lightbox-img" 
              src={lightboxUrl} 
              alt="Payment evidence zoomed" 
              style={{ transform: `scale(${lightboxZoom})` }}
            />
            <div style={{ position: 'absolute', bottom: '-45px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(0,0,0,0.8)', padding: '5px 15px', borderRadius: '20px' }}>
              <button className="button ghost-button" style={{ minHeight: '32px', padding: '0 10px', border: 'none' }} onClick={() => setLightboxZoom(z => Math.max(0.5, z - 0.25))}>Zoom -</button>
              <span style={{ fontSize: '13px' }}>{Math.round(lightboxZoom * 100)}%</span>
              <button className="button ghost-button" style={{ minHeight: '32px', padding: '0 10px', border: 'none' }} onClick={() => setLightboxZoom(z => Math.min(3, z + 0.25))}>Zoom +</button>
              <a 
                href={lightboxUrl} 
                download="payment-proof.png" 
                className="button primary-button" 
                style={{ minHeight: '32px', padding: '0 12px', textDecoration: 'none', fontSize: '13px' }}
              >
                Download
              </a>
              <button className="button ghost-button" style={{ minHeight: '32px', padding: '0 10px', border: 'none' }} onClick={handleCloseLightbox}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reasons Dialog */}
      {rejectionModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ margin: '0 0 15px 0' }}>Reject Application</h3>
            <p>Please select a reason for rejecting {rejectionModal.regIds.length === 1 ? 'this registration' : `${rejectionModal.regIds.length} selected registrations`}:</p>
            
            <label htmlFor="rejection-reason" style={{ display: 'block', margin: '15px 0 5px 0', fontWeight: 'bold' }}>Rejection Reason</label>
            <select
              id="rejection-reason"
              value={rejectionModal.reasonType}
              onChange={(e) => setRejectionModal(m => ({ ...m, reasonType: e.target.value }))}
              style={{ width: '100%', minHeight: '44px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '0 10px', color: '#fff', marginBottom: '15px' }}
            >
              <option value="Invalid team members">Invalid team members</option>
              <option value="Invalid payment proof">Invalid payment proof</option>
              <option value="Incorrect amount">Incorrect amount</option>
              <option value="Duplicate transaction">Duplicate transaction</option>
              <option value="Team size mismatch">Team size mismatch</option>
              <option value="Other">Other (Specify below)</option>
            </select>

            {rejectionModal.reasonType === 'Other' && (
              <>
                <label htmlFor="custom-reason" style={{ display: 'block', margin: '0 0 5px 0', fontWeight: 'bold' }}>Custom Reason</label>
                <textarea
                  id="custom-reason"
                  rows="3"
                  value={rejectionModal.customReason}
                  onChange={(e) => setRejectionModal(m => ({ ...m, customReason: e.target.value }))}
                  style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '8px 10px', color: '#fff', marginBottom: '15px' }}
                  placeholder="Enter rejection reason details..."
                />
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                className="button primary-button" 
                style={{ flex: 1, background: '#e74c3c', color: '#fff', minHeight: '44px' }} 
                onClick={handleConfirmRejection}
              >
                Reject Application
              </button>
              <button 
                className="button secondary-button" 
                style={{ flex: 1, minHeight: '44px' }} 
                onClick={() => setRejectionModal(m => ({ ...m, isOpen: false }))}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Precheck Confirmation Dialog */}
      {precheckModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 'min(580px, 100%)' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Bulk Verification Preview</h3>
            
            <div style={{ maxHeight: '250px', overflowY: 'auto', background: '#0d1117', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '15px' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {precheckModal.prechecks.map((pre) => {
                  const reg = registrations.find(r => r.id === pre.id);
                  return (
                    <li key={pre.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                      <span>{reg?.teamName || `Reg #${pre.id}`}</span>
                      <span style={{ 
                        color: pre.check === 'Eligible' ? '#2ecc71' : pre.check === 'Needs Review' ? '#f6c453' : '#e74c3c',
                        fontWeight: 'bold' 
                      }}>
                        {pre.check} ({pre.reason})
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p>
              You are about to verify <strong>{precheckModal.eligibleCount}</strong> eligible registrations.
              {precheckModal.prechecks.some(c => c.check !== 'Eligible') && (
                <span style={{ display: 'block', color: '#f6c453', fontSize: '13px', marginTop: '5px' }}>
                  Warning: Some selected registrations are ineligible and will be skipped.
                </span>
              )}
            </p>

            {tournament?.entryType === 'PAID' && (
              <p>Total Entry Value to Confirm: <strong>₹{precheckModal.totalValue}</strong></p>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                className="button primary-button" 
                style={{ flex: 1, minHeight: '44px' }} 
                onClick={handleConfirmBulkVerify}
              >
                Verify {precheckModal.eligibleCount} teams
              </button>
              <button 
                className="button secondary-button" 
                style={{ flex: 1, minHeight: '44px' }} 
                onClick={() => setPrecheckModal(m => ({ ...m, isOpen: false }))}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
