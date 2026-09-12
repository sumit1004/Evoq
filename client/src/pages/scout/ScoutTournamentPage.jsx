import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient.js';
import * as staffApi from '../../services/staffApi.js';
import { WorkspaceShell } from '../../components/WorkspaceShell.jsx';
import { getScoutNavigation } from '../../config/workspaceNavigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';

export function ScoutTournamentPage() {
  const { tournamentId } = useParams();
  const { identity, loading: authLoading } = useAuth();
  const { on, joinTournament, leaveTournament } = useSocket();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState('OVERVIEW');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Module Data States
  const [registrations, setRegistrations] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [groups, setGroups] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Modals
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReg, setSelectedReg] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [scoreForm, setScoreForm] = useState({ teamId: '', placement: '', kills: '', resultText: '' });
  const [roomForm, setRoomForm] = useState({ roomId: '', roomPassword: '', instructions: '' });
  const [saving, setSaving] = useState(false);

  // Load Scout Tournament Context & Capabilities
  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await staffApi.fetchScoutTournamentWorkspace(tournamentId);
      setWorkspace(res);

      const perms = new Set(res.permissions || []);

      // Pre-load relevant module data
      if (perms.has('VIEW_REGISTRATIONS')) {
        const regRes = await apiClient.get(`/tournaments/${tournamentId}/registrations`).catch(() => ({ data: [] }));
        setRegistrations(Array.isArray(regRes.data) ? regRes.data : regRes.data?.registrations || []);
      }
      if (perms.has('VIEW_ROUNDS') || perms.has('VIEW_GROUPS')) {
        const [rRes, gRes] = await Promise.all([
          apiClient.get(`/tournaments/${tournamentId}/rounds`).catch(() => ({ data: [] })),
          apiClient.get(`/tournaments/${tournamentId}/groups`).catch(() => ({ data: [] })),
        ]);
        setRounds(Array.isArray(rRes.data) ? rRes.data : rRes.data?.rounds || []);
        const grps = Array.isArray(gRes.data) ? gRes.data : gRes.data?.groups || [];
        setGroups(grps);
        if (grps.length > 0) {
          setSelectedGroup(grps[0]);
        }
      }
      if (perms.has('VIEW_ANNOUNCEMENTS')) {
        const annRes = await apiClient.get(`/tournaments/${tournamentId}/announcements`).catch(() => ({ data: [] }));
        setAnnouncements(Array.isArray(annRes.data) ? annRes.data : annRes.data?.announcements || []);
      }
    } catch (err) {
      if (err.status === 404 || err.status === 403) {
        setError('Your scout access to this tournament is revoked or does not exist.');
      } else {
        setError(err.message || 'Failed to load tournament operations');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [tournamentId]);

  // Realtime Socket listener
  useEffect(() => {
    if (!tournamentId) return;
    joinTournament?.(tournamentId);

    const handleAccessRevoked = (data) => {
      if (Number(data?.tournamentId) === Number(tournamentId)) {
        setError('Your scout access has been revoked by the organizer.');
      }
    };
    const handleAccessUpdated = (data) => {
      if (Number(data?.tournamentId) === Number(tournamentId)) {
        loadWorkspace();
      }
    };

    const offRevoked = on?.('staff_access_revoked', handleAccessRevoked);
    const offUpdated = on?.('staff_access_updated', handleAccessUpdated);

    return () => {
      leaveTournament?.(tournamentId);
      offRevoked?.();
      offUpdated?.();
    };
  }, [tournamentId, joinTournament, leaveTournament, on]);

  // Load matches when selected group changes
  useEffect(() => {
    if (!selectedGroup) return;
    async function loadGroupMatches() {
      try {
        const [mRes, lbRes, chatRes] = await Promise.all([
          apiClient.get(`/groups/${selectedGroup.id}/matches`).catch(() => ({ data: [] })),
          apiClient.get(`/groups/${selectedGroup.id}/leaderboard`).catch(() => ({ data: [] })),
          apiClient.get(`/groups/${selectedGroup.id}/chat`).catch(() => ({ data: [] })),
        ]);
        setMatches(Array.isArray(mRes.data) ? mRes.data : mRes.data?.matches || []);
        setLeaderboard(Array.isArray(lbRes.data) ? lbRes.data : lbRes.data?.leaderboard || []);
        setChatMessages(Array.isArray(chatRes.data) ? chatRes.data : chatRes.data?.messages || []);
      } catch {
        // ignore
      }
    }
    loadGroupMatches();
  }, [selectedGroup]);

  const permissionsSet = useMemo(() => new Set(workspace?.permissions || []), [workspace]);

  // Action: Verify Registration
  const handleVerifyReg = async (regId) => {
    try {
      setSaving(true);
      await apiClient.patch(`/registrations/${regId}`, { status: 'VERIFIED' });
      setSuccessMessage('Registration verified successfully!');
      const regRes = await apiClient.get(`/tournaments/${tournamentId}/registrations`);
      setRegistrations(Array.isArray(regRes.data) ? regRes.data : regRes.data?.registrations || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to verify registration');
    } finally {
      setSaving(false);
    }
  };

  // Action: Reject Registration
  const handleRejectReg = async () => {
    if (!selectedReg) return;
    try {
      setSaving(true);
      await apiClient.patch(`/registrations/${selectedReg.id}`, {
        status: 'REJECTED',
        rejectionReason: rejectReason || 'Ineligible registration',
      });
      setSuccessMessage('Registration rejected.');
      setShowRejectModal(false);
      const regRes = await apiClient.get(`/tournaments/${tournamentId}/registrations`);
      setRegistrations(Array.isArray(regRes.data) ? regRes.data : regRes.data?.registrations || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reject registration');
    } finally {
      setSaving(false);
    }
  };

  // Action: Export Registrations
  const handleExportCsv = async () => {
    try {
      const res = await apiClient.get(`/tournaments/${tournamentId}/registrations/export`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tournament-${tournamentId}-registrations.csv`;
      a.click();
    } catch (err) {
      setError('Export failed or unauthorized');
    }
  };

  // Action: Start Match
  const handleStartMatch = async (matchId) => {
    try {
      await apiClient.patch(`/matches/${matchId}`, { status: 'LIVE' });
      setSuccessMessage('Match is now LIVE!');
      const mRes = await apiClient.get(`/groups/${selectedGroup.id}/matches`);
      setMatches(mRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start match');
    }
  };

  // Action: Complete Match
  const handleCompleteMatch = async (matchId) => {
    try {
      await apiClient.post(`/matches/${matchId}/complete`);
      setSuccessMessage('Match marked as COMPLETED!');
      const mRes = await apiClient.get(`/groups/${selectedGroup.id}/matches`);
      setMatches(mRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to complete match');
    }
  };

  // Action: Save Score / Result
  const handleSaveScore = async () => {
    if (!selectedMatch) return;
    try {
      setSaving(true);
      await apiClient.post(`/matches/${selectedMatch.id}/results`, {
        teamId: Number(scoreForm.teamId),
        placement: Number(scoreForm.placement),
        kills: Number(scoreForm.kills),
        resultText: scoreForm.resultText,
      });
      setSuccessMessage('Score recorded successfully!');
      setShowScoreModal(false);
      const lbRes = await apiClient.get(`/groups/${selectedGroup.id}/leaderboard`);
      setLeaderboard(lbRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to record score');
    } finally {
      setSaving(false);
    }
  };

  // Action: Save Room Credentials
  const handleSaveRoom = async () => {
    if (!selectedMatch) return;
    try {
      setSaving(true);
      await apiClient.patch(`/matches/${selectedMatch.id}`, {
        room_id: roomForm.roomId,
        room_password: roomForm.roomPassword,
        instructions: roomForm.instructions,
      });
      setSuccessMessage('Room credentials updated!');
      setShowRoomModal(false);
      const mRes = await apiClient.get(`/groups/${selectedGroup.id}/matches`);
      setMatches(mRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update room');
    } finally {
      setSaving(false);
    }
  };

  // Action: Send Chat
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedGroup) return;
    try {
      const res = await apiClient.post(`/groups/${selectedGroup.id}/chat`, { message: chatInput.trim() });
      setChatMessages((prev) => [...prev, res.data]);
      setChatInput('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send message');
    }
  };

  const navItems = getScoutNavigation({ tournamentId });

  if (authLoading) {
    return <div className="route-loading" role="status">Restoring your EVOQ session...</div>;
  }

  if (!identity) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <WorkspaceShell label="Scout Console" items={navItems}>
        <div className="scouts-loading-state">
          <div className="spinner"></div>
          <p>Loading Scout Operations Console...</p>
        </div>
      </WorkspaceShell>
    );
  }

  if (error && !workspace) {
    return (
      <WorkspaceShell label="Scout Console" items={navItems}>
        <div className="scouts-empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>Scout Access Unavailable</h3>
          <p>{error}</p>
          <Link to="/scout" className="btn btn-primary">
            ← Return to Scout Workspace
          </Link>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell label="Scout Console" items={navItems}>
      <div className="scouts-container">
        {/* Header Bar */}
        <header className="scouts-header">
          <div className="scouts-header-content">
            <div className="scout-header-tags">
              <span className="scouts-badge">SCOUT CONSOLE</span>
              <span className="scout-scope-tag">
                {workspace.allGroups ? 'All Groups Scope' : `${workspace.assignedGroupIds?.length || 0} Assigned Groups`}
              </span>
            </div>
            <h1 className="scouts-title">{workspace.tournamentName || 'Tournament Scout Console'}</h1>
            <p className="scouts-subtitle">
              Authorized Operational Modules for {identity?.name} ({workspace.uniquePlayerId || `User #${identity?.id}`})
            </p>
          </div>

          <div className="scouts-header-actions">
            <Link to="/scout" className="btn btn-secondary">
              ← Switch Tournament
            </Link>
          </div>
        </header>

        {/* Alerts */}
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

        {/* Module Navigation Tabs */}
        <div className="scouts-tabs">
          <button
            type="button"
            className={`tab-btn${activeModule === 'OVERVIEW' ? ' is-active' : ''}`}
            onClick={() => setActiveModule('OVERVIEW')}
          >
            Overview & Permissions
          </button>

          {permissionsSet.has('VIEW_REGISTRATIONS') && (
            <button
              type="button"
              className={`tab-btn${activeModule === 'REGISTRATIONS' ? ' is-active' : ''}`}
              onClick={() => setActiveModule('REGISTRATIONS')}
            >
              Registrations ({registrations.length})
            </button>
          )}

          {(permissionsSet.has('VIEW_ROUNDS') || permissionsSet.has('VIEW_GROUPS')) && (
            <button
              type="button"
              className={`tab-btn${activeModule === 'COMPETITION' ? ' is-active' : ''}`}
              onClick={() => setActiveModule('COMPETITION')}
            >
              Groups & Matches ({groups.length} Groups)
            </button>
          )}

          {(permissionsSet.has('VIEW_RESULTS') || permissionsSet.has('ENTER_RESULTS')) && (
            <button
              type="button"
              className={`tab-btn${activeModule === 'SCORING' ? ' is-active' : ''}`}
              onClick={() => setActiveModule('SCORING')}
            >
              Live Scoring & Leaderboard
            </button>
          )}

          {permissionsSet.has('VIEW_ANNOUNCEMENTS') && (
            <button
              type="button"
              className={`tab-btn${activeModule === 'COMMUNICATION' ? ' is-active' : ''}`}
              onClick={() => setActiveModule('COMMUNICATION')}
            >
              Announcements & Chat
            </button>
          )}
        </div>

        {/* MODULE: Overview */}
        {activeModule === 'OVERVIEW' && (
          <div className="scout-module-card">
            <h3>Your Scout Assignment Overview</h3>
            <p>You have been authorized by the tournament organizer to perform specific operational actions.</p>

            <div className="overview-stats-grid">
              <div className="stat-card">
                <span className="stat-label">Granted Permissions</span>
                <strong>{workspace.permissions?.length || 0} Capabilities</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Group Authorization</span>
                <strong>{workspace.allGroups ? 'Full Tournament (All Groups)' : 'Restricted to Assigned Groups'}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Tournament Status</span>
                <strong>{workspace.tournamentStatus}</strong>
              </div>
            </div>

            <h4>Active Capabilities</h4>
            <div className="overview-perms-grid">
              {workspace.permissions?.map((p) => (
                <div key={p} className="overview-perm-item">
                  <span className="check-icon">✓</span>
                  <span>{p.replaceAll('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODULE: Registrations */}
        {activeModule === 'REGISTRATIONS' && permissionsSet.has('VIEW_REGISTRATIONS') && (
          <div className="scout-module-card">
            <div className="module-card-header">
              <h3>Tournament Registrations</h3>
              {permissionsSet.has('EXPORT_REGISTRATIONS') && (
                <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
                  Export CSV Spreadsheet
                </button>
              )}
            </div>

            <div className="scouts-table-wrapper">
              <table className="scouts-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Entry Type</th>
                    <th>Status</th>
                    <th>Members</th>
                    <th>Submitted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="no-data-cell">No registrations found.</td>
                    </tr>
                  ) : (
                    registrations.map((reg) => (
                      <tr key={reg.id}>
                        <td><strong>{reg.teamName}</strong></td>
                        <td><span className="entry-pill">{reg.entryType}</span></td>
                        <td><span className={`status-pill status-${reg.status.toLowerCase()}`}>{reg.status}</span></td>
                        <td>{reg.members?.length || 0} Players</td>
                        <td>{new Date(reg.submittedAt).toLocaleDateString()}</td>
                        <td>
                          <div className="scout-actions-cell">
                            {reg.status === 'PENDING' && permissionsSet.has('VERIFY_REGISTRATIONS') && (
                              <button
                                type="button"
                                className="btn-action edit"
                                onClick={() => handleVerifyReg(reg.id)}
                                disabled={saving}
                              >
                                Verify
                              </button>
                            )}
                            {reg.status === 'PENDING' && permissionsSet.has('REJECT_REGISTRATIONS') && (
                              <button
                                type="button"
                                className="btn-action revoke"
                                onClick={() => {
                                  setSelectedReg(reg);
                                  setShowRejectModal(true);
                                }}
                                disabled={saving}
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODULE: Competition & Groups */}
        {activeModule === 'COMPETITION' && (
          <div className="scout-module-card">
            <h3>Assigned Groups & Match Ops</h3>

            <div className="group-selector-tabs">
              {groups.map((grp) => (
                <button
                  key={grp.id}
                  type="button"
                  className={`group-tab-btn${selectedGroup?.id === grp.id ? ' active' : ''}`}
                  onClick={() => setSelectedGroup(grp)}
                >
                  {grp.name} ({grp.teams?.length || 0} teams)
                </button>
              ))}
            </div>

            {selectedGroup && (
              <div className="group-details-box">
                <h4>Matches in {selectedGroup.name}</h4>
                <div className="scouts-table-wrapper">
                  <table className="scouts-table">
                    <thead>
                      <tr>
                        <th>Match</th>
                        <th>Status</th>
                        <th>Room ID</th>
                        <th>Room Password</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="no-data-cell">No matches scheduled for this group.</td>
                        </tr>
                      ) : (
                        matches.map((m) => (
                          <tr key={m.id}>
                            <td><strong>{m.name}</strong></td>
                            <td><span className={`status-pill status-${m.status.toLowerCase()}`}>{m.status}</span></td>
                            <td>{permissionsSet.has('VIEW_ROOM') ? m.room_id || 'Not Set' : '••••••'}</td>
                            <td>{permissionsSet.has('VIEW_ROOM') ? m.room_password || 'Not Set' : '••••••'}</td>
                            <td>
                              <div className="scout-actions-cell">
                                {permissionsSet.has('EDIT_ROOM') && (
                                  <button
                                    type="button"
                                    className="btn-action edit"
                                    onClick={() => {
                                      setSelectedMatch(m);
                                      setRoomForm({
                                        roomId: m.room_id || '',
                                        roomPassword: m.room_password || '',
                                        instructions: m.instructions || '',
                                      });
                                      setShowRoomModal(true);
                                    }}
                                  >
                                    Edit Room
                                  </button>
                                )}
                                {m.status === 'SCHEDULED' && permissionsSet.has('START_MATCH') && (
                                  <button
                                    type="button"
                                    className="btn-action edit"
                                    onClick={() => handleStartMatch(m.id)}
                                  >
                                    Start Live
                                  </button>
                                )}
                                {m.status === 'LIVE' && permissionsSet.has('COMPLETE_MATCH') && (
                                  <button
                                    type="button"
                                    className="btn-action restore"
                                    onClick={() => handleCompleteMatch(m.id)}
                                  >
                                    Complete Match
                                  </button>
                                )}
                              </div>
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
        )}

        {/* MODULE: Scoring & Results */}
        {activeModule === 'SCORING' && (
          <div className="scout-module-card">
            <div className="module-card-header">
              <h3>Live Match Scoring & Leaderboard</h3>
              {permissionsSet.has('ENTER_RESULTS') && selectedGroup && matches.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSelectedMatch(matches[0]);
                    setScoreForm({ teamId: selectedGroup.teams?.[0]?.team_id || '', placement: '1', kills: '0', resultText: '' });
                    setShowScoreModal(true);
                  }}
                >
                  + Enter Team Score
                </button>
              )}
            </div>

            <div className="scouts-table-wrapper">
              <table className="scouts-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team Name</th>
                    <th>Total Points</th>
                    <th>Kills</th>
                    <th>Placement</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data-cell">No leaderboard points recorded yet for this group.</td>
                    </tr>
                  ) : (
                    leaderboard.map((row, idx) => (
                      <tr key={row.teamId || idx}>
                        <td><strong>#{row.rank || idx + 1}</strong></td>
                        <td><strong>{row.teamName}</strong></td>
                        <td><span className="points-highlight">{row.points} pts</span></td>
                        <td>{row.kills} Kills</td>
                        <td>Rank #{row.position || row.placement || idx + 1}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODULE: Communication */}
        {activeModule === 'COMMUNICATION' && (
          <div className="scout-module-card">
            <h3>Tournament Announcements & Group Moderation</h3>
            <div className="announcements-list">
              {(!announcements || announcements.length === 0) ? (
                <p className="no-data-note">No official announcements posted for this tournament yet.</p>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="announcement-card">
                    <div className="ann-creator">Posted by {a.creatorName || 'Organizer'}</div>
                    <div className="ann-message">{a.message}</div>
                    <div className="ann-time">{a.createdAt ? new Date(a.createdAt).toLocaleString() : 'Recent'}</div>
                  </div>
                ))
              )}
            </div>

            {permissionsSet.has('MANAGE_GROUP_CHAT') && selectedGroup && (
              <div className="scout-chat-box">
                <h4>Live Group Chat ({selectedGroup.name})</h4>
                <div className="chat-messages-container">
                  {(!chatMessages || chatMessages.length === 0) ? (
                    <p className="no-chat-note">No chat messages yet in this group.</p>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={msg.id || idx} className="chat-bubble">
                        <strong>{msg.senderName || 'Staff'}:</strong> {msg.message}
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSendChat} className="chat-input-form">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type official scout message to group..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary">Send</button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* MODAL: Score Entry */}
        {showScoreModal && selectedMatch && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <header className="modal-header">
                <h2>Enter Match Score: {selectedMatch.name}</h2>
                <button type="button" className="modal-close-btn" onClick={() => setShowScoreModal(false)}>×</button>
              </header>
              <div className="modal-body">
                <label className="input-label">Select Team:</label>
                <select
                  className="form-control"
                  value={scoreForm.teamId}
                  onChange={(e) => setScoreForm({ ...scoreForm, teamId: e.target.value })}
                >
                  {selectedGroup?.teams?.map((t) => (
                    <option key={t.team_id || t.id} value={t.team_id || t.id}>
                      {t.team_name || t.name}
                    </option>
                  ))}
                </select>

                <div className="form-row-2">
                  <div>
                    <label className="input-label">Placement Rank:</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      value={scoreForm.placement}
                      onChange={(e) => setScoreForm({ ...scoreForm, placement: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Kill Count:</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={scoreForm.kills}
                      onChange={(e) => setScoreForm({ ...scoreForm, kills: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <footer className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScoreModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSaveScore}>
                  {saving ? 'Saving...' : 'Record Score'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* MODAL: Room Credentials */}
        {showRoomModal && selectedMatch && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <header className="modal-header">
                <h2>Edit Room Credentials: {selectedMatch.name}</h2>
                <button type="button" className="modal-close-btn" onClick={() => setShowRoomModal(false)}>×</button>
              </header>
              <div className="modal-body">
                <label className="input-label">Room ID:</label>
                <input
                  type="text"
                  className="form-control"
                  value={roomForm.roomId}
                  onChange={(e) => setRoomForm({ ...roomForm, roomId: e.target.value })}
                />
                <label className="input-label">Room Password:</label>
                <input
                  type="text"
                  className="form-control"
                  value={roomForm.roomPassword}
                  onChange={(e) => setRoomForm({ ...roomForm, roomPassword: e.target.value })}
                />
                <label className="input-label">Instructions / Notes:</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={roomForm.instructions}
                  onChange={(e) => setRoomForm({ ...roomForm, instructions: e.target.value })}
                />
              </div>
              <footer className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRoomModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSaveRoom}>
                  {saving ? 'Saving...' : 'Update Room'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* MODAL: Reject Registration */}
        {showRejectModal && selectedReg && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <header className="modal-header">
                <h2>Reject Registration: {selectedReg.teamName}</h2>
                <button type="button" className="modal-close-btn" onClick={() => setShowRejectModal(false)}>×</button>
              </header>
              <div className="modal-body">
                <label className="input-label">Rejection Reason:</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="State the reason for rejection (e.g. Invalid player UID or missing payment screenshot)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <footer className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                <button type="button" className="btn btn-danger" disabled={saving} onClick={handleRejectReg}>
                  {saving ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
