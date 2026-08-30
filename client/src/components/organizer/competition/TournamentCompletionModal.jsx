import { useState } from 'react';

export function TournamentCompletionModal({
  isOpen,
  onClose,
  onConfirm,
  tournament,
  rounds = [],
  groups = [],
  leaderboard = [],
  loading = false,
  error = '',
}) {
  const [confirmedCheck, setConfirmedCheck] = useState(false);

  if (!isOpen) return null;

  // Calculate high-level summary metrics
  const totalRounds = rounds.length;
  const totalGroups = groups.length;
  const totalMatches = groups.reduce((acc, g) => acc + (g.matches?.length || 0), 0);
  const totalRankedTeams = leaderboard.length;
  const topTeam = leaderboard[0];

  return (
    <div className="comp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="completion-modal-title">
      <div className="comp-modal-content" style={{ maxWidth: '680px', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f6c453', fontWeight: 700 }}>
              Official Tournament Finalization
            </span>
            <h2 id="completion-modal-title" style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              Finalize & Complete Tournament
            </h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={onClose}
            disabled={loading}
            style={{ color: '#8b949e', fontSize: '20px', padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        {/* Warning Banner */}
        <div style={{ background: 'rgba(246, 196, 83, 0.08)', border: '1px solid rgba(246, 196, 83, 0.3)', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px' }}>
          <strong style={{ color: '#f6c453', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
            Permanent Tournament Archive
          </strong>
          <span style={{ fontSize: '12px', color: '#c9d1d9', lineHeight: 1.4, display: 'block' }}>
            Completing this tournament will generate an immutable permanent historical snapshot of the final leaderboard, rankings, and team scores. All tournament mutations will be locked permanently.
          </span>
        </div>

        {/* Summary Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', display: 'block' }}>Rounds</span>
            <strong style={{ fontSize: '16px', color: '#fff' }}>{totalRounds}</strong>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', display: 'block' }}>Groups</span>
            <strong style={{ fontSize: '16px', color: '#fff' }}>{totalGroups}</strong>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', display: 'block' }}>Matches</span>
            <strong style={{ fontSize: '16px', color: '#fff' }}>{totalMatches}</strong>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', display: 'block' }}>Ranked Teams</span>
            <strong style={{ fontSize: '16px', color: '#fff' }}>{totalRankedTeams}</strong>
          </div>
        </div>

        {/* Projected Champion Banner */}
        {topTeam && (
          <div style={{ background: 'rgba(46, 204, 113, 0.08)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: '6px', padding: '10px 14px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#2ecc71', fontWeight: 700, display: 'block' }}>
                Projected Tournament Champion
              </span>
              <strong style={{ fontSize: '15px', color: '#fff' }}>
                #1 {topTeam.teamName || topTeam.team_name}
              </strong>
            </div>
            <span style={{ fontSize: '13px', color: '#c9d1d9', fontWeight: 600 }}>
              {topTeam.points} pts · {topTeam.kills} kills
            </span>
          </div>
        )}

        {/* Final Standings Preview Table */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase' }}>
              Final Standings Preview ({totalRankedTeams} Teams)
            </span>
            <span style={{ fontSize: '11px', color: '#8b949e' }}>
              Authoritative Snapshot Preview
            </span>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px' }}>
            {leaderboard.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>
                No completed match results recorded. Final leaderboard requires at least one match result.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', color: '#8b949e', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', width: '50px' }}>Rank</th>
                    <th style={{ padding: '8px 12px' }}>Team</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Kills</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((team, idx) => (
                    <tr key={team.teamId || team.team_id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: idx === 0 ? '#f6c453' : idx === 1 ? '#e0e0e0' : idx === 2 ? '#cd7f32' : '#8b949e' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#fff' }}>
                        {team.teamName || team.team_name}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#8b949e' }}>
                        {team.kills ?? 0}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#7dd3fc' }}>
                        {team.points ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="comp-alert error" style={{ marginBottom: '16px' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Confirmation Checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '20px', cursor: 'pointer', fontSize: '13px', color: '#c9d1d9' }}>
          <input
            type="checkbox"
            checked={confirmedCheck}
            onChange={(e) => setConfirmedCheck(e.target.checked)}
            disabled={loading || totalRankedTeams === 0}
            style={{ marginTop: '3px' }}
          />
          <span>
            I confirm all matches and standings are finalized. I understand that completing this tournament is permanent and will make all data read-only.
          </span>
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="button secondary-button"
            onClick={onClose}
            disabled={loading}
            style={{ minHeight: '38px', fontSize: '13px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button primary-button"
            onClick={onConfirm}
            disabled={loading || !confirmedCheck || totalRankedTeams === 0}
            style={{ minHeight: '38px', fontSize: '13px', background: '#2ecc71', borderColor: '#2ecc71', color: '#000', fontWeight: 700 }}
          >
            {loading ? 'Finalizing...' : 'Confirm & Complete Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
}
