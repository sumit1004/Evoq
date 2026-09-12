import { pool } from '../config/database.js';

/**
 * Lists public organizations with basic stats and search filter.
 */
export async function listPublicOrganizations({ search = '', limit = 20, offset = 0 } = {}, connection = pool) {
  const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 50);
  const safeOffset = Math.max(Number(offset || 0), 0);
  const conditions = ['o.is_public = TRUE'];
  const params = [];

  if (search && search.trim()) {
    conditions.push('(o.name LIKE ? OR o.slug LIKE ? OR o.description LIKE ? OR o.country LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const [rows] = await connection.query(
    `SELECT 
       o.id,
       o.name,
       o.slug,
       o.description,
       o.logo_url,
       o.cover_url,
       o.country,
       o.city,
       o.founded_year,
       o.verified,
       o.created_at,
       (SELECT COUNT(*) FROM tournaments t WHERE t.organization_id = o.id OR t.organizer_id = o.owner_id) AS total_tournaments,
       (SELECT COUNT(*) FROM tournaments t WHERE (t.organization_id = o.id OR t.organizer_id = o.owner_id) AND t.status = 'LIVE') AS live_tournaments,
       (SELECT COUNT(*) FROM tournaments t WHERE (t.organization_id = o.id OR t.organizer_id = o.owner_id) AND t.status IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED')) AS upcoming_tournaments,
       (SELECT COUNT(*) FROM tournaments t WHERE (t.organization_id = o.id OR t.organizer_id = o.owner_id) AND t.status = 'COMPLETED') AS completed_tournaments
     FROM organizations o
     WHERE ${conditions.join(' AND ')}
     ORDER BY o.verified DESC, total_tournaments DESC, o.name ASC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset],
  );

  const [totalRows] = await connection.query(
    `SELECT COUNT(*) AS total FROM organizations o WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return {
    organizations: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      logoUrl: r.logo_url,
      coverUrl: r.cover_url,
      country: r.country,
      city: r.city,
      foundedYear: r.founded_year,
      verified: Boolean(r.verified),
      createdAt: r.created_at,
      stats: {
        totalTournaments: Number(r.total_tournaments || 0),
        liveTournaments: Number(r.live_tournaments || 0),
        upcomingTournaments: Number(r.upcoming_tournaments || 0),
        completedTournaments: Number(r.completed_tournaments || 0),
      },
    })),
    total: Number(totalRows[0]?.total || 0),
  };
}

/**
 * Finds a public organization by numeric ID or URL slug.
 */
export async function findPublicOrganizationByIdOrSlug(idOrSlug, connection = pool) {
  const isNumeric = /^\d+$/.test(String(idOrSlug).trim());
  const condition = isNumeric ? 'o.id = ?' : 'o.slug = ?';
  const param = isNumeric ? Number(idOrSlug) : String(idOrSlug).trim();

  const [rows] = await connection.query(
    `SELECT 
       o.id,
       o.name,
       o.slug,
       o.description,
       o.about,
       o.logo_url,
       o.cover_url,
       o.country,
       o.city,
       o.founded_year,
       o.website_url,
       o.discord_url,
       o.twitter_url,
       o.instagram_url,
       o.is_public,
       o.verified,
       o.created_at,
       o.owner_id,
       u.name AS owner_name
     FROM organizations o
     JOIN users u ON u.id = o.owner_id
     WHERE ${condition} AND o.is_public = TRUE
     LIMIT 1`,
    [param],
  );

  if (!rows[0]) return null;
  const r = rows[0];

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    about: r.about,
    logoUrl: r.logo_url,
    coverUrl: r.cover_url,
    country: r.country,
    city: r.city,
    foundedYear: r.founded_year,
    websiteUrl: r.website_url,
    discordUrl: r.discord_url,
    twitterUrl: r.twitter_url,
    instagramUrl: r.instagram_url,
    isPublic: Boolean(r.is_public),
    verified: Boolean(r.verified),
    createdAt: r.created_at,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
  };
}

/**
 * Computes live, accurate organization statistics from source data.
 */
export async function getOrganizationStatistics(organizationId, ownerId, connection = pool) {
  const orgId = Number(organizationId);
  const ownId = Number(ownerId);

  // 1. Tournament Counts
  const [tournamentCounts] = await connection.query(
    `SELECT 
       COUNT(*) AS total_tournaments,
       SUM(CASE WHEN status = 'LIVE' THEN 1 ELSE 0 END) AS live_tournaments,
       SUM(CASE WHEN status IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED') THEN 1 ELSE 0 END) AS upcoming_tournaments,
       SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_tournaments
     FROM tournaments
     WHERE organization_id = ? OR organizer_id = ?`,
    [orgId, ownId],
  );

  // 2. Total Registrations & Unique Teams
  const [regStats] = await connection.query(
    `SELECT 
       COUNT(r.id) AS total_registrations,
       COUNT(DISTINCT r.team_id) AS unique_teams
     FROM registrations r
     JOIN tournaments t ON t.id = r.tournament_id
     WHERE (t.organization_id = ? OR t.organizer_id = ?) AND r.status = 'VERIFIED'`,
    [orgId, ownId],
  );

  // 3. Unique Players (distinct users who participated in verified registrations)
  const [playerStats] = await connection.query(
    `SELECT COUNT(DISTINCT tm.user_id) AS unique_players
     FROM team_members tm
     JOIN registrations r ON r.team_id = tm.team_id AND r.status = 'VERIFIED'
     JOIN tournaments t ON t.id = r.tournament_id
     WHERE t.organization_id = ? OR t.organizer_id = ?`,
    [orgId, ownId],
  );

  const t = tournamentCounts[0] || {};
  const reg = regStats[0] || {};
  const p = playerStats[0] || {};

  return {
    totalTournaments: Number(t.total_tournaments || 0),
    liveTournaments: Number(t.live_tournaments || 0),
    upcomingTournaments: Number(t.upcoming_tournaments || 0),
    completedTournaments: Number(t.completed_tournaments || 0),
    totalRegistrations: Number(reg.total_registrations || 0),
    uniqueTeams: Number(reg.unique_teams || 0),
    uniquePlayers: Number(p.unique_players || 0),
  };
}

/**
 * Returns tournaments hosted by the organization with status filter.
 */
export async function getOrganizationTournaments(organizationId, ownerId, { status = 'ALL', limit = 20, offset = 0 } = {}, connection = pool) {
  const orgId = Number(organizationId);
  const ownId = Number(ownerId);
  const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 50);
  const safeOffset = Math.max(Number(offset || 0), 0);

  const conditions = ['(t.organization_id = ? OR t.organizer_id = ?)'];
  const params = [orgId, ownId];

  if (status === 'LIVE') {
    conditions.push("t.status = 'LIVE'");
  } else if (status === 'UPCOMING') {
    conditions.push("t.status IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED')");
  } else if (status === 'COMPLETED') {
    conditions.push("t.status = 'COMPLETED'");
  } else {
    // Exclude DRAFT from public view
    conditions.push("t.status <> 'DRAFT'");
  }

  const [rows] = await connection.query(
    `SELECT 
       t.id,
       t.name,
       t.game,
       t.description,
       t.tournament_date,
       t.registration_start_at,
       t.registration_end_at,
       t.max_teams,
       t.players_per_team,
       t.entry_type,
       t.entry_fee,
       t.status,
       t.completed_at,
       t.created_at,
       (SELECT COUNT(*) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'VERIFIED') AS verified_registrations
     FROM tournaments t
     WHERE ${conditions.join(' AND ')}
     ORDER BY 
       CASE WHEN t.status = 'LIVE' THEN 1
            WHEN t.status IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED') THEN 2
            WHEN t.status = 'COMPLETED' THEN 3
            ELSE 4 END ASC,
       t.tournament_date DESC, t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset],
  );

  const [totalRows] = await connection.query(
    `SELECT COUNT(*) AS total FROM tournaments t WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return {
    tournaments: rows.map((r) => ({
      id: r.id,
      name: r.name,
      game: r.game || 'Free Fire',
      description: r.description,
      tournamentDate: r.tournament_date,
      registrationStartAt: r.registration_start_at,
      registrationEndAt: r.registration_end_at,
      maxTeams: r.max_teams,
      playersPerTeam: r.players_per_team,
      entryType: r.entry_type,
      entryFee: Number(r.entry_fee || 0),
      status: r.status,
      completedAt: r.completed_at,
      createdAt: r.created_at,
      verifiedRegistrations: Number(r.verified_registrations || 0),
    })),
    total: Number(totalRows[0]?.total || 0),
  };
}

/**
 * Retrieves the organization profile for an organizer user (creating one if missing).
 */
export async function getOrganizationByOwnerId(ownerId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT 
       o.id,
       o.name,
       o.slug,
       o.description,
       o.about,
       o.logo_url,
       o.cover_url,
       o.country,
       o.city,
       o.founded_year,
       o.website_url,
       o.discord_url,
       o.twitter_url,
       o.instagram_url,
       o.is_public,
       o.verified,
       o.created_at,
       o.updated_at,
       o.owner_id
     FROM organizations o
     WHERE o.owner_id = ?
     ORDER BY o.id ASC LIMIT 1`,
    [Number(ownerId)],
  );

  if (rows.length > 0) {
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      about: r.about,
      logoUrl: r.logo_url,
      coverUrl: r.cover_url,
      country: r.country,
      city: r.city,
      foundedYear: r.founded_year,
      websiteUrl: r.website_url,
      discordUrl: r.discord_url,
      twitterUrl: r.twitter_url,
      instagramUrl: r.instagram_url,
      isPublic: Boolean(r.is_public),
      verified: Boolean(r.verified),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ownerId: r.owner_id,
    };
  }

  // Auto create default organization for organizer
  const [userRows] = await connection.query('SELECT name FROM users WHERE id = ?', [Number(ownerId)]);
  const userName = userRows[0]?.name || 'Organizer';
  const orgName = `${userName}'s Organization`;

  const [createResult] = await connection.query(
    'INSERT INTO organizations (name, owner_id, is_public) VALUES (?, ?, TRUE)',
    [orgName, Number(ownerId)],
  );
  const newId = createResult.insertId;

  await connection.query(
    'INSERT INTO organization_members (organization_id, user_id, role, status) VALUES (?, ?, ?, ?)',
    [newId, Number(ownerId), 'OWNER', 'ACTIVE'],
  );

  return {
    id: newId,
    name: orgName,
    slug: null,
    description: null,
    about: null,
    logoUrl: null,
    coverUrl: null,
    country: null,
    city: null,
    foundedYear: new Date().getFullYear(),
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    instagramUrl: null,
    isPublic: true,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: Number(ownerId),
  };
}

/**
 * Updates organization profile fields by organization owner.
 */
export async function updateOrganizationProfile(organizationId, updates, connection = pool) {
  const fields = [];
  const params = [];

  const fieldMap = {
    name: updates.name,
    slug: updates.slug,
    description: updates.description,
    about: updates.about,
    logoUrl: updates.logoUrl,
    coverUrl: updates.coverUrl,
    country: updates.country,
    city: updates.city,
    foundedYear: updates.foundedYear,
    websiteUrl: updates.websiteUrl,
    discordUrl: updates.discordUrl,
    twitterUrl: updates.twitterUrl,
    instagramUrl: updates.instagramUrl,
    isPublic: updates.isPublic,
  };

  const sqlMap = {
    name: 'name',
    slug: 'slug',
    description: 'description',
    about: 'about',
    logoUrl: 'logo_url',
    coverUrl: 'cover_url',
    country: 'country',
    city: 'city',
    foundedYear: 'founded_year',
    websiteUrl: 'website_url',
    discordUrl: 'discord_url',
    twitterUrl: 'twitter_url',
    instagramUrl: 'instagram_url',
    isPublic: 'is_public',
  };

  for (const [k, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      fields.push(`${sqlMap[k]} = ?`);
      params.push(val === '' ? null : val);
    }
  }

  if (fields.length === 0) return true;

  params.push(Number(organizationId));
  await connection.query(
    `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );
  return true;
}
