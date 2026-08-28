import { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../../services/apiClient.js';
import * as staffApi from '../../services/staffApi.js';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import { getOrganizerNavigation } from '../../config/workspaceNavigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';

const PERMISSION_CATEGORIES = [
  {
    category: 'Tournament & Settings',
    items: [
      { key: 'VIEW_TOURNAMENT', label: 'View Tournament' },
      { key: 'EDIT_TOURNAMENT', label: 'Edit Tournament Details' },
      { key: 'MANAGE_SETTINGS', label: 'Manage Tournament Settings' },
    ],
  },
  {
    category: 'Registrations & Payments',
    items: [
      { key: 'VIEW_REGISTRATIONS', label: 'View Registrations' },
      { key: 'VERIFY_REGISTRATIONS', label: 'Verify Registrations' },
      { key: 'REJECT_REGISTRATIONS', label: 'Reject Registrations' },
      { key: 'VIEW_PAYMENT_DETAILS', label: 'View Payment Proof & Details' },
      { key: 'EXPORT_REGISTRATIONS', label: 'Export Registrations (CSV/Excel)' },
    ],
  },
  {
    category: 'Rounds & Groups',
    items: [
      { key: 'VIEW_ROUNDS', label: 'View Rounds' },
      { key: 'CREATE_ROUND', label: 'Create Round' },
      { key: 'EDIT_ROUND', label: 'Edit Round' },
      { key: 'COMPLETE_ROUND', label: 'Complete Round' },
      { key: 'VIEW_GROUPS', label: 'View Groups' },
      { key: 'CREATE_GROUP', label: 'Create Group' },
      { key: 'EDIT_GROUP', label: 'Edit Group' },
      { key: 'DELETE_GROUP', label: 'Delete Group' },
      { key: 'ASSIGN_TEAMS', label: 'Assign & Move Teams' },
      { key: 'REMOVE_TEAMS', label: 'Remove Teams' },
    ],
  },
  {
    category: 'Matches & Rooms',
    items: [
      { key: 'VIEW_MATCHES', label: 'View Matches' },
      { key: 'CREATE_MATCH', label: 'Create Match' },
      { key: 'EDIT_MATCH', label: 'Edit Match' },
      { key: 'DELETE_MATCH', label: 'Delete Match' },
      { key: 'START_MATCH', label: 'Start Match (Set LIVE)' },
      { key: 'COMPLETE_MATCH', label: 'Complete Match' },
      { key: 'VIEW_ROOM', label: 'View Room ID & Password' },
      { key: 'EDIT_ROOM', label: 'Edit Room Credentials' },
    ],
  },
  {
    category: 'Scoring & Results',
    items: [
      { key: 'VIEW_RESULTS', label: 'View Results' },
      { key: 'ENTER_RESULTS', label: 'Enter Match Scores' },
      { key: 'EDIT_RESULTS', label: 'Edit Recorded Scores' },
      { key: 'VIEW_LEADERBOARD', label: 'View Leaderboard' },
      { key: 'MANAGE_LEADERBOARD', label: 'Recalculate Leaderboard' },
    ],
  },
  {
    category: 'Qualifications & Communication',
    items: [
      { key: 'VIEW_QUALIFICATIONS', label: 'View Qualifications' },
      { key: 'MANAGE_QUALIFICATIONS', label: 'Select & Finalize Qualifications' },
      { key: 'VIEW_ANNOUNCEMENTS', label: 'View Announcements' },
      { key: 'CREATE_ANNOUNCEMENTS', label: 'Post Announcements' },
      { key: 'MANAGE_GROUP_CHAT', label: 'Participate & Moderate Group Chat' },
    ],
  },
];

const PRESETS = {
  SCOREKEEPER: {
    label: 'Scorekeeper',
    description: 'Enter scores, view groups/matches, recalculate leaderboard.',
    permissions: [
      'VIEW_TOURNAMENT',
      'VIEW_ROUNDS',
      'VIEW_GROUPS',
      'VIEW_MATCHES',
      'VIEW_ROOM',
      'VIEW_RESULTS',
      'ENTER_RESULTS',
      'EDIT_RESULTS',
      'VIEW_LEADERBOARD',
      'MANAGE_LEADERBOARD',
    ],
  },
  REGISTRAR: {
    label: 'Registration Desk',
    description: 'Review payments, verify/reject teams, export spreadsheets.',
    permissions: [
      'VIEW_TOURNAMENT',
      'VIEW_REGISTRATIONS',
      'VERIFY_REGISTRATIONS',
      'REJECT_REGISTRATIONS',
      'VIEW_PAYMENT_DETAILS',
      'EXPORT_REGISTRATIONS',
    ],
  },
  MATCH_COORDINATOR: {
    label: 'Match Coordinator',
    description: 'Manage room credentials, start/complete matches, assign teams.',
    permissions: [
      'VIEW_TOURNAMENT',
      'VIEW_ROUNDS',
      'VIEW_GROUPS',
      'ASSIGN_TEAMS',
      'VIEW_MATCHES',
      'CREATE_MATCH',
      'EDIT_MATCH',
      'START_MATCH',
      'COMPLETE_MATCH',
      'VIEW_ROOM',
      'EDIT_ROOM',
      'VIEW_ANNOUNCEMENTS',
      'CREATE_ANNOUNCEMENTS',
      'MANAGE_GROUP_CHAT',
    ],
  },
  FULL_SCOUT: {
    label: 'Full Scout Admin',
    description: 'Full operational control (all permissions except Owner-only actions).',
    permissions: PERMISSION_CATEGORIES.flatMap((c) => c.items.map((i) => i.key)),
  },
};

export function OrganizerScoutsPage() {
  const { identity } = useAuth();
  const { socket } = useSocket();
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Modals & Drawers
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Assign Wizard State
  const [assignStep, setAssignStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [allGroupsScope, setAllGroupsScope] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Fetch initial tournaments list
  useEffect(() => {
    async function loadTournaments() {
      try {
        const res = await apiClient.get('/tournaments?scope=mine');
        const myTourneys = res.data?.tournaments || res.data || [];
        setTournaments(myTourneys);
        if (myTourneys.length > 0) {
          setSelectedTournamentId(String(myTourneys[0].id));
        }
      } catch (err) {
        setError('Failed to load tournaments list');
      } finally {
        setLoading(false);
      }
    }
    loadTournaments();
  }, [identity?.id]);

  // Fetch Staff and Groups for selected tournament
  const loadStaffData = async () => {
    if (!selectedTournamentId) return;
    try {
      setLoading(true);
      setError(null);
      const [staffRes, groupsRes] = await Promise.all([
        staffApi.fetchTournamentStaff(selectedTournamentId),
        apiClient.get(`/tournaments/${selectedTournamentId}/groups`).catch(() => ({ data: [] })),
      ]);
      setStaffList(staffRes.staff || staffRes || []);
      setAvailableGroups(Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data?.groups || []);
    } catch (err) {
      setError(err.message || 'Failed to load tournament scouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, [selectedTournamentId]);

  // Socket realtime updates
  useEffect(() => {
    if (!socket || !selectedTournamentId) return;
    const handleStaffUpdate = () => {
      loadStaffData();
    };
    socket.on('staff_access_updated', handleStaffUpdate);
    socket.on('staff_access_revoked', handleStaffUpdate);
    return () => {
      socket.off('staff_access_updated', handleStaffUpdate);
      socket.off('staff_access_revoked', handleStaffUpdate);
    };
  }, [socket, selectedTournamentId]);

  // Search scout candidates
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await staffApi.searchScouts(searchQuery.trim(), selectedTournamentId);
        setSearchResults(res.results || res || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedTournamentId]);

  // Filtered staff list
  const activeStaff = useMemo(() => staffList.filter((s) => s.status === 'ACTIVE'), [staffList]);
  const revokedStaff = useMemo(() => staffList.filter((s) => s.status === 'REVOKED'), [staffList]);

  // Quick Preset Selector
  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      setSelectedPermissions(new Set(preset.permissions));
    }
  };

  const togglePermission = (key) => {
    const next = new Set(selectedPermissions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedPermissions(next);
  };

  const toggleGroup = (groupId) => {
    const next = new Set(selectedGroupIds);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setSelectedGroupIds(next);
  };

  // Open Assign Wizard
  const handleOpenAssignModal = () => {
    setAssignStep(1);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedPermissions(new Set(PRESETS.SCOREKEEPER.permissions));
    setAllGroupsScope(true);
    setSelectedGroupIds(new Set());
    setError(null);
    setSuccessMessage(null);
    setShowAssignModal(true);
  };

  // Submit Scout Assignment
  const handleAssignScout = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      setError(null);
      await staffApi.assignTournamentStaff(selectedTournamentId, {
        userId: selectedUser.id,
        permissions: Array.from(selectedPermissions),
        allGroups: allGroupsScope,
        groupIds: Array.from(selectedGroupIds),
      });
      setSuccessMessage(`Successfully assigned ${selectedUser.name} as Scout!`);
      setShowAssignModal(false);
      await loadStaffData();
    } catch (err) {
      setError(err.message || 'Failed to assign scout');
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (staff) => {
    setSelectedStaff(staff);
    setSelectedPermissions(new Set(staff.permissions || []));
    setAllGroupsScope(Boolean(staff.allGroups ?? staff.all_groups));
    setSelectedGroupIds(new Set((staff.assignedGroupIds || []).map(Number)));
    setError(null);
    setShowEditModal(true);
  };

  // Submit Edit Permissions
  const handleSaveEdit = async () => {
    if (!selectedStaff) return;
    try {
      setSaving(true);
      setError(null);
      await staffApi.updateTournamentStaff(selectedTournamentId, selectedStaff.id, {
        permissions: Array.from(selectedPermissions),
        allGroups: allGroupsScope,
        groupIds: Array.from(selectedGroupIds),
        status: 'ACTIVE',
      });
      setSuccessMessage(`Updated permissions for ${selectedStaff.name || selectedStaff.userName}`);
      setShowEditModal(false);
      await loadStaffData();
    } catch (err) {
      setError(err.message || 'Failed to update scout');
    } finally {
      setSaving(false);
    }
  };

  // Submit Revocation
  const handleRevokeScout = async () => {
    if (!selectedStaff) return;
    try {
      setSaving(true);
      setError(null);
      await staffApi.revokeTournamentStaff(selectedTournamentId, selectedStaff.id);
      setSuccessMessage(`Access revoked for ${selectedStaff.name || selectedStaff.userName}`);
      setShowRevokeModal(false);
      await loadStaffData();
    } catch (err) {
      setError(err.message || 'Failed to revoke scout');
    } finally {
      setSaving(false);
    }
  };

  // Open Audit History Drawer
  const handleOpenAuditDrawer = async () => {
    setShowAuditDrawer(true);
    setAuditLoading(true);
    try {
      const res = await staffApi.fetchStaffAuditLogs(selectedTournamentId, { limit: 50 });
      setAuditLogs(res.logs || res || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const navItems = getOrganizerNavigation({ tournamentId: selectedTournamentId });

  return (
    <WorkspaceShell label="Organizer Scouts" items={navItems}>
      <div className="scouts-container">
        {/* Header Bar */}
        <header className="scouts-header">
          <div className="scouts-header-content">
            <div className="scouts-badge-wrapper">
              <span className="scouts-badge">
                <span className="badge-pulse-dot" />
                Production Staff Management
              </span>
            </div>
            <h1 className="scouts-title">Tournament Scouts & Staff</h1>
            <p className="scouts-subtitle">
              Delegate operational control to trusted EVOQ players with modular, granular permissions and scoped group assignments.
            </p>
          </div>

          <div className="scouts-header-actions">
            <button
              type="button"
              className="btn-scout-secondary audit-history-btn"
              onClick={handleOpenAuditDrawer}
              title="View Staff Activity Audit Logs"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Activity Audit Log
            </button>
            <button
              type="button"
              className="btn-scout-primary assign-scout-btn"
              onClick={handleOpenAssignModal}
              disabled={!selectedTournamentId}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Assign New Scout
            </button>
          </div>
        </header>

        {/* Notifications / Alerts */}
        {error && (
          <div className="scouts-alert alert-error" role="alert">
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}
        {successMessage && (
          <div className="scouts-alert alert-success" role="alert">
            <span>{successMessage}</span>
            <button type="button" className="alert-close" onClick={() => setSuccessMessage(null)}>×</button>
          </div>
        )}

        {/* Tournament Selector Bar */}
        <section className="scouts-selector-card">
          <div className="selector-left">
            <label htmlFor="tournament-select" className="selector-label">
              Active Tournament:
            </label>
            <div className="tournament-dropdown-wrapper">
              <select
                id="tournament-select"
                className="tournament-dropdown"
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.game || 'Free Fire'}) · {t.status}
                  </option>
                ))}
              </select>
              <span className="dropdown-arrow">▼</span>
            </div>
          </div>

          <div className="scouts-summary-stats">
            <span className="stat-pill active">
              <span className="stat-dot" />
              <strong>{activeStaff.length}</strong> Active Scouts
            </span>
            <span className="stat-pill revoked">
              <span className="stat-dot" />
              <strong>{revokedStaff.length}</strong> Revoked
            </span>
          </div>
        </section>

        {/* Tabs: Active Scouts vs Revoked History */}
        <div className="scouts-tabs">
          <button
            type="button"
            className={`tab-btn${activeTab === 'ACTIVE' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('ACTIVE')}
          >
            Active Scouts ({activeStaff.length})
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === 'REVOKED' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('REVOKED')}
          >
            Revocation History ({revokedStaff.length})
          </button>
        </div>

        {/* Scouts List Table */}
        <section className="scouts-table-section">
          {loading ? (
            <div className="scouts-loading-state">
              <div className="spinner"></div>
              <p>Loading tournament staff...</p>
            </div>
          ) : (activeTab === 'ACTIVE' ? activeStaff : revokedStaff).length === 0 ? (
            <div className="scouts-empty-state">
              <div className="empty-icon-shield">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3>No {activeTab.toLowerCase()} scouts for this tournament</h3>
              <p>
                {activeTab === 'ACTIVE'
                  ? 'Assign trusted EVOQ players to handle live scorekeeping, group operations, team verification, or match coordination.'
                  : 'No revoked scout records found for this tournament.'}
              </p>
              {activeTab === 'ACTIVE' && (
                <button type="button" className="btn-scout-primary" onClick={handleOpenAssignModal}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Assign First Scout
                </button>
              )}
            </div>
          ) : (
            <div className="scouts-table-wrapper">
              <table className="scouts-table">
                <thead>
                  <tr>
                    <th>Scout / EVOQ Player</th>
                    <th>Role & Identity</th>
                    <th>Permissions Scope</th>
                    <th>Group Scope</th>
                    <th>Assigned At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'ACTIVE' ? activeStaff : revokedStaff).map((staff) => {
                    const isAll = Boolean(staff.allGroups ?? staff.all_groups);
                    const perms = staff.permissions || [];
                    const assignedGroups = staff.assignedGroupIds || [];

                    return (
                      <tr key={staff.id} className={`scout-row ${staff.status.toLowerCase()}`}>
                        <td>
                          <div className="scout-user-cell">
                            <div className="scout-avatar">
                              {(staff.name || staff.userName || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div className="scout-user-meta">
                              <span className="scout-user-name">{staff.name || staff.userName}</span>
                              <span className="scout-evoq-id">
                                {staff.uniquePlayerId || staff.unique_player_id || `EVQ-${staff.userId || staff.user_id}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="scout-identity-cell">
                            <span className="badge-scout">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                              </svg>
                              SCOUT
                            </span>
                            {staff.inGameName && (
                              <span className="scout-ign" title="In-Game Name">
                                IGN: {staff.inGameName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="scout-perms-cell">
                            <span className="perms-count-badge">
                              {perms.length} Permissions
                            </span>
                            <div className="perms-preview-chips">
                              {perms.slice(0, 3).map((p) => (
                                <span key={p} className="perm-chip">
                                  {p.replaceAll('_', ' ')}
                                </span>
                              ))}
                              {perms.length > 3 && (
                                <span className="perm-more-chip">+{perms.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="scout-group-scope-cell">
                            {isAll ? (
                              <span className="group-scope-all">ALL GROUPS</span>
                            ) : (
                              <span className="group-scope-specific">
                                {assignedGroups.length} Specific Groups
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="scout-timestamp">
                            {staff.createdAt || staff.created_at
                              ? new Date(staff.createdAt || staff.created_at).toLocaleDateString()
                              : 'Recent'}
                          </span>
                        </td>
                        <td>
                          <div className="scout-actions-cell">
                            {staff.status === 'ACTIVE' ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-action edit"
                                  onClick={() => handleOpenEditModal(staff)}
                                  title="Edit Permissions & Groups"
                                >
                                  Edit Access
                                </button>
                                <button
                                  type="button"
                                  className="btn-action revoke"
                                  onClick={() => {
                                    setSelectedStaff(staff);
                                    setShowRevokeModal(true);
                                  }}
                                  title="Revoke Scout Access"
                                >
                                  Revoke
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn-action restore"
                                onClick={() => handleOpenEditModal(staff)}
                                title="Reactivate Scout"
                              >
                                Re-activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* MODAL: Assign Scout Multi-Step Wizard */}
        {showAssignModal && (
          <div className="modal-backdrop">
            <div className="modal-card assign-scout-modal" role="dialog" aria-modal="true">
              <header className="modal-header">
                <div>
                  <span className="modal-step-badge">STEP {assignStep} OF 3</span>
                  <h2>
                    {assignStep === 1 && 'Search & Select Scout'}
                    {assignStep === 2 && 'Configure Permissions & Presets'}
                    {assignStep === 3 && 'Define Group Scope & Confirm'}
                  </h2>
                </div>
                <button type="button" className="modal-close-btn" onClick={() => setShowAssignModal(false)}>
                  ×
                </button>
              </header>

              <div className="modal-body">
                {/* STEP 1: Search EVOQ ID */}
                {assignStep === 1 && (
                  <div className="wizard-step step-1">
                    <label className="input-label" htmlFor="scout-search-input">
                      Search User by EVOQ ID, Name, or IGN:
                    </label>
                    <div className="search-input-wrapper">
                      <input
                        id="scout-search-input"
                        type="text"
                        className="form-control-scout"
                        placeholder="Type EVOQ ID (e.g. EVQ-1024) or player name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                      {searching && <span className="search-spinner" />}
                    </div>

                    <div className="search-results-list">
                      {searchResults.length === 0 ? (
                        <p className="no-search-results">
                          {searchQuery.trim().length >= 2
                            ? 'No EVOQ users found matching query.'
                            : 'Type at least 2 characters to search active EVOQ players.'}
                        </p>
                      ) : (
                        searchResults.map((user) => {
                          const isSelected = selectedUser?.id === user.id;
                          return (
                            <button
                              key={user.id}
                              type="button"
                              className={`search-result-item${isSelected ? ' is-selected' : ''}`}
                              onClick={() => setSelectedUser(user)}
                            >
                              <div className="result-avatar">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="result-info">
                                <strong>{user.name}</strong>
                                <span className="result-evoq-id">{user.uniquePlayerId}</span>
                                {user.inGameName && (
                                  <span className="result-ign">IGN: {user.inGameName}</span>
                                )}
                              </div>
                              {isSelected && <span className="result-check">✓ Selected</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2: Configure Permissions */}
                {assignStep === 2 && (
                  <div className="wizard-step step-2">
                    <div className="selected-candidate-bar">
                      <span>Assigning: <strong>{selectedUser?.name}</strong> ({selectedUser?.uniquePlayerId})</span>
                    </div>

                    <div className="presets-bar">
                      <span className="presets-title">Quick Presets:</span>
                      <div className="preset-buttons">
                        {Object.entries(PRESETS).map(([k, p]) => (
                          <button
                            key={k}
                            type="button"
                            className="preset-btn"
                            onClick={() => applyPreset(k)}
                            title={p.description}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="permissions-grid">
                      {PERMISSION_CATEGORIES.map((cat) => (
                        <div key={cat.category} className="permission-group-card">
                          <h4>{cat.category}</h4>
                          <div className="permission-items">
                            {cat.items.map((perm) => (
                              <label key={perm.key} className="perm-checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.has(perm.key)}
                                  onChange={() => togglePermission(perm.key)}
                                />
                                <span>{perm.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 3: Scope Selection & Confirmation */}
                {assignStep === 3 && (
                  <div className="wizard-step step-3">
                    <div className="scope-selection-card">
                      <h3>Scout Group Access Scope</h3>
                      <p className="scope-desc">
                        Control whether this Scout has authority over all competition groups or only specific assigned groups.
                      </p>

                      <div className="scope-radios">
                        <label className="scope-radio-row">
                          <input
                            type="radio"
                            name="groupScope"
                            checked={allGroupsScope}
                            onChange={() => setAllGroupsScope(true)}
                          />
                          <div>
                            <strong>All Groups (Global Tournament Scope)</strong>
                            <p>Scout can view, score, and manage matches across all groups in this tournament.</p>
                          </div>
                        </label>

                        <label className="scope-radio-row">
                          <input
                            type="radio"
                            name="groupScope"
                            checked={!allGroupsScope}
                            onChange={() => setAllGroupsScope(false)}
                          />
                          <div>
                            <strong>Specific Group Assignments</strong>
                            <p>Restrict this Scout to specific groups (e.g. Group A, Group B only).</p>
                          </div>
                        </label>
                      </div>

                      {!allGroupsScope && (
                        <div className="specific-groups-box">
                          <h4>Select Assigned Groups:</h4>
                          {availableGroups.length === 0 ? (
                            <p className="no-groups-note">No groups generated yet in this tournament. (Scout can be assigned once groups are created).</p>
                          ) : (
                            <div className="groups-checklist">
                              {availableGroups.map((grp) => (
                                <label key={grp.id} className="group-check-row">
                                  <input
                                    type="checkbox"
                                    checked={selectedGroupIds.has(grp.id)}
                                    onChange={() => toggleGroup(grp.id)}
                                  />
                                  <span>{grp.name} ({grp.teams?.length || 0} teams)</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="assign-summary-box">
                      <h4>Assignment Summary</h4>
                      <ul>
                        <li><strong>Scout:</strong> {selectedUser?.name} ({selectedUser?.uniquePlayerId})</li>
                        <li><strong>Permissions:</strong> {selectedPermissions.size} granted</li>
                        <li><strong>Scope:</strong> {allGroupsScope ? 'All Groups' : `${selectedGroupIds.size} specific groups`}</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <footer className="modal-footer">
                {assignStep > 1 && (
                  <button
                    type="button"
                    className="btn-scout-secondary"
                    onClick={() => setAssignStep((s) => s - 1)}
                    disabled={saving}
                  >
                    Back
                  </button>
                )}
                {assignStep < 3 ? (
                  <button
                    type="button"
                    className="btn-scout-primary"
                    disabled={!selectedUser && assignStep === 1}
                    onClick={() => setAssignStep((s) => s + 1)}
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-scout-primary"
                    disabled={saving}
                    onClick={handleAssignScout}
                  >
                    {saving ? 'Assigning...' : 'Confirm & Assign Scout'}
                  </button>
                )}
              </footer>
            </div>
          </div>
        )}

        {/* MODAL: Edit Scout Permissions & Scope */}
        {showEditModal && selectedStaff && (
          <div className="modal-backdrop">
            <div className="modal-card edit-scout-modal" role="dialog" aria-modal="true">
              <header className="modal-header">
                <div>
                  <h2>Edit Scout Access: {selectedStaff.name || selectedStaff.userName}</h2>
                  <span className="modal-sub">
                    {selectedStaff.uniquePlayerId || selectedStaff.unique_player_id}
                  </span>
                </div>
                <button type="button" className="modal-close-btn" onClick={() => setShowEditModal(false)}>
                  ×
                </button>
              </header>

              <div className="modal-body">
                <div className="presets-bar">
                  <span className="presets-title">Presets:</span>
                  <div className="preset-buttons">
                    {Object.entries(PRESETS).map(([k, p]) => (
                      <button
                        key={k}
                        type="button"
                        className="preset-btn"
                        onClick={() => applyPreset(k)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="permissions-grid">
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <div key={cat.category} className="permission-group-card">
                      <h4>{cat.category}</h4>
                      <div className="permission-items">
                        {cat.items.map((perm) => (
                          <label key={perm.key} className="perm-checkbox-row">
                            <input
                              type="checkbox"
                              checked={selectedPermissions.has(perm.key)}
                              onChange={() => togglePermission(perm.key)}
                            />
                            <span>{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="scope-selection-card edit-scope-card">
                  <h4>Group Access Scope</h4>
                  <div className="scope-radios">
                    <label className="scope-radio-row">
                      <input
                        type="radio"
                        name="editGroupScope"
                        checked={allGroupsScope}
                        onChange={() => setAllGroupsScope(true)}
                      />
                      <span>All Groups (Global)</span>
                    </label>
                    <label className="scope-radio-row">
                      <input
                        type="radio"
                        name="editGroupScope"
                        checked={!allGroupsScope}
                        onChange={() => setAllGroupsScope(false)}
                      />
                      <span>Specific Groups Only</span>
                    </label>
                  </div>

                  {!allGroupsScope && (
                    <div className="groups-checklist">
                      {availableGroups.map((grp) => (
                        <label key={grp.id} className="group-check-row">
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.has(grp.id)}
                            onChange={() => toggleGroup(grp.id)}
                          />
                          <span>{grp.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" className="btn-scout-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-scout-primary" disabled={saving} onClick={handleSaveEdit}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* MODAL: Revoke Scout Access */}
        {showRevokeModal && selectedStaff && (
          <div className="modal-backdrop">
            <div className="modal-card revoke-confirm-modal" role="dialog" aria-modal="true">
              <header className="modal-header">
                <h2>Revoke Scout Access</h2>
                <button type="button" className="modal-close-btn" onClick={() => setShowRevokeModal(false)}>
                  ×
                </button>
              </header>
              <div className="modal-body">
                <p>
                  Are you sure you want to revoke scout access for{' '}
                  <strong>{selectedStaff.name || selectedStaff.userName}</strong>?
                </p>
                <p className="revoke-warning">
                  Their access to live match scoring, registration reviews, and room credentials will be terminated immediately.
                </p>
              </div>
              <footer className="modal-footer">
                <button type="button" className="btn-scout-secondary" onClick={() => setShowRevokeModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-action revoke" disabled={saving} onClick={handleRevokeScout}>
                  {saving ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* DRAWER: Activity Audit Log */}
        {showAuditDrawer && (
          <div className="audit-drawer-backdrop" onClick={() => setShowAuditDrawer(false)}>
            <div className="audit-drawer" onClick={(e) => e.stopPropagation()}>
              <header className="drawer-header">
                <h2>Tournament Activity Audit Log</h2>
                <button type="button" className="drawer-close-btn" onClick={() => setShowAuditDrawer(false)}>
                  ×
                </button>
              </header>

              <div className="drawer-body">
                {auditLoading ? (
                  <div className="scouts-loading-state">
                    <div className="spinner"></div>
                    <p>Loading audit trail...</p>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="no-audit-logs">No logged activity yet for this tournament.</p>
                ) : (
                  <div className="audit-timeline">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="audit-timeline-item">
                        <div className="audit-badge">{log.action.replaceAll('_', ' ')}</div>
                        <div className="audit-content">
                          <div className="audit-actor">
                            <strong>{log.actor_name || log.actorName || 'User'}</strong>{' '}
                            <span className="audit-actor-id">
                              ({log.actor_unique_player_id || log.actorUniquePlayerId || `User #${log.actor_id}`})
                            </span>
                          </div>
                          <span className="audit-time">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          {log.metadata && (
                            <pre className="audit-meta-preview">
                              {typeof log.metadata === 'string'
                                ? log.metadata
                                : JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
