import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createTournament, deleteTournament, fetchOrganizerTournaments } from '../../services/tournamentApi.js';

const initialForm = {
  name: '',
  description: '',
  game: 'Free Fire',
  tournamentDate: '',
  registrationStartAt: '',
  registrationEndAt: '',
  maxTeams: 12,
  playersPerTeam: 4,
  entryType: 'FREE',
  entryFee: 0,
  paymentMethod: 'MANUAL_UPI',
  upiId: '',
  paymentQr: null,
  paymentInstructions: '',
};

export function OrganizerTournamentsPage() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmTournament, setDeleteConfirmTournament] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'DRAFT' | 'REGISTRATION_OPEN' | 'LIVE' | 'COMPLETED'
  const [state, setState] = useState({ loading: true, submitting: false, error: '', notice: '' });

  async function loadTournaments() {
    try {
      const result = await fetchOrganizerTournaments();
      setTournaments(result.tournaments || []);
      setState((current) => ({ ...current, loading: false }));
    } catch (error) {
      setState({ loading: false, submitting: false, error: error.message || 'Failed to load tournaments', notice: '' });
    }
  }

  useEffect(() => {
    loadTournaments();
  }, []);

  function handleFormChange(e) {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      setForm((prev) => ({ ...prev, [name]: files?.[0] || null }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleCreateTournament(e) {
    e.preventDefault();
    setState((current) => ({ ...current, submitting: true, error: '', notice: '' }));
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        game: form.game.trim() || 'Free Fire',
        maxTeams: Number(form.maxTeams) || 12,
        playersPerTeam: Number(form.playersPerTeam) || 4,
        entryFee: form.entryType === 'FREE' ? 0 : Number(form.entryFee) || 0,
      };

      const result = await createTournament(payload);
      setTournaments((current) => [result.tournament, ...current]);
      setForm(initialForm);
      setShowCreateModal(false);
      setState({
        loading: false,
        submitting: false,
        error: '',
        notice: `Tournament "${result.tournament.name}" created successfully as DRAFT.`,
      });
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error.message }));
    }
  }

  async function handleDeleteTournament() {
    if (!deleteConfirmTournament) return;
    setState((current) => ({ ...current, submitting: true, error: '', notice: '' }));
    try {
      await deleteTournament(deleteConfirmTournament.id);
      setTournaments((current) => current.filter((t) => t.id !== deleteConfirmTournament.id));
      const deletedName = deleteConfirmTournament.name;
      setDeleteConfirmTournament(null);
      setState({
        loading: false,
        submitting: false,
        error: '',
        notice: `Tournament "${deletedName}" and its associated rounds and groups were permanently deleted.`,
      });
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error.message }));
    }
  }

  // Filtered tournaments
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.game?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'DRAFT' && t.status === 'DRAFT') ||
        (statusFilter === 'REGISTRATION_OPEN' && t.status === 'REGISTRATION_OPEN') ||
        (statusFilter === 'REGISTRATION_CLOSED' && t.status === 'REGISTRATION_CLOSED') ||
        (statusFilter === 'LIVE' && t.status === 'LIVE') ||
        (statusFilter === 'COMPLETED' && t.status === 'COMPLETED');

      return matchesSearch && matchesStatus;
    });
  }, [tournaments, searchQuery, statusFilter]);

  // Operational metrics
  const stats = useMemo(() => {
    const total = tournaments.length;
    const live = tournaments.filter((t) => t.status === 'LIVE').length;
    const regOpen = tournaments.filter((t) => t.status === 'REGISTRATION_OPEN').length;
    const draft = tournaments.filter((t) => t.status === 'DRAFT').length;
    const completed = tournaments.filter((t) => t.status === 'COMPLETED').length;
    return { total, live, regOpen, draft, completed };
  }, [tournaments]);

  return (
    <section className="workspace-page" style={{ maxWidth: '1200px' }}>
      {/* Top Breadcrumb & Kicker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#91a0b3', marginBottom: '8px' }}>
        <Link className="text-link" to="/organizer">Organizer</Link>
        <span>/</span>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>Tournaments</span>
      </div>

      {/* Hero Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(28, 33, 40, 0.95), rgba(13, 17, 23, 0.98))',
          border: '1px solid rgba(125, 211, 252, 0.15)',
          borderRadius: '12px',
          padding: '24px 28px',
          marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '320px',
            height: '100%',
            background: 'radial-gradient(circle at 100% 0%, rgba(125, 211, 252, 0.08), transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(125, 211, 252, 0.1)', padding: '4px 10px', borderRadius: '20px', marginBottom: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7dd3fc', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Organizer Tournament Console
              </span>
            </div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.8rem, 2.4rem, 2.8rem)', color: '#fff', fontWeight: 800 }}>
              Tournaments
            </h1>
            <p style={{ margin: 0, color: '#91a0b3', fontSize: '14px', maxWidth: '640px', lineHeight: 1.5 }}>
              Create, configure, monitor brackets, manage registrations, and operate live competitive esports tournaments.
            </p>
          </div>

          <button
            className="button primary-button"
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 'bold',
              boxShadow: '0 4px 16px rgba(125, 211, 252, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            type="button"
            onClick={() => setShowCreateModal(true)}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Create Tournament
          </button>
        </div>

        {/* Stats Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 600 }}>Total Tournaments</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{stats.total}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 600 }}>Live (In-Progress)</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: stats.live > 0 ? '#2ecc71' : '#fff', marginTop: '2px' }}>{stats.live}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 600 }}>Registration Open</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: stats.regOpen > 0 ? '#7dd3fc' : '#fff', marginTop: '2px' }}>{stats.regOpen}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 600 }}>Drafts</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#91a0b3', marginTop: '2px' }}>{stats.draft}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#91a0b3', textTransform: 'uppercase', fontWeight: 600 }}>Completed</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f6c453', marginTop: '2px' }}>{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {state.error && <div className="form-alert" role="alert" style={{ marginBottom: '20px' }}>{state.error}</div>}
      {state.notice && <div className="success-alert" role="status" style={{ marginBottom: '20px' }}>{state.notice}</div>}

      {/* Search & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: 'rgba(28, 33, 40, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '24px',
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${stats.total})` },
            { id: 'LIVE', label: `Live (${stats.live})` },
            { id: 'REGISTRATION_OPEN', label: `Open (${stats.regOpen})` },
            { id: 'DRAFT', label: `Draft (${stats.draft})` },
            { id: 'COMPLETED', label: `Completed (${stats.completed})` },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`button ${active ? 'primary-button' : 'ghost-button'}`}
                style={{
                  minHeight: '34px',
                  padding: '0 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                }}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ width: 'min(280px, 100%)', position: 'relative' }}>
          <input
            style={{
              width: '100%',
              minHeight: '36px',
              background: '#0d1117',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#fff',
              padding: '0 12px',
              fontSize: '13px',
            }}
            placeholder="Search tournament name, game..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 0,
                color: '#91a0b3',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tournaments Grid */}
      {state.loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#91a0b3' }}>
          Loading tournaments...
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div
          style={{
            background: 'rgba(28, 33, 40, 0.4)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px' }}>
            {searchQuery || statusFilter !== 'ALL' ? 'No tournaments match your filter' : 'No tournaments created yet'}
          </h3>
          <p style={{ color: '#91a0b3', fontSize: '14px', margin: '0 0 20px 0' }}>
            {searchQuery || statusFilter !== 'ALL'
              ? 'Try resetting your search query or status filter.'
              : 'Create your first tournament to start accepting registrations and running brackets.'}
          </p>
          {searchQuery || statusFilter !== 'ALL' ? (
            <button
              className="button ghost-button"
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          ) : (
            <button
              className="button primary-button"
              type="button"
              onClick={() => setShowCreateModal(true)}
            >
              + Create Tournament
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredTournaments.map((tournament) => {
            const registered = Number(tournament.registeredTeams || 0);
            const maxTeams = Number(tournament.maxTeams || 12);
            const fillPercent = maxTeams > 0 ? Math.min(100, Math.round((registered / maxTeams) * 100)) : 0;

            const isDraft = tournament.status === 'DRAFT';
            const isLive = tournament.status === 'LIVE';
            const isCompleted = tournament.status === 'COMPLETED';
            const isRegOpen = tournament.status === 'REGISTRATION_OPEN';

            return (
              <div
                key={tournament.id}
                style={{
                  background: 'linear-gradient(180deg, rgba(28, 33, 40, 0.85), rgba(20, 24, 30, 0.95))',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(125, 211, 252, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#7dd3fc',
                          background: 'rgba(125, 211, 252, 0.12)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {tournament.game || 'Free Fire'}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: tournament.entryType === 'PAID' ? '#f6c453' : '#2ecc71',
                          background: tournament.entryType === 'PAID' ? 'rgba(246, 196, 83, 0.1)' : 'rgba(46, 204, 113, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {tournament.entryType === 'PAID' ? `₹${tournament.entryFee}` : 'Free Entry'}
                      </span>
                    </div>

                    <span
                      className={`status-badge ${tournament.status.toLowerCase().replaceAll('_', '-')}`}
                      style={{ fontSize: '11px', padding: '3px 9px' }}
                    >
                      {tournament.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  {/* Tournament Title */}
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#fff', fontWeight: 700, lineHeight: 1.3 }}>
                    <Link
                      to={`/organizer/tournaments/${tournament.id}`}
                      style={{ color: '#fff', textDecoration: 'none' }}
                      onMouseEnter={(e) => (e.target.style.color = '#7dd3fc')}
                      onMouseLeave={(e) => (e.target.style.color = '#fff')}
                    >
                      {tournament.name}
                    </Link>
                  </h3>

                  {/* Description */}
                  <p
                    style={{
                      margin: '0 0 16px 0',
                      color: '#91a0b3',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {tournament.description || 'Tournament management and operations workspace.'}
                  </p>

                  {/* Operational Details Grid */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <div style={{ color: '#91a0b3' }}>Format</div>
                      <strong style={{ color: '#cdd6e2' }}>{tournament.playersPerTeam} Players / Team</strong>
                    </div>
                    <div>
                      <div style={{ color: '#91a0b3' }}>Tournament Date</div>
                      <strong style={{ color: '#cdd6e2' }}>
                        {tournament.tournamentDate
                          ? new Date(tournament.tournamentDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'TBD'}
                      </strong>
                    </div>
                  </div>

                  {/* Registration Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#91a0b3', marginBottom: '6px' }}>
                      <span>Team Capacity:</span>
                      <strong style={{ color: fillPercent >= 100 ? '#f6c453' : '#7dd3fc' }}>
                        {registered} / {maxTeams} Teams ({fillPercent}%)
                      </strong>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '4px',
                        height: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${fillPercent}%`,
                          background: fillPercent >= 100 ? '#f6c453' : '#7dd3fc',
                          height: '100%',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    <Link
                      className="button primary-button"
                      style={{ flex: 1, minHeight: '36px', fontSize: '13px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      to={`/organizer/tournaments/${tournament.id}`}
                    >
                      Open Hub →
                    </Link>
                    <Link
                      className="button ghost-button"
                      style={{ minHeight: '36px', padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center' }}
                      to={`/organizer/tournaments/${tournament.id}/registrations`}
                    >
                      Registrations
                    </Link>
                  </div>

                  {/* Delete Button */}
                  <button
                    className="button ghost-button danger-text"
                    style={{
                      minHeight: '36px',
                      padding: '0 10px',
                      fontSize: '12px',
                      borderColor: 'rgba(239, 68, 68, 0.25)',
                    }}
                    type="button"
                    title="Delete tournament"
                    onClick={() => setDeleteConfirmTournament(tournament)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE TOURNAMENT MODAL */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div
            style={{
              background: '#161b22',
              border: '1px solid rgba(125, 211, 252, 0.25)',
              borderRadius: '12px',
              padding: '28px',
              width: 'min(640px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Create New Tournament</h2>
                <span style={{ fontSize: '12px', color: '#91a0b3' }}>Configure basic details, dates, format, and entry model</span>
              </div>
              <button
                className="button ghost-button"
                type="button"
                style={{ fontSize: '18px', padding: '4px 10px', minHeight: '32px' }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTournament} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Basic Information */}
              <div>
                <label htmlFor="modal-t-name" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Tournament Name *</label>
                <input
                  id="modal-t-name"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. EVOQ Championship Season 1"
                  required
                  style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="modal-t-game" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Game Title</label>
                  <input
                    id="modal-t-game"
                    name="game"
                    value={form.game}
                    onChange={handleFormChange}
                    placeholder="e.g. Free Fire, BGMI"
                    style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                  />
                </div>
                <div>
                  <label htmlFor="modal-t-date" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Tournament Date</label>
                  <input
                    id="modal-t-date"
                    name="tournamentDate"
                    type="datetime-local"
                    value={form.tournamentDate}
                    onChange={handleFormChange}
                    style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-t-desc" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Description</label>
                <textarea
                  id="modal-t-desc"
                  name="description"
                  rows="3"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Official tournament details, guidelines, rules, and schedule overview..."
                  style={{ width: '100%', minHeight: '70px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '10px 12px' }}
                />
              </div>

              {/* Registration Windows */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="modal-t-reg-start" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Registration Starts *</label>
                  <input
                    id="modal-t-reg-start"
                    name="registrationStartAt"
                    type="datetime-local"
                    value={form.registrationStartAt}
                    onChange={handleFormChange}
                    required
                    style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                  />
                </div>
                <div>
                  <label htmlFor="modal-t-reg-end" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Registration Ends *</label>
                  <input
                    id="modal-t-reg-end"
                    name="registrationEndAt"
                    type="datetime-local"
                    value={form.registrationEndAt}
                    onChange={handleFormChange}
                    required
                    style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                  />
                </div>
              </div>

              {/* Format & Capacity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="modal-t-max-teams" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Max Teams</label>
                  <input
                    id="modal-t-max-teams"
                    name="maxTeams"
                    type="number"
                    min="2"
                    max="512"
                    value={form.maxTeams}
                    onChange={handleFormChange}
                    required
                    style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                  />
                </div>
                <div>
                  <label htmlFor="modal-t-players-team" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Players per Team</label>
                  <input
                    id="modal-t-players-team"
                    name="playersPerTeam"
                    type="number"
                    min="1"
                    max="10"
                    value={form.playersPerTeam}
                    onChange={handleFormChange}
                    required
                    style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                  />
                </div>
              </div>

              {/* Entry & Payment Details */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label htmlFor="modal-t-entry-type" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Entry Model</label>
                    <select
                      id="modal-t-entry-type"
                      name="entryType"
                      value={form.entryType}
                      onChange={handleFormChange}
                      style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 10px' }}
                    >
                      <option value="FREE">Free Entry</option>
                      <option value="PAID">Paid Entry</option>
                    </select>
                  </div>
                  {form.entryType === 'PAID' && (
                    <div>
                      <label htmlFor="modal-t-entry-fee" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Entry Fee (₹) *</label>
                      <input
                        id="modal-t-entry-fee"
                        name="entryFee"
                        type="number"
                        min="1"
                        step="1"
                        value={form.entryFee}
                        onChange={handleFormChange}
                        required
                        style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                      />
                    </div>
                  )}
                </div>

                {form.entryType === 'PAID' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label htmlFor="modal-t-pay-method" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Payment Method</label>
                        <select
                          id="modal-t-pay-method"
                          name="paymentMethod"
                          value={form.paymentMethod}
                          onChange={handleFormChange}
                          style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 10px' }}
                        >
                          <option value="MANUAL_UPI">Manual UPI (Direct QR / ID)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="modal-t-upi-id" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>UPI ID *</label>
                        <input
                          id="modal-t-upi-id"
                          name="upiId"
                          placeholder="e.g. organizer@upi"
                          value={form.upiId}
                          onChange={handleFormChange}
                          required
                          style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '0 12px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="modal-t-pay-qr" style={{ display: 'block', fontSize: '12px', color: '#91a0b3', marginBottom: '4px', fontWeight: 600 }}>Optional Payment QR Code Image</label>
                      <input
                        id="modal-t-pay-qr"
                        name="paymentQr"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFormChange}
                        style={{ width: '100%', minHeight: '38px', background: '#0d1117', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', color: '#fff', padding: '6px 10px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  className="button ghost-button"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="button primary-button"
                  type="submit"
                  disabled={state.submitting}
                  style={{ minWidth: '140px' }}
                >
                  {state.submitting ? 'Creating...' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE TOURNAMENT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirmTournament && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmTournament(null);
          }}
        >
          <div
            style={{
              background: '#1c2128',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '28px',
              width: 'min(480px, 100%)',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#ef4444', fontSize: '20px' }}>Delete Tournament</h3>
            </div>

            <p style={{ color: '#cdd6e2', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to permanently delete <strong>"{deleteConfirmTournament.name}"</strong>?
            </p>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '13px',
                color: '#fca5a5',
                lineHeight: 1.5,
                marginBottom: '20px',
              }}
            >
              <strong>Warning:</strong> This will permanently delete all rounds, groups, scheduled matches, results, and registrations associated with this tournament. This action cannot be reversed.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="button ghost-button"
                type="button"
                onClick={() => setDeleteConfirmTournament(null)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                type="button"
                onClick={handleDeleteTournament}
                disabled={state.submitting}
                style={{ minWidth: '140px' }}
              >
                {state.submitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
