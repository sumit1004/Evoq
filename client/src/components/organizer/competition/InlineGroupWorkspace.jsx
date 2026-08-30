import { useState, useEffect } from 'react';
import { GroupChatView } from '../../GroupChatView.jsx';
import { LeaderboardTable } from '../../common/LeaderboardTable.jsx';

export function InlineGroupWorkspace({
  group,
  round,
  activeTab = 'overview',
  onSelectTab,
  onBackToGroups,
  onUpdateRoom,
  onStartMatch,
  onOpenScoreModal,
  onOpenMatchModal,
  onDeleteMatch,
  onMoveTeam,
  onRemoveTeam,
  onCompleteGroup,
  isReadOnly = false,
  canManageRoom = true,
  canManageMatches = true,
  canAssignTeams = true,
  leaderboardRows = [],
  scoringMode = 'KILLS_AND_POSITION',
  loading = false,
}) {
  const [roomId, setRoomId] = useState(group?.roomId || '');
  const [roomPassword, setRoomPassword] = useState(group?.roomPassword || '');
  const [instructions, setInstructions] = useState(group?.instructions || '');
  const [copiedField, setCopiedField] = useState(null);
  const [roomSaving, setRoomSaving] = useState(false);

  useEffect(() => {
    if (group) {
      setRoomId(group.roomId || '');
      setRoomPassword(group.roomPassword || '');
      setInstructions(group.instructions || '');
    }
  }, [group]);

  if (!group) return null;

  const teams = group.teams || [];
  const matches = group.matches || [];
  const completedMatches = matches.filter((m) => m.status === 'COMPLETED').length;
  const pendingMatches = matches.filter((m) => m.status !== 'COMPLETED').length;

  const handleCopy = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    setRoomSaving(true);
    try {
      await onUpdateRoom(group.id, {
        roomId: roomId.trim() || null,
        roomPassword: roomPassword.trim() || null,
        instructions: instructions.trim() || null,
      });
    } finally {
      setRoomSaving(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'room', label: 'Room & Lobby' },
    { id: 'matches', label: 'Matches', count: matches.length },
    { id: 'standings', label: 'Standings' },
    { id: 'teams', label: 'Teams', count: teams.length },
    { id: 'chat', label: 'Chat' },
  ];

  return (
    <div className="comp-inline-group-workspace">
      {/* Workspace Header */}
      <div className="comp-group-workspace-header">
        <div>
          <button
            className="text-link"
            type="button"
            style={{ fontSize: '12px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: '6px' }}
            onClick={onBackToGroups}
          >
            ← Back to all groups
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              {group.name}
            </h2>
            <span className={`comp-status-badge comp-status-${group.status?.toLowerCase().replaceAll('_', '-')}`}>
              {group.status}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            Round {round?.roundNumber} · {teams.length} / {group.groupSize || 12} Teams · {completedMatches} / {matches.length} Matches Done
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isReadOnly && group.status !== 'COMPLETED' && completedMatches === matches.length && matches.length > 0 && (
            <button
              className="button secondary-button"
              type="button"
              style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px', color: '#2ecc71', borderColor: 'rgba(46, 204, 113, 0.4)' }}
              onClick={() => onCompleteGroup(group.id)}
            >
              Complete Group
            </button>
          )}
          {!isReadOnly && canManageMatches && (
            <button
              className="button primary-button"
              type="button"
              style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}
              onClick={() => onOpenMatchModal(group.id)}
            >
              + Create Match
            </button>
          )}
        </div>
      </div>

      {/* Segmented Control Sub-Tabs */}
      <div className="comp-sub-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`comp-sub-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => onSelectTab(t.id)}
            type="button"
          >
            {t.label} {t.count !== undefined && `(${t.count})`}
          </button>
        ))}
      </div>

      {/* 1. Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="comp-metrics-grid" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: '20px' }}>
            <div className="comp-metric-card">
              <span className="comp-metric-label">Group Status</span>
              <span className="comp-metric-value" style={{ fontSize: '16px', color: '#38bdf8' }}>{group.status}</span>
            </div>
            <div className="comp-metric-card">
              <span className="comp-metric-label">Assigned Teams</span>
              <span className="comp-metric-value">{teams.length} / {group.groupSize || 12}</span>
            </div>
            <div className="comp-metric-card">
              <span className="comp-metric-label">Completed Matches</span>
              <span className="comp-metric-value">{completedMatches} / {matches.length}</span>
            </div>
            <div className="comp-metric-card">
              <span className="comp-metric-label">Room Credentials</span>
              <span className="comp-metric-value" style={{ fontSize: '15px', color: group.roomId ? '#2ecc71' : '#f6c453' }}>
                {group.roomId ? 'Configured' : 'Not Set'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#fff' }}>Quick Operational Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!group.roomId && canManageRoom && !isReadOnly && (
                  <button
                    className="button secondary-button"
                    style={{ justifyContent: 'flex-start', minHeight: '34px', fontSize: '12px' }}
                    onClick={() => onSelectTab('room')}
                  >
                    Set Room & Lobby Credentials →
                  </button>
                )}
                {pendingMatches > 0 && (
                  <button
                    className="button secondary-button"
                    style={{ justifyContent: 'flex-start', minHeight: '34px', fontSize: '12px' }}
                    onClick={() => onSelectTab('matches')}
                  >
                    Review {pendingMatches} Pending Matches →
                  </button>
                )}
                <button
                  className="button secondary-button"
                  style={{ justifyContent: 'flex-start', minHeight: '34px', fontSize: '12px' }}
                  onClick={() => onSelectTab('standings')}
                >
                  View Group Standings →
                </button>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#fff' }}>Active Credentials</h3>
              {group.roomId ? (
                <div style={{ fontSize: '13px', color: '#8b949e', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>
                    <span>Room ID: </span>
                    <strong style={{ color: '#fff', letterSpacing: '0.05em' }}>{group.roomId}</strong>
                  </div>
                  <div>
                    <span>Password: </span>
                    <strong style={{ color: '#fff' }}>{group.roomPassword || 'None'}</strong>
                  </div>
                  <button
                    className="text-button"
                    style={{ color: '#38bdf8', marginTop: '6px', textAlign: 'left', padding: 0 }}
                    onClick={() => onSelectTab('room')}
                  >
                    Edit Credentials →
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
                  No room credentials configured yet. Players in this group will not see lobby access information.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Room & Lobby Tab */}
      {activeTab === 'room' && (
        <form onSubmit={handleSaveRoom} style={{ maxWidth: '540px' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#8b949e' }}>
            Configure room ID and password for all matches in this group. Updates are instantly broadcast to assigned players.
          </p>

          <div className="comp-form-group">
            <label className="comp-label">Custom Room ID</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="comp-input"
                type="text"
                placeholder="e.g. 9845210"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={isReadOnly || !canManageRoom}
              />
              {roomId && (
                <button
                  className="button secondary-button"
                  type="button"
                  style={{ minHeight: '38px', padding: '0 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  onClick={() => handleCopy(roomId, 'room')}
                >
                  {copiedField === 'room' ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          <div className="comp-form-group">
            <label className="comp-label">Room Password</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="comp-input"
                type="text"
                placeholder="e.g. EVOQ2026"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                disabled={isReadOnly || !canManageRoom}
              />
              {roomPassword && (
                <button
                  className="button secondary-button"
                  type="button"
                  style={{ minHeight: '38px', padding: '0 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  onClick={() => handleCopy(roomPassword, 'pass')}
                >
                  {copiedField === 'pass' ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          <div className="comp-form-group">
            <label className="comp-label">Special Instructions / Lobby Notes</label>
            <textarea
              className="comp-textarea"
              rows="3"
              placeholder="e.g. Drop in Bermuda map. Check-in closes 5 mins before start."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={isReadOnly || !canManageRoom}
            />
          </div>

          {!isReadOnly && canManageRoom && (
            <button
              className="button primary-button"
              type="submit"
              disabled={roomSaving}
              style={{ minHeight: '36px', padding: '0 16px', fontSize: '13px' }}
            >
              {roomSaving ? 'Saving Credentials...' : 'Save & Broadcast Credentials'}
            </button>
          )}
        </form>
      )}

      {/* 3. Matches Tab */}
      {activeTab === 'matches' && (
        <div>
          {matches.length === 0 ? (
            <div className="comp-empty-state">
              <h3 className="comp-empty-state-title">No matches scheduled</h3>
              <p className="comp-empty-state-desc">
                Schedule one or more matches for {group.name} to track scores and standings.
              </p>
              {!isReadOnly && canManageMatches && (
                <button
                  className="button primary-button"
                  type="button"
                  onClick={() => onOpenMatchModal(group.id)}
                >
                  + Create Match
                </button>
              )}
            </div>
          ) : (
            <div className="comp-matches-grid">
              {matches.map((m) => {
                const statusClass = m.status ? m.status.toLowerCase().replaceAll('_', '-') : 'scheduled';
                return (
                  <div key={m.id} className="comp-match-card">
                    <div>
                      <div className="comp-match-header">
                        <h4 className="comp-match-title">{m.name || `Match ${m.matchNumber}`}</h4>
                        <span className={`comp-status-badge comp-status-${statusClass}`}>
                          {m.status}
                        </span>
                      </div>

                      <div className="comp-match-body">
                        <div>
                          <span>Timing: </span>
                          <strong style={{ color: '#fff' }}>
                            {m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                          </strong>
                        </div>
                        <div>
                          <span>Room: </span>
                          <strong style={{ color: m.roomId || group.roomId ? '#2ecc71' : '#f6c453' }}>
                            {m.roomId || group.roomId || 'Not set'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="comp-match-footer">
                      {!isReadOnly && m.status !== 'COMPLETED' && (
                        <button
                          className="button primary-button"
                          type="button"
                          style={{ minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                          onClick={() => onOpenScoreModal(m)}
                        >
                          Manage Score
                        </button>
                      )}
                      {m.status === 'SCHEDULED' && !isReadOnly && (
                        <button
                          className="button secondary-button"
                          type="button"
                          style={{ minHeight: '28px', padding: '0 10px', fontSize: '11px' }}
                          onClick={() => onStartMatch(m.id)}
                        >
                          Start Match
                        </button>
                      )}
                      {!isReadOnly && canManageMatches && m.status !== 'COMPLETED' && (
                        <button
                          className="button ghost-button"
                          type="button"
                          style={{ minHeight: '28px', padding: '0 8px', fontSize: '11px', color: '#ff7b72' }}
                          onClick={() => onDeleteMatch(m)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Standings Tab */}
      {activeTab === 'standings' && (
        <div style={{ marginTop: '10px' }}>
          <LeaderboardTable
            rows={leaderboardRows}
            scoringMode={scoringMode}
            title={`${group.name} Standings`}
            subtitle="Live match scores and placements for this group"
            emptyMessage="No scores recorded for this group yet."
          />
        </div>
      )}

      {/* 5. Teams Tab */}
      {activeTab === 'teams' && (
        <div>
          {teams.length === 0 ? (
            <div className="comp-empty-state">
              <h3 className="comp-empty-state-title">No teams assigned yet</h3>
              <p className="comp-empty-state-desc">
                Use the group creation workflow or assign verified teams to this group.
              </p>
            </div>
          ) : (
            <div className="comp-table-container">
              <table className="comp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team Name</th>
                    <th>Assigned Date</th>
                    {!isReadOnly && canAssignTeams && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, idx) => (
                    <tr key={t.id}>
                      <td style={{ width: '40px', color: '#8b949e' }}>{idx + 1}</td>
                      <td>
                        <strong style={{ color: '#fff' }}>{t.name}</strong>
                      </td>
                      <td style={{ color: '#8b949e' }}>
                        {t.assignedAt ? new Date(t.assignedAt).toLocaleDateString() : '-'}
                      </td>
                      {!isReadOnly && canAssignTeams && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="button secondary-button"
                            type="button"
                            style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px', marginRight: '6px' }}
                            onClick={() => onMoveTeam(t, group)}
                          >
                            Move
                          </button>
                          <button
                            className="button ghost-button"
                            type="button"
                            style={{ minHeight: '26px', padding: '0 8px', fontSize: '11px', color: '#ff7b72' }}
                            onClick={() => onRemoveTeam(group.id, t.id)}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Chat Tab */}
      {activeTab === 'chat' && (
        <div style={{ height: '420px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
          <GroupChatView
            groupId={group.id}
            groupName={group.name}
            isCompleted={isReadOnly || group.status === 'COMPLETED'}
          />
        </div>
      )}
    </div>
  );
}
