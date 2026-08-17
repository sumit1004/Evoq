import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPlayerDashboard } from '../../services/playerApi.js';

function Status({ value }) {
  return (
    <span className={`dashboard-status status-${String(value || '').toLowerCase().replaceAll('_', '-')}`}>
      {String(value || 'UNKNOWN').replaceAll('_', ' ')}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="dashboard-skeleton skeleton-wide" aria-hidden="true">
      <span /><span /><span />
    </div>
  );
}

function TournamentCard({ tournament }) {
  return (
    <article className="dashboard-tournament my-tournament-card">
      <div className="tournament-accent" />
      <div className="dashboard-tournament-top">
        <Status value={tournament.status} />
        <span>{tournament.registrationStatus}</span>
      </div>
      <h2 className="my-tournament-name">{tournament.name}</h2>
      {tournament.teamName && (
        <p className="my-tournament-meta">
          <span>Team: <strong>{tournament.teamName}</strong></span>
          {tournament.currentRound && <span> · {tournament.currentRound}</span>}
          {tournament.currentGroup && <span> · {tournament.currentGroup}</span>}
        </p>
      )}
      <Link
        className="text-arrow"
        to={`/player/communications/${tournament.id}`}
        aria-label={`Open tournament: ${tournament.name}`}
      >
        Open tournament <span>↗</span>
      </Link>
    </article>
  );
}

function TournamentSection({ title, kicker, tournaments }) {
  if (!tournaments.length) return null;
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <div>
          <span className="section-label">{kicker}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="dashboard-tournament-list">
        {tournaments.map((t) => (
          <TournamentCard key={t.id} tournament={t} />
        ))}
      </div>
    </section>
  );
}

export function MyTournamentsPage() {
  const [tournaments, setTournaments] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const dashboard = await fetchPlayerDashboard();
      setTournaments(dashboard.activeTournaments || []);
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Unable to load your tournaments.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = tournaments.filter(
    (t) => t.status === 'LIVE' || t.status === 'REGISTRATION_OPEN' || t.status === 'REGISTRATION_CLOSED',
  );
  const upcoming = tournaments.filter(
    (t) => t.status === 'UPCOMING' || t.status === 'DRAFT',
  );
  const completed = tournaments.filter((t) => t.status === 'COMPLETED');

  if (state.loading) {
    return (
      <section className="dashboard-page">
        <div className="page-kicker">Competition</div>
        <h1>My Tournaments</h1>
        <Skeleton />
        <Skeleton />
      </section>
    );
  }

  return (
    <section className="dashboard-page">
      <div className="my-tournaments-header">
        <div>
          <div className="page-kicker">Competition</div>
          <h1>My Tournaments</h1>
          <p>Tournaments you are participating in with your registered teams.</p>
        </div>
        <Link className="button secondary-button" to="/tournaments">
          Browse tournaments
        </Link>
      </div>

      {state.error && (
        <div className="form-alert" role="alert">
          {state.error}
          <button className="text-button" type="button" onClick={load} style={{ marginLeft: '1rem' }}>
            Retry
          </button>
        </div>
      )}

      {!state.error && tournaments.length === 0 && (
        <div className="dashboard-section">
          <div className="dashboard-empty">
            <p>You are not participating in any tournaments yet.</p>
            <Link className="button secondary-button" to="/tournaments">
              Browse available tournaments
            </Link>
          </div>
        </div>
      )}

      {!state.error && (
        <>
          <TournamentSection title="Active &amp; open" kicker="Live now" tournaments={active} />
          <TournamentSection title="Upcoming" kicker="Coming soon" tournaments={upcoming} />
          <TournamentSection title="Completed" kicker="Archived" tournaments={completed} />
        </>
      )}
    </section>
  );
}
