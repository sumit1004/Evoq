import { useState, useEffect } from 'react';

export function MatchEditorModal({
  isOpen,
  onClose,
  initialGroupId,
  groups = [],
  match = null, // null for create, object for edit
  onSaveMatch,
  loading = false,
}) {
  const isEditing = Boolean(match);

  const [groupId, setGroupId] = useState(initialGroupId || groups[0]?.id || '');
  const [matchNumber, setMatchNumber] = useState(1);
  const [name, setName] = useState('Match 1');
  const [scheduledAt, setScheduledAt] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState('SCHEDULED');
  const [error, setError] = useState('');

  useEffect(() => {
    if (match) {
      setGroupId(match.groupId || initialGroupId || groups[0]?.id || '');
      setMatchNumber(match.matchNumber || 1);
      setName(match.name || `Match ${match.matchNumber || 1}`);
      setScheduledAt(match.scheduledAt ? match.scheduledAt.slice(0, 16) : '');
      setRoomId(match.roomId || '');
      setRoomPassword(match.roomPassword || '');
      setInstructions(match.instructions || '');
      setStatus(match.status || 'SCHEDULED');
    } else {
      setGroupId(initialGroupId || groups[0]?.id || '');
      setMatchNumber(1);
      setName('Match 1');
      setScheduledAt('');
      setRoomId('');
      setRoomPassword('');
      setInstructions('');
      setStatus('SCHEDULED');
    }
  }, [match, initialGroupId, groups]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!groupId) {
      setError('Please select a competition group.');
      return;
    }
    setError('');

    const payload = {
      matchNumber: Number(matchNumber),
      name: name.trim() || `Match ${matchNumber}`,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      roomId: roomId.trim() || null,
      roomPassword: roomPassword.trim() || null,
      instructions: instructions.trim() || null,
    };

    if (isEditing) {
      payload.status = status;
    }

    onSaveMatch(groupId, payload, match?.id);
  };

  return (
    <div className="comp-modal-overlay" role="dialog" aria-modal="true">
      <div className="comp-modal" style={{ maxWidth: '540px' }}>
        <div className="comp-modal-header">
          <h2 className="comp-modal-title">
            {isEditing ? `Edit ${match.name || 'Match'}` : 'Schedule New Match'}
          </h2>
          <button className="comp-modal-close" onClick={onClose} type="button" aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="comp-alert comp-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isEditing && (
            <div className="comp-form-group">
              <label className="comp-label">Group</label>
              <select
                className="comp-select"
                value={groupId}
                onChange={(e) => setGroupId(Number(e.target.value))}
                required
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.teams?.length || 0} teams)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div className="comp-form-group">
              <label className="comp-label">Match #</label>
              <input
                className="comp-input"
                type="number"
                min="1"
                value={matchNumber}
                onChange={(e) => {
                  setMatchNumber(e.target.value);
                  if (!isEditing) setName(`Match ${e.target.value}`);
                }}
                required
              />
            </div>

            <div className="comp-form-group">
              <label className="comp-label">Match Name / Label</label>
              <input
                className="comp-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="comp-form-group">
            <label className="comp-label">Scheduled Start Time</label>
            <input
              className="comp-input"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <span className="comp-input-hint">Optional: Time when the match is scheduled to start</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="comp-form-group">
              <label className="comp-label">Match Room ID (Optional)</label>
              <input
                className="comp-input"
                type="text"
                placeholder="Leave blank to use group room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
            </div>

            <div className="comp-form-group">
              <label className="comp-label">Room Password</label>
              <input
                className="comp-input"
                type="text"
                placeholder="Leave blank for group pass"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="comp-form-group">
            <label className="comp-label">Lobby Instructions</label>
            <textarea
              className="comp-textarea"
              rows="2"
              placeholder="e.g. Map Bermuda, spectator mode enabled"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {isEditing && (
            <div className="comp-form-group">
              <label className="comp-label">Match Status</label>
              <select
                className="comp-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="LIVE">LIVE</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
          )}

          <div className="comp-modal-footer">
            <button className="button secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary-button" type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Save Match' : 'Create Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
