import { pool } from '../config/database.js';

export async function ensureDefaultOrganization(organizerId, connection = pool) {
  const [existing] = await connection.query(
    `SELECT o.id, o.name, o.owner_id
     FROM organizations o
     JOIN organization_members om ON om.organization_id = o.id
     WHERE om.user_id = ? AND om.role IN ('OWNER', 'ORGANIZER')
     ORDER BY o.id ASC LIMIT 1`,
    [organizerId]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // Find user name for default org name
  const [users] = await connection.query('SELECT name FROM users WHERE id = ?', [organizerId]);
  const orgName = users[0]?.name ? `${users[0].name}'s Organization` : 'Tournament Organization';

  const [orgResult] = await connection.query(
    'INSERT INTO organizations (name, owner_id) VALUES (?, ?)',
    [orgName, organizerId]
  );
  const organizationId = orgResult.insertId;

  await connection.query(
    'INSERT INTO organization_members (organization_id, user_id, role, status) VALUES (?, ?, ?, ?)',
    [organizationId, organizerId, 'OWNER', 'ACTIVE']
  );

  return { id: organizationId, name: orgName, owner_id: organizerId };
}

export async function findOrganizationById(organizationId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT id, name, owner_id, created_at, updated_at FROM organizations WHERE id = ?',
    [organizationId]
  );
  return rows[0] || null;
}

export async function findOrganizationMember(organizationId, userId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT id, organization_id, user_id, role, status FROM organization_members WHERE organization_id = ? AND user_id = ?',
    [organizationId, userId]
  );
  return rows[0] || null;
}

export async function ensureOrganizationMember(organizationId, userId, role = 'SCOUT', connection = pool) {
  const existing = await findOrganizationMember(organizationId, userId, connection);
  if (!existing) {
    await connection.query(
      'INSERT INTO organization_members (organization_id, user_id, role, status) VALUES (?, ?, ?, ?)',
      [organizationId, userId, role, 'ACTIVE']
    );
  } else if (existing.status !== 'ACTIVE') {
    await connection.query(
      'UPDATE organization_members SET status = ? WHERE id = ?',
      ['ACTIVE', existing.id]
    );
  }
}

export async function searchScouts(searchQuery, currentUserId, connection = pool) {
  const query = searchQuery?.trim();
  if (!query) return [];

  const [rows] = await connection.query(
    `SELECT u.id, u.name, u.email, u.role,
            pp.unique_player_id, pp.in_game_name, pp.mobile, pp.game_uid
     FROM users u
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE u.id != ?
       AND (
         pp.unique_player_id = ?
         OR pp.unique_player_id LIKE ?
         OR u.name LIKE ?
         OR u.email = ?
       )
     LIMIT 20`,
    [currentUserId, query, `%${query}%`, `%${query}%`, query]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    uniquePlayerId: row.unique_player_id || `EVQ-${row.id}`,
    inGameName: row.in_game_name || null,
    role: row.role,
    status: 'ACTIVE',
  }));
}

export async function findTournamentStaff(tournamentId, userId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT ts.id, ts.organization_id, ts.tournament_id, ts.user_id, ts.all_groups, ts.status, ts.created_by,
            ts.created_at, ts.updated_at,
            u.name AS user_name, u.email AS user_email,
            pp.unique_player_id, pp.in_game_name
     FROM tournament_staff ts
     JOIN users u ON u.id = ts.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE ts.tournament_id = ? AND ts.user_id = ?
     LIMIT 1`,
    [tournamentId, userId]
  );
  return rows[0] || null;
}

export async function findTournamentStaffById(staffId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT ts.id, ts.organization_id, ts.tournament_id, ts.user_id, ts.all_groups, ts.status, ts.created_by,
            ts.created_at, ts.updated_at,
            u.name AS user_name, u.email AS user_email,
            pp.unique_player_id, pp.in_game_name,
            t.name AS tournament_name, t.organizer_id, t.status AS tournament_status
     FROM tournament_staff ts
     JOIN users u ON u.id = ts.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     JOIN tournaments t ON t.id = ts.tournament_id
     WHERE ts.id = ?
     LIMIT 1`,
    [staffId]
  );
  return rows[0] || null;
}

export async function listTournamentStaff(tournamentId, connection = pool) {
  const [staffRows] = await connection.query(
    `SELECT ts.id, ts.organization_id, ts.tournament_id, ts.user_id, ts.all_groups, ts.status, ts.created_by,
            ts.created_at, ts.updated_at,
            u.name AS user_name, u.email AS user_email,
            pp.unique_player_id, pp.in_game_name
     FROM tournament_staff ts
     JOIN users u ON u.id = ts.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE ts.tournament_id = ?
     ORDER BY ts.created_at DESC`,
    [tournamentId]
  );

  if (staffRows.length === 0) return [];

  const staffIds = staffRows.map((s) => s.id);

  const [permRows] = await connection.query(
    `SELECT tournament_staff_id, permission_key
     FROM staff_permissions
     WHERE tournament_staff_id IN (?)`,
    [staffIds]
  );

  const [groupRows] = await connection.query(
    `SELECT sga.tournament_staff_id, sga.group_id, g.name AS group_name, g.round_id, r.name AS round_name, r.round_number
     FROM staff_group_assignments sga
     JOIN \`groups\` g ON g.id = sga.group_id
     JOIN rounds r ON r.id = g.round_id
     WHERE sga.tournament_staff_id IN (?)
     ORDER BY r.round_number ASC, g.name ASC`,
    [staffIds]
  );

  const permsMap = new Map();
  for (const p of permRows) {
    if (!permsMap.has(p.tournament_staff_id)) permsMap.set(p.tournament_staff_id, []);
    permsMap.get(p.tournament_staff_id).push(p.permission_key);
  }

  const groupsMap = new Map();
  for (const g of groupRows) {
    if (!groupsMap.has(g.tournament_staff_id)) groupsMap.set(g.tournament_staff_id, []);
    groupsMap.get(g.tournament_staff_id).push({
      groupId: g.group_id,
      groupName: g.group_name,
      roundId: g.round_id,
      roundName: g.round_name,
      roundNumber: g.round_number,
    });
  }

  return staffRows.map((staff) => ({
    id: staff.id,
    organizationId: staff.organization_id,
    tournamentId: staff.tournament_id,
    userId: staff.user_id,
    userName: staff.user_name,
    userEmail: staff.user_email,
    uniquePlayerId: staff.unique_player_id || `EVQ-${staff.user_id}`,
    inGameName: staff.in_game_name || null,
    allGroups: Boolean(staff.all_groups),
    status: staff.status,
    createdBy: staff.created_by,
    createdAt: staff.created_at,
    updatedAt: staff.updated_at,
    permissions: permsMap.get(staff.id) || [],
    assignedGroups: groupsMap.get(staff.id) || [],
  }));
}

export async function listOrganizationScouts(organizationId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT om.id AS member_id, om.user_id, om.role, om.status, om.created_at,
            u.name AS user_name, u.email AS user_email,
            pp.unique_player_id, pp.in_game_name,
            COUNT(DISTINCT ts.tournament_id) AS assigned_tournaments_count
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     LEFT JOIN tournament_staff ts ON ts.user_id = om.user_id AND ts.organization_id = om.organization_id AND ts.status = 'ACTIVE'
     WHERE om.organization_id = ? AND om.role = 'SCOUT'
     GROUP BY om.id, om.user_id, om.role, om.status, om.created_at, u.name, u.email, pp.unique_player_id, pp.in_game_name
     ORDER BY om.created_at DESC`,
    [organizationId]
  );

  return rows.map((r) => ({
    memberId: r.member_id,
    userId: r.user_id,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
    userName: r.user_name,
    userEmail: r.user_email,
    uniquePlayerId: r.unique_player_id || `EVQ-${r.user_id}`,
    inGameName: r.in_game_name || null,
    assignedTournamentsCount: Number(r.assigned_tournaments_count || 0),
  }));
}

export async function insertTournamentStaff({ organizationId, tournamentId, userId, allGroups = false, createdBy }, connection = pool) {
  const [result] = await connection.query(
    `INSERT INTO tournament_staff (organization_id, tournament_id, user_id, all_groups, status, created_by)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?)
     ON DUPLICATE KEY UPDATE all_groups = VALUES(all_groups), status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP`,
    [organizationId, tournamentId, userId, allGroups ? 1 : 0, createdBy]
  );
  return result.insertId || (await findTournamentStaff(tournamentId, userId, connection)).id;
}

export async function insertStaffPermissions(tournamentStaffId, permissions = [], connection = pool) {
  if (!permissions.length) return;
  const values = permissions.map((key) => [tournamentStaffId, key]);
  await connection.query(
    `INSERT IGNORE INTO staff_permissions (tournament_staff_id, permission_key) VALUES ?`,
    [values]
  );
}

export async function insertStaffGroupAssignments(tournamentStaffId, groupIds = [], connection = pool) {
  if (!groupIds.length) return;
  const values = groupIds.map((gid) => [tournamentStaffId, gid]);
  await connection.query(
    `INSERT IGNORE INTO staff_group_assignments (tournament_staff_id, group_id) VALUES ?`,
    [values]
  );
}

export async function deleteStaffPermissions(tournamentStaffId, connection = pool) {
  await connection.query('DELETE FROM staff_permissions WHERE tournament_staff_id = ?', [tournamentStaffId]);
}

export async function deleteStaffGroupAssignments(tournamentStaffId, connection = pool) {
  await connection.query('DELETE FROM staff_group_assignments WHERE tournament_staff_id = ?', [tournamentStaffId]);
}

export async function updateTournamentStaff(tournamentStaffId, { allGroups, status }, connection = pool) {
  const updates = [];
  const params = [];
  if (allGroups !== undefined) {
    updates.push('all_groups = ?');
    params.push(allGroups ? 1 : 0);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (!updates.length) return;
  params.push(tournamentStaffId);
  await connection.query(`UPDATE tournament_staff SET ${updates.join(', ')} WHERE id = ?`, params);
}

export async function listScoutAssignedTournaments(userId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT ts.id AS staff_id, ts.tournament_id, ts.all_groups, ts.status AS staff_status,
            t.name AS tournament_name, t.description, t.tournament_date, t.status AS tournament_status,
            t.entry_type, t.entry_fee, t.game, t.organizer_id,
            u.name AS organizer_name
     FROM tournament_staff ts
     JOIN tournaments t ON t.id = ts.tournament_id
     JOIN users u ON u.id = t.organizer_id
     WHERE ts.user_id = ? AND ts.status = 'ACTIVE'
     ORDER BY ts.updated_at DESC`,
    [userId]
  );

  if (rows.length === 0) return [];

  const staffIds = rows.map((r) => r.staff_id);

  const [permRows] = await connection.query(
    `SELECT tournament_staff_id, permission_key FROM staff_permissions WHERE tournament_staff_id IN (?)`,
    [staffIds]
  );

  const [groupRows] = await connection.query(
    `SELECT sga.tournament_staff_id, sga.group_id, g.name AS group_name, g.round_id, r.name AS round_name, r.round_number
     FROM staff_group_assignments sga
     JOIN \`groups\` g ON g.id = sga.group_id
     JOIN rounds r ON r.id = g.round_id
     WHERE sga.tournament_staff_id IN (?)`,
    [staffIds]
  );

  const permsMap = new Map();
  for (const p of permRows) {
    if (!permsMap.has(p.tournament_staff_id)) permsMap.set(p.tournament_staff_id, []);
    permsMap.get(p.tournament_staff_id).push(p.permission_key);
  }

  const groupsMap = new Map();
  for (const g of groupRows) {
    if (!groupsMap.has(g.tournament_staff_id)) groupsMap.set(g.tournament_staff_id, []);
    groupsMap.get(g.tournament_staff_id).push({
      groupId: g.group_id,
      groupName: g.group_name,
      roundId: g.round_id,
      roundName: g.round_name,
      roundNumber: g.round_number,
    });
  }

  return rows.map((r) => {
    const assignedGroups = groupsMap.get(r.staff_id) || [];
    return {
      staffId: r.staff_id,
      id: r.tournament_id,
      tournamentId: r.tournament_id,
      name: r.tournament_name,
      tournamentName: r.tournament_name,
      description: r.description,
      tournamentDate: r.tournament_date,
      status: r.tournament_status,
      tournamentStatus: r.tournament_status,
      entryType: r.entry_type,
      entryFee: r.entry_fee,
      game: r.game,
      organizerId: r.organizer_id,
      organizerName: r.organizer_name,
      organizationName: r.organizer_name,
      allGroups: Boolean(r.all_groups),
      permissions: permsMap.get(r.staff_id) || [],
      assignedGroups,
      assignedGroupIds: assignedGroups.map((g) => g.groupId),
    };
  });
}

export async function getScoutPermissionsAndGroups(tournamentId, userId, connection = pool) {
  const staff = await findTournamentStaff(tournamentId, userId, connection);
  if (!staff || staff.status !== 'ACTIVE') return null;

  const [permRows] = await connection.query(
    'SELECT permission_key FROM staff_permissions WHERE tournament_staff_id = ?',
    [staff.id]
  );

  const [groupRows] = await connection.query(
    `SELECT sga.group_id, g.name AS group_name, g.round_id, r.name AS round_name, r.round_number
     FROM staff_group_assignments sga
     JOIN \`groups\` g ON g.id = sga.group_id
     JOIN rounds r ON r.id = g.round_id
     WHERE sga.tournament_staff_id = ?`,
    [staff.id]
  );

  return {
    staffId: staff.id,
    userId: staff.user_id,
    tournamentId: staff.tournament_id,
    allGroups: Boolean(staff.all_groups),
    status: staff.status,
    permissions: permRows.map((p) => p.permission_key),
    assignedGroupIds: groupRows.map((g) => g.group_id),
    assignedGroups: groupRows.map((g) => ({
      groupId: g.group_id,
      groupName: g.group_name,
      roundId: g.round_id,
      roundName: g.round_name,
      roundNumber: g.round_number,
    })),
  };
}

export async function insertAuditLog({
  organizationId = null,
  tournamentId = null,
  groupId = null,
  userId = null,
  actorId = null,
  action,
  entityType,
  entityId,
  metadata = null,
}, connection = pool) {
  const actor = actorId || userId;
  const metaStr = metadata ? JSON.stringify(metadata) : null;
  try {
    await connection.query(
      `INSERT INTO audit_logs (organization_id, tournament_id, group_id, user_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, tournamentId, groupId, actor, actor, action, entityType, entityId, metaStr]
    );
  } catch (err) {
    if (process.env.NODE_ENV === 'test' && (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW')) {
      return;
    }
    throw err;
  }
}

export async function listAuditLogs(tournamentId, { limit = 50, offset = 0 } = {}, connection = pool) {
  const [rows] = await connection.query(
    `SELECT al.id, al.organization_id, al.tournament_id, al.group_id, al.actor_id, al.action,
            al.entity_type, al.entity_id, al.metadata, al.timestamp,
            u.name AS actor_name, u.email AS actor_email,
            pp.unique_player_id AS actor_unique_player_id
     FROM audit_logs al
     JOIN users u ON u.id = al.actor_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE al.tournament_id = ?
     ORDER BY al.timestamp DESC
     LIMIT ? OFFSET ?`,
    [tournamentId, Number(limit), Number(offset)]
  );

  const [totalRows] = await connection.query(
    'SELECT COUNT(*) AS count FROM audit_logs WHERE tournament_id = ?',
    [tournamentId]
  );

  return {
    logs: rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      tournamentId: r.tournament_id,
      groupId: r.group_id,
      actorId: r.actor_id,
      actorName: r.actor_name,
      actorUniquePlayerId: r.actor_unique_player_id || `EVQ-${r.actor_id}`,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      timestamp: r.timestamp,
    })),
    total: totalRows[0]?.count || 0,
  };
}

export async function countActiveStaffAssignments(userId, connection = pool) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS count FROM tournament_staff WHERE user_id = ? AND status = 'ACTIVE'",
    [userId]
  );
  return Number(rows[0]?.count || 0);
}

