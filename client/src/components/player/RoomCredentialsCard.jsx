import { useState } from 'react';

export function RoomCredentialsCard({ roomId, roomPassword, lobbyStatus }) {
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const isRoomConfigured = Boolean(roomId || roomPassword);

  return (
    <div className="room-credentials-card">
      <div className="room-card-header">
        <div className="room-title-strip">
          <h3 className="room-heading">Lobby & Room Credentials</h3>
        </div>
        <span className={`status-badge ${isRoomConfigured ? 'live' : 'draft'}`}>
          {lobbyStatus || (isRoomConfigured ? 'ROOM READY' : 'WAITING FOR ORGANIZER')}
        </span>
      </div>

      <div className="room-grid">
        {/* Room ID */}
        <div className="room-credential-box">
          <span className="credential-label">ROOM ID</span>
          <div className="credential-value-row">
            <strong className="credential-value">
              {roomId || 'Not set'}
            </strong>
            {roomId && (
              <button
                className="button secondary-button copy-btn"
                type="button"
                onClick={() => handleCopy(roomId, 'roomId')}
                aria-label="Copy Room ID"
              >
                {copiedField === 'roomId' ? '✓ Copied!' : 'Copy'}
              </button>
            )}
          </div>
        </div>

        {/* Room Password */}
        <div className="room-credential-box">
          <span className="credential-label">ROOM PASSWORD</span>
          <div className="credential-value-row">
            <strong className="credential-value password-value">
              {roomPassword || 'Not set'}
            </strong>
            {roomPassword && (
              <button
                className="button secondary-button copy-btn"
                type="button"
                onClick={() => handleCopy(roomPassword, 'roomPassword')}
                aria-label="Copy Room Password"
              >
                {copiedField === 'roomPassword' ? '✓ Copied!' : 'Copy'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
