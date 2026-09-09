import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteOrgBannerApi,
  deleteOrgLogoApi,
  fetchMyOrganization,
  updateMyOrganization,
  uploadOrgBannerApi,
  uploadOrgLogoApi,
} from '../../services/organizationApi.js';
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
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchMyOrganization();
      setOrgId(data.id);
      setVerified(Boolean(data.verified));
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Only PNG, JPEG, and WEBP logo images are allowed');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image file size must be 2MB or less');
      return;
    }

    try {
      setUploadingLogo(true);
      setError('');
      const updated = await uploadOrgLogoApi(file);
      setFormData((prev) => ({ ...prev, logoUrl: updated.logoUrl }));
      setSuccess('Organization logo updated successfully.');
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    if (!window.confirm('Remove organization logo?')) return;
    try {
      setUploadingLogo(true);
      setError('');
      const updated = await deleteOrgLogoApi();
      setFormData((prev) => ({ ...prev, logoUrl: updated.logoUrl || '' }));
      setSuccess('Organization logo removed.');
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Only PNG, JPEG, and WEBP banner images are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Cover banner file size must be 5MB or less');
      return;
    }

    try {
      setUploadingBanner(true);
      setError('');
      const updated = await uploadOrgBannerApi(file);
      setFormData((prev) => ({ ...prev, coverUrl: updated.coverUrl }));
      setSuccess('Organization banner updated successfully.');
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleBannerRemove = async () => {
    if (!window.confirm('Remove organization cover banner?')) return;
    try {
      setUploadingBanner(true);
      setError('');
      const updated = await deleteOrgBannerApi();
      setFormData((prev) => ({ ...prev, coverUrl: updated.coverUrl || '' }));
      setSuccess('Cover banner removed.');
    } catch (err) {
      const norm = normalizeApiError(err);
      setError(norm.message);
    } finally {
      setUploadingBanner(false);
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
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="page-kicker">Organization Management</div>
            <h1>Organization Profile</h1>
            <p>Customize your public organization identity, branding, and tournament presence.</p>
          </div>
          {orgId && (
            <Link className="button secondary-button" to={publicLink} target="_blank">
              Preview Public Profile ↗
            </Link>
          )}
        </div>
      </div>

      {/* Compact Identity Preview Header */}
      <div className="org-header-preview">
        <div className="org-logo-preview-box" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
          {formData.logoUrl ? (
            <img src={formData.logoUrl} alt={formData.name} />
          ) : (
            formData.name ? formData.name.slice(0, 1).toUpperCase() : 'O'
          )}
        </div>
        <div className="org-identity">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ fontSize: '1.2rem', color: '#f6f8fb' }}>{formData.name || 'Organization'}</strong>
            {verified && <span className="org-verified-badge">Verified</span>}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#8b949e', marginTop: '2px' }}>
            Tournament Organizer · {[formData.city, formData.country].filter(Boolean).join(', ') || 'Global'}
            {formData.foundedYear ? ` · Est. ${formData.foundedYear}` : ''}
          </div>
        </div>
        {orgId && (
          <Link className="button secondary-button" to={publicLink} style={{ minHeight: '34px', fontSize: '0.82rem' }}>
            Preview Public Profile
          </Link>
        )}
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

      {/* Real Statistics Grid */}
      {stats && (
        <div className="org-stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="org-stat-card">
            <strong>{stats.totalTournaments}</strong>
            <span>Total Tournaments</span>
          </div>
          <div className="org-stat-card">
            <strong>{stats.completedTournaments || 0}</strong>
            <span>Completed</span>
          </div>
          <div className="org-stat-card stat-live">
            <strong>{stats.liveTournaments}</strong>
            <span>Live Tourneys</span>
          </div>
          <div className="org-stat-card">
            <strong>{stats.upcomingTournaments || 0}</strong>
            <span>Upcoming</span>
          </div>
          <div className="org-stat-card stat-players">
            <strong>{stats.uniquePlayers}</strong>
            <span>Unique Players</span>
          </div>
          <div className="org-stat-card stat-teams">
            <strong>{stats.uniqueTeams}</strong>
            <span>Unique Teams</span>
          </div>
          <div className="org-stat-card">
            <strong>{stats.totalRegistrations || 0}</strong>
            <span>Registrations</span>
          </div>
        </div>
      )}

      <form className="org-settings-form" onSubmit={handleSubmit}>
        {/* SECTION 1: PROFILE IDENTITY */}
        <div className="org-section-card">
          <h2>Profile Identity</h2>
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
              <small style={{ color: '#8b949e', fontSize: '0.75rem' }}>
                Letters, numbers, and hyphens only (e.g. /organization/my-org)
              </small>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="org-desc">Short Description (Tagline)</label>
            <input
              id="org-desc"
              name="description"
              type="text"
              placeholder="e.g. Premier Esports League & Tournament Organizer"
              value={formData.description}
              onChange={handleChange}
              maxLength={255}
            />
          </div>

          <div className="org-form-grid">
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

          <div className="field-group">
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
        </div>

        {/* SECTION 2: BRANDING */}
        <div className="org-section-card">
          <h2>Branding</h2>
          <div className="org-branding-grid">
            {/* Logo Upload Box */}
            <div className="org-upload-tile">
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f6f8fb' }}>Organization Logo</span>
              <div className="org-logo-preview-box">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Organization logo" />
                ) : (
                  formData.name ? formData.name.slice(0, 1).toUpperCase() : 'L'
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button secondary-button"
                  style={{ fontSize: '0.8rem', minHeight: '30px', padding: '0 10px' }}
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Uploading...' : formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </button>
                {formData.logoUrl && (
                  <button
                    type="button"
                    className="text-button danger-text"
                    style={{ fontSize: '0.8rem' }}
                    onClick={handleLogoRemove}
                    disabled={uploadingLogo}
                  >
                    Remove
                  </button>
                )}
              </div>
              <small style={{ color: '#8b949e', fontSize: '0.75rem' }}>PNG, JPG, WEBP (Max 2MB)</small>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Banner Upload Box */}
            <div className="org-upload-tile">
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f6f8fb' }}>Cover Banner</span>
              <div className="org-banner-preview-box">
                {formData.coverUrl ? (
                  <img src={formData.coverUrl} alt="Organization banner" />
                ) : (
                  <span>No banner uploaded</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button secondary-button"
                  style={{ fontSize: '0.8rem', minHeight: '30px', padding: '0 10px' }}
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                >
                  {uploadingBanner ? 'Uploading...' : formData.coverUrl ? 'Change Banner' : 'Upload Banner'}
                </button>
                {formData.coverUrl && (
                  <button
                    type="button"
                    className="text-button danger-text"
                    style={{ fontSize: '0.8rem' }}
                    onClick={handleBannerRemove}
                    disabled={uploadingBanner}
                  >
                    Remove
                  </button>
                )}
              </div>
              <small style={{ color: '#8b949e', fontSize: '0.75rem' }}>PNG, JPG, WEBP (Max 5MB · Wide banner recommended)</small>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleBannerUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: ABOUT */}
        <div className="org-section-card">
          <h2>About Organization</h2>
          <div className="field-group">
            <textarea
              id="org-about"
              name="about"
              rows={4}
              placeholder="Tell players and teams about your organization history, hosted esports titles, and competitive vision..."
              value={formData.about}
              onChange={handleChange}
              maxLength={3000}
              style={{ width: '100%', background: '#0b0f17', border: '1px solid #1f2937', borderRadius: '4px', color: '#f6f8fb', padding: '0.75rem' }}
            />
          </div>
        </div>

        {/* SECTION 4: PUBLIC LINKS */}
        <div className="org-section-card">
          <h2>Public Links & Socials</h2>
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

          <div className="org-form-grid">
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
        </div>

        {/* SECTION 5: DISCOVERY */}
        <div className="org-section-card">
          <h2>Discovery</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              id="org-public"
              name="isPublic"
              type="checkbox"
              checked={formData.isPublic}
              onChange={handleChange}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="org-public" style={{ margin: 0, color: '#f6f8fb', cursor: 'pointer', fontSize: '0.95rem' }}>
              Show organization in public discovery directory
            </label>
          </div>
        </div>

        <div>
          <button className="button primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Organization Profile'}
          </button>
        </div>
      </form>
    </section>
  );
}

