import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchPublicOrganizations } from '../../services/organizationApi.js';
import { openDirectConversation } from '../../services/directMessageApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { normalizeApiError } from '../../services/apiClient.js';

export function OrganizationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const navigate = useNavigate();
  const { identity } = useAuth();

  const [organizations, setOrganizations] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messagingOrgId, setMessagingOrgId] = useState(null);

  const loadOrganizations = useCallback(async (query) => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchPublicOrganizations({ search: query, limit: 30 });
      setOrganizations(data.organizations || []);
      setTotal(data.total || 0);
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations(initialSearch);
  }, [initialSearch, loadOrganizations]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchParams(searchInput.trim() ? { search: searchInput.trim() } : {});
  };

  const handleMessageOrganization = async (orgId) => {
    if (!identity) {
      navigate(`/login?redirect=/organizations`);
      return;
    }

    try {
      setMessagingOrgId(orgId);
      const result = await openDirectConversation({ organizationId: orgId });
      navigate(`/player/messages/${result.conversation.id}`);
    } catch (err) {
      const norm = normalizeApiError(err);
      alert(norm.message || 'Unable to open conversation');
    } finally {
      setMessagingOrgId(null);
    }
  };

  return (
    <section className="workspace-page organizations-page">
      <div className="organizations-hero">
        <div className="page-kicker">Esports Ecosystem</div>
        <h1>Organizations</h1>
        <p>Explore verified esports organizers, tournament hosts, and gaming organizations.</p>

        <form className="organizations-search-bar" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search by organization name, game, or country..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button className="button primary-button" type="submit">
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="dashboard-error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => loadOrganizations(initialSearch)}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="dashboard-empty" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: '#94a3b8' }}>Loading organizations...</p>
        </div>
      )}

      {!loading && organizations.length === 0 && (
        <div className="dashboard-empty" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <strong style={{ display: 'block', fontSize: '1.1rem', color: '#f6f8fb', marginBottom: '0.5rem' }}>
            No organizations found
          </strong>
          <p style={{ color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1rem' }}>
            {initialSearch
              ? `No organizations matched "${initialSearch}". Try a different keyword.`
              : 'There are currently no public organizations available.'}
          </p>
          {initialSearch && (
            <button
              className="button secondary-button"
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchParams({});
              }}
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {!loading && organizations.length > 0 && (
        <>
          <div style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
            Showing {organizations.length} of {total} organizations
          </div>

          <div className="organizations-grid">
            {organizations.map((org) => {
              const profileLink = `/organization/${org.slug || org.id}`;
              const isMessaging = messagingOrgId === org.id;

              return (
                <article key={org.id} className="organization-card">
                  <div className="org-card-header">
                    <div className="org-card-logo">
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} />
                      ) : (
                        (org.name || 'O').slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="org-card-meta">
                      <h2 className="org-card-name">
                        <Link to={profileLink} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {org.name}
                        </Link>
                        {org.verified && <span className="org-verified-badge">Verified</span>}
                      </h2>
                      <div className="org-card-location">
                        {org.city && org.country ? `${org.city}, ${org.country}` : org.country || 'Global'}
                        {org.foundedYear && ` • Est. ${org.foundedYear}`}
                      </div>
                    </div>
                  </div>

                  <p className="org-card-desc">
                    {org.description || 'Competitive tournament host and esports community organization.'}
                  </p>

                  <div className="org-card-stats">
                    <div className="org-stat-item">
                      <strong>{org.stats.totalTournaments}</strong>
                      <span>Tournaments</span>
                    </div>
                    <div className="org-stat-item live">
                      <strong>{org.stats.liveTournaments}</strong>
                      <span>Live</span>
                    </div>
                    <div className="org-stat-item">
                      <strong>{org.stats.upcomingTournaments}</strong>
                      <span>Upcoming</span>
                    </div>
                  </div>

                  <div className="org-card-actions">
                    <Link className="button secondary-button" to={profileLink}>
                      View Profile
                    </Link>
                    <button
                      className="button primary-button"
                      type="button"
                      onClick={() => handleMessageOrganization(org.id)}
                      disabled={isMessaging}
                    >
                      {isMessaging ? 'Opening...' : 'Message'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
