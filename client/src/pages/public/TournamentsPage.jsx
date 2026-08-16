import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTournaments } from '../../services/tournamentApi.js';

export function TournamentsPage() {
  const [state, setState] = useState({ loading: true, error: '' });
  const [tournaments, setTournaments] = useState([]);
  useEffect(() => { fetchTournaments().then((data) => { setTournaments(data.tournaments); setState({ loading: false, error: '' }); }).catch((error) => setState({ loading: false, error: error.message })); }, []);
  return (
    <section className="page-section workspace-page">
      <div className="page-kicker">Competition directory</div>
      <h1>Tournaments</h1>
      <p>Explore live EVOQ registration windows and tournament details.</p>
      {state.loading && <p className="status-panel">Loading tournaments...</p>}
      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {!state.loading && !state.error && tournaments.length === 0 && <p className="empty-state">No tournaments available.</p>}
      <div className="tournament-grid">
        {tournaments.map((tournament) => <Link className="tournament-item" to={`/tournaments/${tournament.id}`} key={tournament.id}>
          <span className="tournament-status">{tournament.status.replaceAll('_', ' ')}</span>
          <h2>{tournament.name}</h2>
          <p>{tournament.description || 'Tournament details are available inside.'}</p>
          <span>{tournament.entryType === 'PAID' ? `Entry fee ${tournament.entryFee}` : 'Free entry'}</span>
        </Link>)}
      </div>
    </section>
  );
}
