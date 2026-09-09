import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyOrganization, updateMyOrganization } from '../../services/organizationApi.js';
import { normalizeApiError } from '../../services/apiClient.js';

export function OrganizerOrganizationSettingsPage() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    about: '',
    logoUrl: '',
    coverUrl: '',
    country: '',
    city: '',
    foundedYear: new Date().getFullYear(),
    websiteUrl: '',
    discordUrl: '',
    twitterUrl: '',
    instagramUrl: '',
    isPublic: true,
  });

  const [stats, setStats] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchMyOrganization();
      setOrgId(data.id);
      setStats(data.stats);
      setFormData({
        name: data.name || '',
        slug: data.slug || '',
        description: data.description || '',
        about: data.about || '',
        logoUrl: data.logoUrl || '',
        coverUrl: data.coverUrl || '',
        country: data.country || '',
        city: data.city || '',
        foundedYear: data.foundedYear || new Date().getFullYear(),
        websiteUrl: data.websiteUrl || '',
        discordUrl: data.discordUrl || '',
        twitterUrl: data.twitterUrl || '',
        instagramUrl: data.instagramUrl || '',
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
      });
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const payload = {
        ...formData,
        foundedYear: formData.foundedYear ? Number(formData.foundedYear) : null,
      };
      const updated = await updateMyOrganization(payload);
      setSuccess('Organization profile updated successfully.');
      if (updated.slug) {
        setFormData((prev) => ({ ...prev, slug: updated.slug }));
      }
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="workspace-page">
        <p style={{ color: '#94a3b8' }}>Loading organization settings...</p>
      </section>
    );
  }

  const publicLink = `/organization/${formData.slug || orgId}`;

  return (
    <section className="workspace-page">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="page-kicker">Organization Management</div>
            <h1>Organization Profile</h1>
            <p>Customize your public organization page, branding, and tournament identity.</p>
          </div>
          {orgId && (
            <Link className="button secondary-button" to={publicLink} target="_blank">
              Preview Public Profile ↗
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="dashboard-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="dashboard-success" role="status" style={{ marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <span>{success}</span>
        </div>
      )}

      {stats && (
        <div className="org-stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="org-stat-card">
            <strong>{stats.totalTournaments}</strong>
            <span>Total Tournaments</span>
          </div>
          <div className="org-stat-card stat-live">
            <strong>{stats.liveTournaments}</strong>
            <span>Live Tournaments</span>
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
      )}

      <form className="org-settings-form" onSubmit={handleSubmit}>
        <div className="org-form-grid">
          <div className="field-group">
            <label htmlFor="org-name">Organization Name *</label>
            <input
              id="org-name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              maxLength={180}
            />
          </div>

          <div className="field-group">
            <label htmlFor="org-slug">Custom URL Slug</label>
            <input
              id="org-slug"
              name="slug"
              type="text"
              placeholder="e.g. cloud9-esports"
              value={formData.slug}
              onChange={handleChange}
              maxLength={80}
            />
            <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
              Letters, numbers, and hyphens only (e.g. /organization/my-org)
            </small>
          </div>
        </div>

        <div className="field-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="org-desc">Short Description (Tagline)</label>
          <input
            id="org-desc"
            name="description"
            type="text"
            placeholder="e.g. Premier South Asian Esports League & Tournament Organizer"
            value={formData.description}
            onChange={handleChange}
            maxLength={255}
          />
        </div>

        <div className="field-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="org-about">About the Organization</label>
          <textarea
            id="org-about"
            name="about"
            rows={4}
            placeholder="Tell players and teams about your organization history, vision, and hosted games..."
            value={formData.about}
            onChange={handleChange}
            maxLength={3000}
            style={{ width: '100%', background: '#0b0e14', border: '1px solid #2d3748', borderRadius: '4px', color: '#f6f8fb', padding: '0.75rem' }}
          />
        </div>

        <div className="org-form-grid" style={{ marginTop: '1rem' }}>
          <div className="field-group">
            <label htmlFor="org-logo">Logo Image URL</label>
            <input
              id="org-logo"
              name="logoUrl"
              type="url"
              placeholder="https://example.com/logo.png"
              value={formData.logoUrl}
              onChange={handleChange}
              maxLength={500}
            />
          </div>

          <div className="field-group">
            <label htmlFor="org-cover">Cover Banner Image URL</label>
            <input
              id="org-cover"
              name="coverUrl"
              type="url"
              placeholder="https://example.com/banner.jpg"
              value={formData.coverUrl}
              onChange={handleChange}
              maxLength={500}
            />
          </div>
        </div>

        <div className="org-form-grid" style={{ marginTop: '1rem' }}>
          <div className="field-group">
            <label htmlFor="org-country">Country / Region</label>
            <input
              id="org-country"
              name="country"
              type="text"
              placeholder="e.g. India"
              value={formData.country}
              onChange={handleChange}
              maxLength={100}
            />
          </div>

          <div className="field-group">
            <label htmlFor="org-city">City</label>
            <input
              id="org-city"
              name="city"
              type="text"
              placeholder="e.g. Mumbai"
              value={formData.city}
              onChange={handleChange}
              maxLength={100}
            />
          </div>
        </div>

        <div className="field-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="org-year">Founded Year</label>
          <input
            id="org-year"
            name="foundedYear"
            type="number"
            min={1970}
            max={new Date().getFullYear()}
            value={formData.foundedYear}
            onChange={handleChange}
            style={{ maxWidth: '180px' }}
          />
        </div>

        <h3 style={{ fontSize: '1rem', color: '#f6f8fb', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
          Official Links & Socials
        </h3>

        <div className="org-form-grid">
          <div className="field-group">
            <label htmlFor="org-website">Website URL</label>
            <input
              id="org-website"
              name="websiteUrl"
              type="url"
              placeholder="https://myesports.gg"
              value={formData.websiteUrl}
              onChange={handleChange}
              maxLength={255}
            />
          </div>

          <div className="field-group">
            <label htmlFor="org-discord">Discord Invite URL</label>
            <input
              id="org-discord"
              name="discordUrl"
              type="url"
              placeholder="https://discord.gg/myorg"
              value={formData.discordUrl}
              onChange={handleChange}
              maxLength={255}
            />
          </div>
        </div>

        <div className="org-form-grid" style={{ marginTop: '1rem' }}>
          <div className="field-group">
            <label htmlFor="org-twitter">Twitter / X URL</label>
            <input
              id="org-twitter"
              name="twitterUrl"
              type="url"
              placeholder="https://twitter.com/myorg"
              value={formData.twitterUrl}
              onChange={handleChange}
              maxLength={255}
            />
          </div>

          <div className="field-group">
            <label htmlFor="org-instagram">Instagram URL</label>
            <input
              id="org-instagram"
              name="instagramUrl"
              type="url"
              placeholder="https://instagram.com/myorg"
              value={formData.instagramUrl}
              onChange={handleChange}
              maxLength={255}
            />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            id="org-public"
            name="isPublic"
            type="checkbox"
            checked={formData.isPublic}
            onChange={handleChange}
          />
          <label htmlFor="org-public" style={{ margin: 0, color: '#f6f8fb', cursor: 'pointer' }}>
            List organization publicly in discovery directory
          </label>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <button className="button primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Organization Profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
