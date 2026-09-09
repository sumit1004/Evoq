import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchPlayers } from '../../services/playerProfileApi.js';
import { normalizeApiError } from '../../services/apiClient.js';

export function FindPlayerPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError('');
      setSearched(true);
      const data = await searchPlayers(query.trim());
      setResults(data || []);
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-container">
      <div className="profile-panel-head">
        <div>
          <h2>Find Esports Players</h2>
          <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Look up players across the EVOQ platform by their permanent EVOQ ID (e.g. EVQ-XXXXXXXXXXXX) or name.
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="search-input-box">
        <input
          type="text"
          placeholder="Enter EVOQ ID, player name, or in-game IGN..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="button primary-button" disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="dashboard-error">
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="dashboard-skeleton skeleton-wide" style={{ height: '80px' }} />
          <div className="dashboard-skeleton skeleton-wide" style={{ height: '80px' }} />
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div className="dashboard-empty" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <strong style={{ color: '#f6f8fb', display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
            No players found
          </strong>
          <p style={{ color: '#8b949e', margin: 0 }}>
            No public profiles matched &quot;{query}&quot;. Verify the EVOQ ID or player name.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="search-results-list">
          <span style={{ fontSize: '0.8rem', color: '#8b949e', fontWeight: 600 }}>
            Found {results.length} public profile{results.length > 1 ? 's' : ''}
          </span>
          {results.map((player) => (
            <div key={player.uniquePlayerId} className="player-search-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="profile-avatar-wrapper" style={{ width: '54px', height: '54px', fontSize: '1.4rem' }}>
                  {player.avatarUrl ? (
                    <img src={player.avatarUrl} alt={player.name} className="profile-avatar-img" />
                  ) : (
                    player.name?.slice(0, 1).toUpperCase() || 'P'
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1.05rem', color: '#f6f8fb' }}>{player.name}</strong>
                    {player.inGameName && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>({player.inGameName})</span>}
                  </div>

                  <div className="profile-evoq-id-badge" style={{ marginTop: '2px', fontSize: '0.75rem' }}>
                    <span>{player.uniquePlayerId}</span>
                  </div>

                  <div className="profile-meta-tags" style={{ marginTop: '4px' }}>
                    {player.primaryGame && <span className="badge-tag game">{player.primaryGame}</span>}
                    {player.primaryRole && <span className="badge-tag role">{player.primaryRole}</span>}
                    {player.currentTeam && <span className="badge-tag team">Team: {player.currentTeam}</span>}
                    {player.country && <span className="badge-tag exp">{player.country}</span>}
                  </div>
                </div>
              </div>

              <Link
                to={`/player/${player.uniquePlayerId}`}
                className="button secondary-button"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                View Profile →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
