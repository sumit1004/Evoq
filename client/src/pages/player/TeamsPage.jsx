import { useEffect, useRef, useState } from 'react';
import {
  createTeam,
  deleteTeamLogoApi,
  fetchTeams,
  removeTeam,
  uploadTeamLogoApi,
} from '../../services/teamApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

const initialForm = { name: '', memberPlayerIds: '' };

export function TeamsPage() {
  const { identity } = useAuth();
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState('');
  const fileInputRef = useRef(null);
  const [state, setState] = useState({ loading: true, submitting: false, error: '', fields: {}, notice: '' });
  const [actionTeamId, setActionTeamId] = useState(null);

  async function loadTeams() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      setTeams(await fetchTeams());
      setState((current) => ({ ...current, loading: false }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  useEffect(() => {
    loadTeams();
  }, []);

  function handleLogoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Supported formats: PNG, JPG/JPEG, WEBP');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Maximum logo file size is 2MB');
      return;
    }

    setLogoError('');
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  function handleRemoveSelectedLogo() {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setState((current) => ({ ...current, error: '', notice: '', fields: { ...current.fields, [name]: '' } }));
  }

  async function submit(event) {
    event.preventDefault();
    const memberPlayerIds = form.memberPlayerIds.split(/[\n,]/).map((id) => id.trim()).filter(Boolean);
    const validation = {};
    if (form.name.trim().length < 2) validation.name = 'Team name must be between 2 and 120 characters';
    const normalizedIds = memberPlayerIds.map((id) => id.toUpperCase());
    if (new Set(normalizedIds).size !== normalizedIds.length) validation.memberPlayerIds = 'Player IDs must be unique';
    if (Object.keys(validation).length > 0) {
      setState((current) => ({ ...current, error: 'Please correct the highlighted fields.', fields: validation }));
      return;
    }

    setState((current) => ({ ...current, submitting: true, error: '', notice: '', fields: {} }));
    try {
      let team = await createTeam({ name: form.name, memberPlayerIds });

      if (logoFile) {
        try {
          team = await uploadTeamLogoApi(team.id, logoFile);
        } catch (logoErr) {
          console.error('Failed to upload logo for new team', logoErr);
        }
      }

      setTeams((current) => [team, ...current]);
      setForm(initialForm);
      handleRemoveSelectedLogo();
      setState((current) => ({ ...current, submitting: false, notice: `${team.name} was created.` }));
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error.message, fields: error.details?.body || {} }));
    }
  }

  async function handleInlineLogoUpload(teamId, file) {
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setState((current) => ({ ...current, error: 'Supported logo formats: PNG, JPG/JPEG, WEBP' }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setState((current) => ({ ...current, error: 'Maximum logo file size is 2MB' }));
      return;
    }

    setActionTeamId(teamId);
    try {
      const updated = await uploadTeamLogoApi(teamId, file);
      setTeams((current) => current.map((item) => (item.id === teamId ? updated : item)));
      setState((current) => ({ ...current, notice: 'Team logo updated successfully.', error: '' }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || 'Failed to update logo' }));
    } finally {
      setActionTeamId(null);
    }
  }

  async function handleInlineLogoRemove(teamId) {
    if (!window.confirm('Remove team logo?')) return;
    setActionTeamId(teamId);
    try {
      const updated = await deleteTeamLogoApi(teamId);
      setTeams((current) => current.map((item) => (item.id === teamId ? updated : item)));
      setState((current) => ({ ...current, notice: 'Team logo removed.', error: '' }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || 'Failed to remove logo' }));
    } finally {
      setActionTeamId(null);
    }
  }

  async function deleteTeam(team) {
    if (team.ownerId !== identity?.id || !window.confirm(`Delete ${team.name}?`)) return;
    try {
      await removeTeam(team.id);
      setTeams((current) => current.filter((item) => item.id !== team.id));
      setState((current) => ({ ...current, notice: `${team.name} was deleted.`, error: '' }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message, notice: '' }));
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-kicker">Team management</div>
      <h1>Your teams</h1>
      <p>Create reusable teams from registered EVOQ player IDs. Teams can be selected for tournaments later.</p>
      {state.error && <div className="form-alert" role="alert">{state.error}</div>}
      {state.notice && <div className="success-alert" role="status">{state.notice}</div>}
      <div className="teams-layout">
        <form className="team-form" onSubmit={submit} noValidate>
          <h2>Create a team</h2>

          <label htmlFor="team-name">Team name *</label>
          <input id="team-name" name="name" value={form.name} onChange={updateField} aria-invalid={Boolean(state.fields.name)} />
          {state.fields.name && <span className="field-error">{state.fields.name}</span>}

          {/* Optional Team Logo Upload */}
          <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#f6f8fb' }}>
              Team Logo <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>(Optional · Recommended square image)</span>
            </label>

            {logoPreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                <img
                  src={logoPreview}
                  alt="Team logo preview"
                  style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #30363d' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="button secondary-button"
                    style={{ minHeight: '30px', fontSize: '0.78rem', padding: '0 10px' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Logo
                  </button>
                  <button
                    type="button"
                    className="text-button danger-text"
                    style={{ fontSize: '0.78rem' }}
                    onClick={handleRemoveSelectedLogo}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="button secondary-button"
                  style={{ minHeight: '34px', fontSize: '0.82rem', padding: '0 12px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Logo
                </button>
                <span style={{ fontSize: '0.78rem', color: '#8b949e' }}>PNG, JPG, WEBP (Max 2MB)</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoSelect}
              style={{ display: 'none' }}
            />
            {logoError && <span className="field-error" style={{ display: 'block', marginTop: '4px' }}>{logoError}</span>}
          </div>

          <label htmlFor="team-members">Member player IDs <span>(optional, one per line)</span></label>
          <textarea id="team-members" name="memberPlayerIds" rows="5" value={form.memberPlayerIds} onChange={updateField} aria-invalid={Boolean(state.fields.memberPlayerIds)} />
          {state.fields.memberPlayerIds && <span className="field-error">{state.fields.memberPlayerIds}</span>}
          <button className="button primary-button" type="submit" disabled={state.submitting}>{state.submitting ? 'Creating team...' : 'Create team'}</button>
        </form>

        <div className="team-list" aria-live="polite">
          <h2>Existing teams</h2>
          {state.loading && <p className="status-panel">Loading teams...</p>}
          {!state.loading && teams.length === 0 && <p className="empty-state">No teams created yet.</p>}
          {!state.loading && teams.map((team) => (
            <article className="team-item" key={team.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                {team.logoUrl ? (
                  <img
                    src={team.logoUrl}
                    alt={team.name}
                    style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #30363d', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      background: 'rgba(240, 246, 252, 0.08)',
                      border: '1px solid rgba(240, 246, 252, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      color: '#f6f8fb',
                      flexShrink: 0,
                    }}
                  >
                    {team.name ? team.name.slice(0, 1).toUpperCase() : 'T'}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f6f8fb' }}>{team.name}</h3>
                  <p style={{ margin: '4px 0 8px', fontSize: '0.85rem', color: '#8b949e' }}>
                    {team.members.length} member{team.members.length === 1 ? '' : 's'} · Owner: {team.ownerName || 'You'}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#c9d1d9' }}>
                    {team.members.map((member) => (
                      <li key={member.id} style={{ marginBottom: '2px' }}>
                        {member.name} <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>({member.uniquePlayerId})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {team.ownerId === identity?.id && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', borderTop: '1px solid rgba(240, 246, 252, 0.06)', paddingTop: '0.5rem' }}>
                  <label
                    className="text-button"
                    style={{ fontSize: '0.78rem', cursor: actionTeamId === team.id ? 'wait' : 'pointer' }}
                  >
                    {actionTeamId === team.id ? 'Uploading...' : team.logoUrl ? 'Change Logo' : 'Upload Logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleInlineLogoUpload(team.id, e.target.files?.[0])}
                      style={{ display: 'none' }}
                      disabled={actionTeamId === team.id}
                    />
                  </label>

                  {team.logoUrl && (
                    <button
                      className="text-button"
                      type="button"
                      style={{ fontSize: '0.78rem', color: '#8b949e' }}
                      onClick={() => handleInlineLogoRemove(team.id)}
                      disabled={actionTeamId === team.id}
                    >
                      Remove Logo
                    </button>
                  )}

                  <button
                    className="text-button danger-text"
                    type="button"
                    style={{ fontSize: '0.78rem', marginLeft: 'auto' }}
                    onClick={() => deleteTeam(team)}
                  >
                    Delete Team
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

