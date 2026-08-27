import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchTournaments } from '../../services/tournamentApi.js';
import { DirectoryLayoutWrapper } from '../../components/DirectoryLayoutWrapper.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function TournamentsPage() {
  const { identity } = useAuth();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [entryType, setEntryType] = useState('');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);

  // Data State
  const [tournaments, setTournaments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [state, setState] = useState({ loading: true, error: '' });

  // Debouncing Search Input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 4000); // 400ms debounce
    return () => clearTimeout(handler);
  }, [search]);

  // Load Tournaments
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const result = await fetchTournaments({
        search: debouncedSearch || undefined,
        status: status || undefined,
        entryType: entryType || undefined,
        sort,
        page,
        limit: 12
      });
      setTournaments(result.tournaments || []);
      setPagination(result.pagination || { page: 1, totalPages: 1, total: 0 });
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, [debouncedSearch, status, entryType, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setEntryType('');
    setSort('default');
    setPage(1);
  };

  // Render Status Badge
  const renderStatusBadge = (statusValue) => {
    const labels = {
      DRAFT: 'Draft',
      REGISTRATION_OPEN: 'Registration Open',
      REGISTRATION_CLOSED: 'Registration Closed',
      LIVE: 'Ongoing Live',
      COMPLETED: 'Completed'
    };
    const badgeClass = statusValue.toLowerCase().replaceAll('_', '-');
    return (
      <span className={`status-badge ${badgeClass}`}>
        {labels[statusValue] || statusValue}
      </span>
    );
  };

  // Render Player Registration State Action Block
  const renderCardAction = (t) => {
    if (!identity) {
      return (
        <Link className="button primary-button card-action-btn" to={`/tournaments/${t.id}`}>
          View Tournament
        </Link>
      );
    }

    if (identity.role === 'ORGANIZER') {
      return (
        <Link className="button primary-button card-action-btn" to={`/organizer/tournaments/${t.id}`}>
          Open Tournament →
        </Link>
      );
    }

    // Player Actions
    switch (t.playerRegistrationStatus) {
      case 'VERIFIED':
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="registered-badge">
              ✓ Registered
            </span>
            <Link className="button primary-button card-action-btn" to={`/player/communications/${t.id}`}>
              Open Tournament →
            </Link>
          </div>
        );
      case 'PENDING':
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="registered-badge pending">
              ● Pending Review
            </span>
            <Link className="button secondary-button card-action-btn" to={`/player/communications/${t.id}`}>
              Open Tournament
            </Link>
          </div>
        );
      case 'REJECTED':
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link className="button primary-button card-action-btn danger" to={`/tournaments/${t.id}`}>
              Fix Registration
            </Link>
            <Link className="button secondary-button card-action-btn" to={`/player/communications/${t.id}`}>
              Open Tournament
            </Link>
          </div>
        );
      default:
        // NONE or CANCELLED
        if (t.status === 'REGISTRATION_OPEN') {
          return (
            <Link className="button primary-button card-action-btn" to={`/tournaments/${t.id}`}>
              Register Now
            </Link>
          );
        }
        return (
          <Link className="button secondary-button card-action-btn" to={`/tournaments/${t.id}`}>
            View Details
          </Link>
        );
    }
  };

  const isFiltered = debouncedSearch || status || entryType || sort !== 'default';

  return (
    <DirectoryLayoutWrapper>
      <section className="tournaments-directory-container">
        
        {/* Localized Styles for Premium Discovery Page */}
        <style>{`
          .tournaments-directory-container {
            max-width: 1200px;
            margin: 0 auto;
            font-family: inherit;
          }
          .directory-header {
            margin-bottom: 30px;
          }
          .directory-header h1 {
            font-size: 36px;
            margin: 5px 0;
            font-weight: 800;
            color: #fff;
          }
          .directory-header p {
            color: #91a0b3;
            margin: 0;
            font-size: 15px;
          }
          
          /* Filters Layout */
          .filter-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 30px;
            align-items: center;
          }
          .filter-input {
            flex: 1 1 240px;
            min-height: 42px;
            background: #0d1117;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 4px;
            padding: 0 12px;
            color: #fff;
            font-size: 14px;
          }
          .filter-input:focus {
            outline: 2px solid #7dd3fc;
            outline-offset: 1px;
          }
          .filter-select {
            min-height: 42px;
            background: #0d1117;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 4px;
            padding: 0 10px;
            color: #fff;
            font-size: 14px;
          }
          .filter-select:focus {
            outline: 2px solid #7dd3fc;
          }
          
          /* Cards Grid */
          .tournaments-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 24px;
            margin-bottom: 40px;
          }
          .tourney-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 8px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            transition: transform 0.2s, border-color 0.2s;
            position: relative;
            min-height: 280px;
          }
          .tourney-card:hover {
            transform: translateY(-2px);
            border-color: rgba(125, 211, 252, 0.4);
          }
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            gap: 10px;
          }
          
          /* Status pill styling */
          .status-badge {
            display: inline-flex;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .status-badge.draft { background: rgba(255,255,255,0.1); color: #ccc; }
          .status-badge.registration-open { background: rgba(46, 204, 113, 0.15); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); }
          .status-badge.registration-closed { background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); }
          .status-badge.live { background: rgba(243, 156, 18, 0.15); color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.3); }
          .status-badge.completed { background: rgba(149, 165, 166, 0.15); color: #95a5a6; border: 1px solid rgba(149, 165, 166, 0.3); }

          .tourney-card h2 {
            font-size: 20px;
            color: #fff;
            margin: 0 0 8px 0;
            line-height: 1.3;
          }
          .tourney-desc {
            font-size: 14px;
            color: #91a0b3;
            margin: 0 0 15px 0;
            flex-grow: 1;
            line-height: 1.5;
          }
          .card-details {
            border-top: 1px solid rgba(255,255,255,0.06);
            padding-top: 15px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            font-size: 13px;
          }
          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .detail-item span {
            color: #91a0b3;
          }
          .detail-item strong {
            color: #fff;
          }
          
          /* Slots Visual Track */
          .slots-container {
            grid-column: span 2;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .slots-bar {
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            overflow: hidden;
          }
          .slots-fill {
            height: 100%;
            background: #7dd3fc;
            border-radius: 3px;
          }
          
          .card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-top: auto;
          }
          .entry-badge {
            font-weight: 700;
            color: #fff;
            font-size: 15px;
          }
          .entry-badge.free {
            color: #2ecc71;
          }
          .card-action-btn {
            min-height: 38px;
            font-size: 13px;
            padding: 0 16px;
          }
          .card-action-btn.danger {
            background: #e74c3c;
            color: #fff;
          }
          .registered-badge {
            display: inline-flex;
            align-items: center;
            font-size: 13px;
            font-weight: 700;
            color: #2ecc71;
            background: rgba(46, 204, 113, 0.1);
            padding: 6px 12px;
            border-radius: 4px;
            border: 1px solid rgba(46, 204, 113, 0.2);
          }
          .registered-badge.pending {
            color: #f39c12;
            background: rgba(243, 156, 18, 0.1);
            border-color: rgba(243, 156, 18, 0.2);
          }
          
          /* Skeletons */
          .skeleton-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.04);
            border-radius: 8px;
            height: 280px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .shimmer {
            background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 100%);
            background-size: 200% 100%;
            animation: loading-shimmer 1.5s infinite;
          }
          @keyframes loading-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          
          /* Pagination Layout */
          .pagination-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin-top: 30px;
          }
          
          /* Responsive Layout */
          @media (max-width: 600px) {
            .filter-bar {
              flex-direction: column;
              align-items: stretch;
            }
            .tournaments-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        {/* Directory Header */}
        <div className="directory-header">
          <div className="page-kicker">Competition Directory</div>
          <h1>Tournaments</h1>
          <p>Find tournaments, check registration status, and join upcoming competitions.</p>
        </div>

        {/* Filters Toolbar */}
        <div className="filter-bar">
          <input
            className="filter-input"
            aria-label="Search tournaments"
            placeholder="Search tournaments by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="filter-select"
            aria-label="Status filter"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="REGISTRATION_OPEN">Registration Open</option>
            <option value="LIVE">Live / Ongoing</option>
            <option value="REGISTRATION_CLOSED">Registration Closed</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            className="filter-select"
            aria-label="Entry type filter"
            value={entryType}
            onChange={(e) => { setEntryType(e.target.value); setPage(1); }}
          >
            <option value="">All Entry Types</option>
            <option value="FREE">Free</option>
            <option value="PAID">Paid</option>
          </select>

          <select
            className="filter-select"
            aria-label="Sort order"
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
          >
            <option value="default">Default Priority</option>
            <option value="newest">Newest First</option>
            <option value="closing_soon">Closing Soon</option>
            <option value="date_soonest">Tournament Date</option>
          </select>

          {isFiltered && (
            <button className="button ghost-button" style={{ minHeight: '42px', fontSize: '13px' }} type="button" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {/* Error Notification */}
        {state.error && (
          <div style={{ padding: '15px', background: 'rgba(231,76,60,0.1)', border: '1px solid #e74c3c', borderRadius: '6px', marginBottom: '20px' }}>
            <p style={{ color: '#e74c3c', margin: '0 0 10px 0' }}>Unable to load tournaments: {state.error}</p>
            <button className="button primary-button" style={{ minHeight: '38px', fontSize: '13px' }} type="button" onClick={load}>Retry</button>
          </div>
        )}

        {/* Loading Skeletons */}
        {state.loading && (
          <div className="tournaments-grid">
            {[1, 2, 3].map(i => (
              <div className="skeleton-card" key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div className="shimmer" style={{ width: '80px', height: '20px', borderRadius: '4px' }} />
                  <div className="shimmer" style={{ width: '60px', height: '20px', borderRadius: '4px' }} />
                </div>
                <div className="shimmer" style={{ width: '80%', height: '24px', borderRadius: '4px', marginTop: '20px' }} />
                <div className="shimmer" style={{ width: '100%', height: '40px', borderRadius: '4px', marginTop: '10px' }} />
                <div className="shimmer" style={{ width: '100%', height: '50px', borderRadius: '4px', marginTop: '20px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <div className="shimmer" style={{ width: '70px', height: '24px', borderRadius: '4px' }} />
                  <div className="shimmer" style={{ width: '100px', height: '38px', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List Content */}
        {!state.loading && !state.error && (
          <>
            {tournaments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>No tournaments available</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#91a0b3' }}>
                  {isFiltered 
                    ? 'There are currently no tournaments matching your filters.' 
                    : 'There are currently no tournaments published on the platform.'
                  }
                </p>
                {isFiltered && (
                  <button className="button primary-button" type="button" onClick={handleClearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="tournaments-grid">
                {tournaments.map((t) => {
                  const slotsPercent = Math.min(100, Math.round(((t.registeredTeams || 0) / t.maxTeams) * 100));
                  return (
                    <article className="tourney-card" key={t.id}>
                      <div>
                        <div className="card-header">
                          {renderStatusBadge(t.status)}
                          <span style={{ fontSize: '12px', color: '#91a0b3' }}>
                            {t.playersPerTeam} Players / Team
                          </span>
                        </div>
                        
                        <h2>{t.name}</h2>
                        <p className="tourney-desc">
                          {t.description || 'Details and stage rounds are available inside.'}
                        </p>
                      </div>

                      <div>
                        <div className="card-details">
                          <div className="detail-item">
                            <span>Date</span>
                            <strong>
                              {t.tournamentDate 
                                ? new Date(t.tournamentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'TBD'
                              }
                            </strong>
                          </div>
                          
                          <div className="detail-item">
                            <span>Registration Ends</span>
                            <strong>
                              {new Date(t.registrationEndAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </strong>
                          </div>

                          <div className="detail-item slots-container">
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Teams Registered</span>
                              <strong>
                                {t.registeredTeams} / {t.maxTeams} {t.registeredTeams >= t.maxTeams && '(FULL)'}
                              </strong>
                            </div>
                            <div className="slots-bar">
                              <div className="slots-fill" style={{ width: `${slotsPercent}%`, background: t.registeredTeams >= t.maxTeams ? '#e74c3c' : '#7dd3fc' }} />
                            </div>
                          </div>
                        </div>

                        <div className="card-footer">
                          <span className={`entry-badge ${t.entryType === 'FREE' ? 'free' : ''}`}>
                            {t.entryType === 'FREE' ? 'Free Entry' : `₹${t.entryFee} Entry`}
                          </span>
                          {renderCardAction(t)}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  className="button secondary-button"
                  style={{ minHeight: '42px', padding: '0 15px' }}
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span style={{ fontSize: '14px', color: '#91a0b3' }}>
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  className="button secondary-button"
                  style={{ minHeight: '42px', padding: '0 15px' }}
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

      </section>
    </DirectoryLayoutWrapper>
  );
}
