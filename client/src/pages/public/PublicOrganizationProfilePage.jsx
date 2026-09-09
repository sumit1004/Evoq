import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchPublicOrganizationProfile,
  fetchOrganizationTournaments,
} from '../../services/organizationApi.js';
import { openDirectConversation } from '../../services/directMessageApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { normalizeApiError } from '../../services/apiClient.js';

export function PublicOrganizationProfilePage() {
  const { idOrSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ALL';

  const navigate = useNavigate();
  const { identity } = useAuth();

  const [organization, setOrganization] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [totalTournaments, setTotalTournaments] = useState(0);

  const [loadingOrg, setLoadingOrg] = useState(true);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [error, setError] = useState('');
  const [messaging, setMessaging] = useState(false);

  // 1. Load Organization Profile
  const loadProfile = useCallback(async () => {
    try {
      setLoadingOrg(true);
      setError('');
      const data = await fetchPublicOrganizationProfile(idOrSlug);
      setOrganization(data);
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setLoadingOrg(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 2. Load Tournaments for Active Tab
  const loadTournaments = useCallback(async (tab) => {
    try {
      setLoadingTournaments(true);
      const data = await fetchOrganizationTournaments(idOrSlug, { status: tab, limit: 30 });
      setTournaments(data.tournaments || []);
      setTotalTournaments(data.total || 0);
    } catch (err) {
      console.error('Failed to load org tournaments', err);
    } finally {
      setLoadingTournaments(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    if (organization) {
      loadTournaments(activeTab);
    }
  }, [organization, activeTab, loadTournaments]);

  const handleTabChange = (tab) => {
    setSearchParams(tab === 'ALL' ? {} : { tab });
  };

  const handleMessage = async () => {
    if (!identity) {
      navigate(`/login?redirect=/organization/${idOrSlug}`);
      return;
    }

    if (!organization) return;

    try {
      setMessaging(true);
      const result = await openDirectConversation({ organizationId: organization.id });
      navigate(`/player/messages/${result.conversation.id}`);
    } catch (err) {
      const norm = normalizeApiError(err);
      alert(norm.message || 'Unable to open conversation');
    } finally {
      setMessaging(false);
    }
  };

  if (loadingOrg) {
    return (
      <section className="workspace-page" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8' }}>Loading organization profile...</p>
      </section>
    );
  }

  if (error || !organization) {
    return (
      <section className="workspace-page" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div className="dashboard-error" role="alert" style={{ maxWidth: '500px', margin: '0 auto 1.5rem' }}>
          <span>{error || 'Organization not found'}</span>
        </div>
        <Link className="button secondary-button" to="/organizations">
          Back to Organizations
        </Link>
      </section>
    );
  }

  const { stats } = organization;

  return (
    <section className="workspace-page organizations-page">
      <div style={{ marginBottom: '1rem' }}>
        <Link className="text-link" to="/organizations">
          ← Back to Organizations
        </Link>
      </div>

      {/* Organization Hero / Header */}
      <div className="org-profile-hero">
        <div className="org-cover-image">
          {organization.coverUrl && <img src={organization.coverUrl} alt={`${organization.name} Cover`} />}
        </div>

        <div className="org-profile-body">
          <div className="org-profile-top-row">
            <div className="org-profile-logo">
              {organization.logoUrl ? (
                <img src={organization.logoUrl} alt={organization.name} />
              ) : (
                (organization.name || 'O').slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="org-profile-actions">
              <button
                className="button primary-button"
                type="button"
                onClick={handleMessage}
                disabled={messaging}
              >
                {messaging ? 'Opening Chat...' : 'Message Organization'}
              </button>
            </div>
          </div>

          <div className="org-profile-info">
            <h1>
              {organization.name}
              {organization.verified && <span className="org-verified-badge">Verified</span>}
            </h1>

            <div className="org-profile-subhead">
              {organization.country && (
                <span>
                  Location: {organization.city ? `${organization.city}, ` : ''}{organization.country}
                </span>
              )}
              {organization.foundedYear && <span>Founded: {organization.foundedYear}</span>}
              {organization.slug && <span style={{ color: '#60a5fa' }}>@{organization.slug}</span>}
            </div>

            {organization.description && (
              <p className="org-profile-desc">{organization.description}</p>
            )}

            {organization.about && (
              <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <strong style={{ display: 'block', color: '#f6f8fb', marginBottom: '0.25rem' }}>About</strong>
                <p style={{ margin: 0 }}>{organization.about}</p>
              </div>
            )}

            {/* Social Links */}
            {(organization.websiteUrl || organization.discordUrl || organization.twitterUrl || organization.instagramUrl) && (
              <div className="org-social-links">
                {organization.websiteUrl && (
                  <a
                    className="org-social-link"
                    href={organization.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Website
                  </a>
                )}
                {organization.discordUrl && (
                  <a
                    className="org-social-link"
                    href={organization.discordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Discord
                  </a>
                )}
                {organization.twitterUrl && (
                  <a
                    className="org-social-link"
                    href={organization.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Twitter / X
                  </a>
                )}
                {organization.instagramUrl && (
                  <a
                    className="org-social-link"
                    href={organization.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Authoritative Live Statistics */}
      <h2 style={{ fontSize: '1.2rem', color: '#f6f8fb', marginBottom: '1rem', fontWeight: 700 }}>
        Organization Statistics
      </h2>
      <div className="org-stats-grid">
        <div className="org-stat-card">
          <strong>{stats.totalTournaments}</strong>
          <span>Total Tournaments</span>
        </div>
        <div className="org-stat-card stat-live">
          <strong>{stats.liveTournaments}</strong>
          <span>Live Tournaments</span>
        </div>
        <div className="org-stat-card">
          <strong>{stats.upcomingTournaments}</strong>
          <span>Upcoming</span>
        </div>
        <div className="org-stat-card">
          <strong>{stats.completedTournaments}</strong>
          <span>Completed</span>
        </div>
        <div className="org-stat-card">
          <strong>{stats.totalRegistrations}</strong>
          <span>Registrations</span>
        </div>
        <div className="org-stat-card stat-players">
          <strong>{stats.uniquePlayers}</strong>
          <span>Unique Players</span>
        </div>
        <div className="org-stat-card stat-teams">
          <strong>{stats.uniqueTeams}</strong>
          <span>Unique Teams</span>
        </div>
      </div>

      {/* Tournaments Catalog */}
      <div className="org-tournaments-section">
        <div className="org-tournaments-header">
          <h2>Hosted Tournaments</h2>

          <div className="org-tabs">
            {['ALL', 'LIVE', 'UPCOMING', 'COMPLETED'].map((tab) => (
              <button
                key={tab}
                className={`org-tab-btn ${activeTab === tab ? 'active' : ''}`}
                type="button"
                onClick={() => handleTabChange(tab)}
              >
                {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {loadingTournaments && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            Loading tournaments...
          </div>
        )}

        {!loadingTournaments && tournaments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
            <strong style={{ display: 'block', color: '#f6f8fb', marginBottom: '0.25rem' }}>
              No tournaments found in this category
            </strong>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>
              Check other tabs or come back later for new tournament announcements.
            </p>
          </div>
        )}

        {!loadingTournaments && tournaments.length > 0 && (
          <div className="organizations-grid">
            {tournaments.map((t) => (
              <article key={t.id} className="organization-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>
                    {t.game}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      background:
                        t.status === 'LIVE'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : t.status === 'COMPLETED'
                          ? 'rgba(100, 116, 139, 0.2)'
                          : 'rgba(59, 130, 246, 0.15)',
                      color:
                        t.status === 'LIVE'
                          ? '#ef4444'
                          : t.status === 'COMPLETED'
                          ? '#94a3b8'
                          : '#60a5fa',
                    }}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', color: '#f6f8fb', margin: '0 0 0.5rem 0', fontWeight: 700 }}>
                  <Link to={`/tournaments/${t.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {t.name}
                  </Link>
                </h3>

                <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                  {t.description ? `${t.description.slice(0, 100)}...` : 'Official tournament hosted on EVOQ.'}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', borderTop: '1px solid #1f2937', paddingTop: '0.75rem' }}>
                  <span>Teams: {t.verifiedRegistrations}/{t.maxTeams}</span>
                  <span>{t.entryType === 'FREE' ? 'Free Entry' : `$${t.entryFee}`}</span>
                </div>

                <Link className="button secondary-button" to={`/tournaments/${t.id}`} style={{ textAlign: 'center' }}>
                  View Tournament
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
