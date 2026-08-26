import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { fetchTeams } from '../../services/teamApi.js';
import { fetchRegistrations, fetchTournament, registerTeam } from '../../services/tournamentApi.js';
import { DirectoryLayoutWrapper } from '../../components/DirectoryLayoutWrapper.jsx';

export function TournamentDetailsPage() {
  const { tournamentId } = useParams();
  const { identity } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [form, setForm] = useState({ teamId: '', transactionId: '', paymentScreenshot: null });
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  const load = useCallback(async () => {
    try {
      const result = await fetchTournament(tournamentId);
      setTournament(result.tournament);
      if (identity?.role === 'PLAYER') {
        const [teamResult, registrationResult] = await Promise.all([fetchTeams(), fetchRegistrations(tournamentId)]);
        setTeams(Array.isArray(teamResult) ? teamResult : teamResult?.teams || []);
        setRegistrations(Array.isArray(registrationResult?.registrations) ? registrationResult.registrations : []);
      }
      setState((current) => ({ ...current, loading: false }));
    } catch (error) { setState({ loading: false, submitting: false, error: error.message, notice: '' }); }
  }, [tournamentId, identity?.role]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, submitting: true, error: '', notice: '' }));
    try {
      await registerTeam(tournamentId, form);
      setForm({ teamId: '', transactionId: '', paymentScreenshot: null });
      setState((current) => ({ ...current, submitting: false, notice: 'Registration submitted for organizer review.' }));
      const result = await fetchRegistrations(tournamentId);
      setRegistrations(Array.isArray(result?.registrations) ? result.registrations : []);
    } catch (error) { setState((current) => ({ ...current, submitting: false, error: error.message })); }
  }

  const isOnlineUnconfigured = tournament?.entryType === 'PAID' && tournament?.paymentMethod === 'ONLINE';

  const selectedTeam = teams.find(t => String(t.id) === String(form.teamId));
  const preflightMembers = selectedTeam ? selectedTeam.members.map(member => {
    const checks = [];
    let isOk = true;
    
    // Check mobile
    if (!member.mobile) {
      checks.push('Mobile missing');
      isOk = false;
    }
    
    // Check Free Fire details if game is Free Fire
    if (tournament?.game === 'Free Fire') {
      if (!member.inGameName) {
        checks.push('IGN missing');
        isOk = false;
      }
      if (!member.gameUid) {
        checks.push('Free Fire UID missing');
        isOk = false;
      }
    }
    
    return {
      ...member,
      isOk,
      checks
    };
  }) : [];

  const isTeamRegistrationBlocked = preflightMembers.some(m => !m.isOk);

  return (
    <DirectoryLayoutWrapper>
      {state.loading && <p className="status-panel">Loading tournament...</p>}
      
      {!state.loading && !tournament && (
        <div className="form-alert" role="alert">
          {state.error || 'Tournament details are unavailable.'}
        </div>
      )}

      {!state.loading && tournament && (
        <section className="page-section workspace-page">
          <Link className="text-link" to="/tournaments">Back to tournaments</Link>
          <div className="page-kicker" style={{ marginTop: '10px' }}>{tournament.status.replaceAll('_', ' ')}</div>
          <h1>{tournament.name}</h1>
          <p>{tournament.description || 'No description provided.'}</p>
          
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div className="detail-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong>Registration</strong>
              <span>{new Date(tournament.registrationStartAt).toLocaleString()} to {new Date(tournament.registrationEndAt).toLocaleString()}</span>
            </div>
            <div className="detail-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong>Format</strong>
              <span>{tournament.playersPerTeam} players per team · {tournament.maxTeams} teams</span>
            </div>
            <div className="detail-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong>Entry Fee</strong>
              <span>{tournament.entryType === 'PAID' ? `₹${tournament.entryFee}` : 'Free'}</span>
            </div>
          </div>

          {/* Real Prizes Configuration Pool */}
          {tournament.prizes && tournament.prizes.length > 0 && (
            <div className="prize-pool-section" style={{ marginTop: '25px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '18px', margin: '0 0 12px 0', color: '#fff' }}>Prize Pool</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                {tournament.prizes.map((prize) => (
                  <div key={prize.position} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#91a0b3', display: 'block' }}>
                      {prize.position === 1 ? '1st Place' : prize.position === 2 ? '2nd Place' : prize.position === 3 ? '3rd Place' : `${prize.position}th Place`}
                    </span>
                    <strong style={{ fontSize: '16px', color: '#f6c453', display: 'block', marginTop: '4px' }}>
                      ₹{Number(prize.amount).toLocaleString()}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {identity?.role === 'PLAYER' && tournament.status === 'REGISTRATION_OPEN' && (
            <form className="registration-form" onSubmit={submit}>
              <h2>Register a team</h2>
              {state.error && <div className="form-alert" role="alert">{state.error}</div>}
              {state.notice && <div className="success-alert" role="status">{state.notice}</div>}
              
              <label htmlFor="registration-team">Team</label>
              <select id="registration-team" value={form.teamId} onChange={(event) => setForm((current) => ({ ...current, teamId: event.target.value }))} required>
                <option value="">Choose a team</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.members.length} players)</option>)}
              </select>

              {selectedTeam && (
                <div className="preflight-summary-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', margin: '15px 0', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#fff' }}>Team Eligibility Precheck</h3>
                  <p style={{ fontSize: '13px', margin: '0 0 10px 0', color: '#91a0b3' }}>
                    All team members must have a complete profile before registering.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {preflightMembers.map(member => (
                      <li key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px' }}>
                        <span style={{ color: member.isOk ? '#fff' : '#ff6b6b', fontWeight: '500' }}>
                          {member.isOk ? '✓' : '⚠'} {member.name}
                        </span>
                        {!member.isOk && (
                          <span style={{ fontSize: '12px', color: '#ff6b6b', background: 'rgba(231,76,60,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {member.checks.join(', ')}
                          </span>
                        )}
                        {member.isOk && (
                          <span style={{ fontSize: '12px', color: '#2ecc71' }}>Ready</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {isTeamRegistrationBlocked && (
                    <p style={{ color: '#ff6b6b', fontSize: '13px', margin: '10px 0 0 0', fontWeight: 'bold' }}>
                      ⚠ Registration is blocked. Team members must complete their profiles under settings before registering.
                    </p>
                  )}
                </div>
              )}
              
              {tournament.entryType === 'PAID' && (
                <div className="payment-instructions-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', margin: '15px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>Payment Information</h3>
                  <p style={{ margin: '0 0 8px 0' }}>Fee: <strong>₹{tournament.entryFee}</strong></p>
                  
                  {tournament.paymentMethod === 'MANUAL_UPI' && (
                    <>
                      <p style={{ margin: '0 0 8px 0' }}>Send payment of ₹{tournament.entryFee} to the organizer details:</p>
                      <p style={{ margin: '0 0 8px 0' }}><strong>UPI ID:</strong> {tournament.upiId}</p>
                      {tournament.paymentInstructions && (
                        <p style={{ margin: '0 0 12px 0' }}><strong>Instructions:</strong> {tournament.paymentInstructions}</p>
                      )}
                      {tournament.paymentQrPath && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{ display: 'block', margin: '0 0 6px 0', fontWeight: 'bold' }}>Scan QR Code:</span>
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL || '/api'}/tournaments/${tournamentId}/payment-qr`} 
                            alt="Payment QR" 
                            style={{ maxWidth: '180px', display: 'block', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {isOnlineUnconfigured && (
                    <p style={{ color: '#ff6b6b', margin: 0 }}>Online payments are not configured for this tournament.</p>
                  )}
                </div>
              )}

              {tournament.entryType === 'PAID' && tournament.paymentMethod === 'MANUAL_UPI' && (
                <>
                  <label htmlFor="registration-transaction">Transaction / Reference ID</label>
                  <input id="registration-transaction" placeholder="Enter reference number" value={form.transactionId} onChange={(event) => setForm((current) => ({ ...current, transactionId: event.target.value }))} required />
                  
                  <label htmlFor="registration-proof">Payment Screenshot</label>
                  <input id="registration-proof" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setForm((current) => ({ ...current, paymentScreenshot: event.target.files?.[0] || null }))} required />
                </>
              )}

              <button className="button primary-button" type="submit" disabled={state.submitting || isOnlineUnconfigured || isTeamRegistrationBlocked}>
                {state.submitting ? 'Submitting...' : isOnlineUnconfigured ? 'Online Payment Unavailable' : isTeamRegistrationBlocked ? 'Incomplete Member Profiles' : 'Submit registration'}
              </button>
            </form>
          )}

          {identity?.role === 'PLAYER' && registrations.length > 0 && (
            <div className="registration-list">
              <h2>Your registrations</h2>
              {registrations.map((registration) => (
                <div className="registration-item" key={registration.id}>
                  <div>
                    <strong>{registration.teamName}</strong>
                    {registration.rejectionReason && (
                      <p style={{ color: '#ff6b6b', margin: '5px 0 0 0', fontSize: '14px' }}>Rejection Reason: {registration.rejectionReason}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                    <span className={`status-badge ${registration.status.toLowerCase()}`}>{registration.status}</span>
                    <span className={`status-badge ${registration.paymentStatus.toLowerCase().replaceAll('_', '-')}`}>{registration.paymentStatus.replaceAll('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!identity && <p className="status-panel">Login as a player to register an eligible team.</p>}
        </section>
      )}
    </DirectoryLayoutWrapper>
  );
}
