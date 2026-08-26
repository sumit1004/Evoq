import { pool } from '../config/database.js';

const roundFields = 'id, tournament_id, round_number, name, status, assignment_status, is_locked, qualifications_finalized_at, started_at, completed_at, created_at, updated_at';
const groupFields = 'id, round_id, name, status, group_size, room_id, room_password, started_at, completed_at, created_at, updated_at';
const matchFields = 'id, group_id, match_number, name, status, room_id, room_password, scheduled_at, check_in_at, lobby_open_at, instructions, started_at, completed_at, created_at, updated_at';

export async function getTournamentContext(tournamentId) { const [rows] = await pool.query('SELECT id, organizer_id, status, name FROM tournaments WHERE id = ?', [tournamentId]); return rows[0] || null; }
export async function getRoundContext(roundId) { const [rows] = await pool.query(`SELECT r.*, t.organizer_id, t.status AS tournament_status, t.name AS tournament_name FROM rounds r JOIN tournaments t ON t.id = r.tournament_id WHERE r.id = ?`, [roundId]); return rows[0] || null; }
export async function getGroupContext(groupId) { const [rows] = await pool.query(`SELECT g.*, r.tournament_id, r.round_number, r.name AS round_name, r.status AS round_status, r.is_locked AS round_is_locked, r.assignment_status AS round_assignment_status, t.organizer_id, t.status AS tournament_status, t.name AS tournament_name FROM \`groups\` g JOIN rounds r ON r.id = g.round_id JOIN tournaments t ON t.id = r.tournament_id WHERE g.id = ?`, [groupId]); return rows[0] || null; }
export async function isPlayerAssignedToGroup(groupId, userId) { const [rows] = await pool.query('SELECT 1 FROM group_teams gt JOIN team_members tm ON tm.team_id = gt.team_id WHERE gt.group_id = ? AND tm.user_id = ? LIMIT 1', [groupId, userId]); return Boolean(rows[0]); }
export async function getMatchContext(matchId) { const [rows] = await pool.query(`SELECT m.*, g.name AS group_name, g.round_id, r.round_number, r.name AS round_name, r.tournament_id, g.status AS group_status, r.status AS round_status, t.organizer_id, t.status AS tournament_status, t.name AS tournament_name FROM matches m JOIN \`groups\` g ON g.id = m.group_id JOIN rounds r ON r.id = g.round_id JOIN tournaments t ON t.id = r.tournament_id WHERE m.id = ?`, [matchId]); return rows[0] || null; }


export async function listRounds(tournamentId) { const [rows] = await pool.query(`SELECT ${roundFields} FROM rounds WHERE tournament_id = ? ORDER BY round_number`, [tournamentId]); return rows; }
export async function findRound(roundId) { const [rows] = await pool.query(`SELECT ${roundFields} FROM rounds WHERE id = ?`, [roundId]); return rows[0] || null; }
export async function findRoundByNumber(tournamentId, roundNumber) { const [rows] = await pool.query(`SELECT ${roundFields} FROM rounds WHERE tournament_id = ? AND round_number = ?`, [tournamentId, roundNumber]); return rows[0] || null; }
export async function createRound(tournamentId, input) { const [result] = await pool.query('INSERT INTO rounds (tournament_id, round_number, name) VALUES (?, ?, ?)', [tournamentId, input.roundNumber, input.name.trim()]); return findRound(result.insertId); }
export async function updateRound(roundId, status) { await pool.query('UPDATE rounds SET status = ?, started_at = CASE WHEN ? = \'IN_PROGRESS\' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END, completed_at = CASE WHEN ? = \'COMPLETED\' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?', [status, status, status, roundId]); return findRound(roundId); }
export async function countIncompleteGroups(roundId) { const [rows] = await pool.query("SELECT COUNT(*) AS count FROM `groups` WHERE round_id = ? AND status <> 'COMPLETED'", [roundId]); return Number(rows[0].count); }

export async function listEligibleTeams(roundId) {
  const [rounds] = await pool.query('SELECT id, tournament_id, round_number FROM rounds WHERE id = ?', [roundId]);
  if (!rounds[0]) return [];
  const round = rounds[0];
  if (Number(round.round_number) === 1) {
    const [rows] = await pool.query(
      `SELECT DISTINCT teams.id, teams.name 
       FROM teams 
       JOIN registrations r ON r.team_id = teams.id AND r.tournament_id = ? AND r.status = 'VERIFIED' 
       ORDER BY teams.name`,
      [round.tournament_id]
    );
    return rows;
  }
  const [rows] = await pool.query(
    `SELECT DISTINCT teams.id, teams.name, q.source_group_id, q.rank_at_qualification
     FROM teams 
     JOIN qualifications q ON q.team_id = teams.id
     JOIN rounds prev ON prev.id = q.round_id
     WHERE prev.tournament_id = ? AND prev.round_number = ?
     ORDER BY COALESCE(q.rank_at_qualification, 999), teams.name`,
    [round.tournament_id, Number(round.round_number) - 1]
  );
  return rows;
}

export async function listGroups(roundId) { const [rows] = await pool.query(`SELECT ${groupFields} FROM \`groups\` WHERE round_id = ? ORDER BY id`, [roundId]); return Promise.all(rows.map(async (group) => ({ ...group, teams: await listGroupTeams(group.id), matches: await listMatches(group.id) }))); }
export async function listPlayerTournamentGroups(tournamentId, userId) {
  const prefixedGroupFields = groupFields.split(', ').map((field) => `g.${field}`).join(', ');
  const [rows] = await pool.query(`SELECT DISTINCT ${prefixedGroupFields}, r.round_number FROM \`groups\` g JOIN rounds r ON r.id = g.round_id JOIN group_teams gt ON gt.group_id = g.id JOIN team_members tm ON tm.team_id = gt.team_id WHERE r.tournament_id = ? AND tm.user_id = ? ORDER BY r.round_number, g.id`, [tournamentId, userId]);
  return Promise.all(rows.map(async (group) => ({ ...group, teams: await listGroupTeams(group.id), matches: await listMatches(group.id) })));
}

export async function isPlayerAssignedToTournament(tournamentId, userId) {
  const [rows] = await pool.query('SELECT 1 FROM group_teams gt JOIN `groups` g ON g.id = gt.group_id JOIN rounds r ON r.id = g.round_id JOIN team_members tm ON tm.team_id = gt.team_id WHERE r.tournament_id = ? AND tm.user_id = ? LIMIT 1', [tournamentId, userId]);
  return Boolean(rows[0]);
}

export async function findGroup(groupId) { const [rows] = await pool.query(`SELECT ${groupFields} FROM \`groups\` WHERE id = ?`, [groupId]); if (!rows[0]) return null; return { ...rows[0], teams: await listGroupTeams(groupId), matches: await listMatches(groupId) }; }
export async function createGroup(roundId, input) { const [result] = await pool.query('INSERT INTO `groups` (round_id, name, group_size) VALUES (?, ?, ?)', [roundId, input.name.trim(), input.groupSize]); return findGroup(result.insertId); }
export async function updateGroup(groupId, input) { const allowed = { name: 'name', groupSize: 'group_size', roomId: 'room_id', roomPassword: 'room_password', status: 'status' }; const columns = []; const values = []; for (const [key, column] of Object.entries(allowed)) if (input[key] !== undefined) { columns.push(`${column} = ?`); values.push(input[key]); } if (columns.length) { await pool.query(`UPDATE \`groups\` SET ${columns.join(', ')}, started_at = CASE WHEN ? = 'IN_PROGRESS' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END, completed_at = CASE WHEN ? = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?`, [...values, input.status || '', input.status || '', groupId]); } return findGroup(groupId); }
export async function countIncompleteMatches(groupId) { const [rows] = await pool.query("SELECT COUNT(*) AS count FROM matches WHERE group_id = ? AND status <> 'COMPLETED'", [groupId]); return Number(rows[0].count); }
export async function listGroupTeams(groupId) { const [rows] = await pool.query('SELECT gt.team_id AS id, t.name, gt.assigned_at FROM group_teams gt JOIN teams t ON t.id = gt.team_id WHERE gt.group_id = ? ORDER BY t.name', [groupId]); return rows; }

export async function assignTeam(groupId, teamId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [groups] = await connection.query('SELECT g.id, g.round_id, g.status, g.group_size, r.tournament_id, r.round_number, r.is_locked, r.assignment_status FROM `groups` g JOIN rounds r ON r.id = g.round_id WHERE g.id = ? FOR UPDATE', [groupId]);
    if (!groups[0]) return null;
    if (groups[0].is_locked || groups[0].assignment_status === 'LOCKED') {
      const error = new Error('Group assignment is locked and cannot be modified');
      error.code = 'ROUND_LOCKED';
      throw error;
    }
    const [assigned] = await connection.query('SELECT COUNT(*) AS count FROM group_teams WHERE group_id = ?', [groupId]);
    if (Number(assigned[0].count) >= Number(groups[0].group_size)) {
      const error = new Error('This group has reached its maximum capacity');
      error.code = 'GROUP_CAPACITY';
      throw error;
    }
    const [registrations] = await connection.query("SELECT id FROM registrations WHERE tournament_id = ? AND team_id = ? AND status = 'VERIFIED' FOR UPDATE", [groups[0].tournament_id, teamId]);
    if (!registrations[0]) {
      const error = new Error('Only verified teams can be assigned');
      error.code = 'TEAM_NOT_VERIFIED';
      throw error;
    }
    let eligible = true;
    if (Number(groups[0].round_number) > 1) {
      const [qualifications] = await connection.query("SELECT q.id FROM qualifications q JOIN rounds previous_round ON previous_round.id = q.round_id WHERE previous_round.tournament_id = ? AND previous_round.round_number = ? AND q.team_id = ? LIMIT 1 FOR UPDATE", [groups[0].tournament_id, Number(groups[0].round_number) - 1, teamId]);
      eligible = Boolean(qualifications[0]);
    }
    if (!eligible) {
      const error = new Error('Team is not qualified for this round');
      error.code = 'TEAM_NOT_QUALIFIED';
      throw error;
    }
    const [existing] = await connection.query('SELECT gt.id FROM group_teams gt JOIN `groups` g ON g.id = gt.group_id WHERE g.round_id = ? AND gt.team_id = ? FOR UPDATE', [groups[0].round_id, teamId]);
    if (existing[0]) {
      const error = new Error('This team is already assigned to another group in this round');
      error.code = 'TEAM_ALREADY_ASSIGNED';
      throw error;
    }
    await connection.query('INSERT INTO group_teams (group_id, team_id) VALUES (?, ?)', [groupId, teamId]);
    await connection.commit();
    return findGroup(groupId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeTeam(groupId, teamId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [groups] = await connection.query('SELECT g.id, r.is_locked, r.assignment_status FROM `groups` g JOIN rounds r ON r.id = g.round_id WHERE g.id = ? FOR UPDATE', [groupId]);
    if (groups[0]?.is_locked || groups[0]?.assignment_status === 'LOCKED') {
      const error = new Error('Group assignment is locked and cannot be modified');
      error.code = 'ROUND_LOCKED';
      throw error;
    }
    await connection.query('DELETE FROM group_teams WHERE group_id = ? AND team_id = ?', [groupId, teamId]);
    await connection.commit();
    return findGroup(groupId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function generateRoundGroupsAndAssignments(roundId, groupConfigs, assignments) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rounds] = await connection.query('SELECT id, tournament_id, round_number, status, is_locked, assignment_status FROM rounds WHERE id = ? FOR UPDATE', [roundId]);
    if (!rounds[0]) {
      const error = new Error('Round not found');
      error.code = 'ROUND_NOT_FOUND';
      throw error;
    }
    if (rounds[0].is_locked || rounds[0].assignment_status === 'LOCKED') {
      const error = new Error('Group assignment is locked and cannot be regenerated');
      error.code = 'ROUND_LOCKED';
      throw error;
    }
    if (rounds[0].status === 'COMPLETED' || rounds[0].status === 'IN_PROGRESS') {
      const error = new Error('Cannot regenerate groups for an active or completed round');
      error.code = 'ROUND_ACTIVE';
      throw error;
    }

    // Delete existing groups and cascading group_teams for this round
    await connection.query('DELETE FROM `groups` WHERE round_id = ?', [roundId]);

    // Insert new groups
    const groupMap = new Map();
    for (const conf of groupConfigs) {
      const [insertRes] = await connection.query(
        'INSERT INTO `groups` (round_id, name, group_size) VALUES (?, ?, ?)',
        [roundId, conf.name, conf.groupSize]
      );
      groupMap.set(conf.key, insertRes.insertId);
    }

    // Insert group_teams
    if (assignments && assignments.length > 0) {
      const insertValues = [];
      for (const item of assignments) {
        const groupId = groupMap.get(item.groupKey);
        if (groupId && item.teamId) {
          insertValues.push([groupId, item.teamId]);
        }
      }
      if (insertValues.length > 0) {
        await connection.query('INSERT INTO group_teams (group_id, team_id) VALUES ?', [insertValues]);
      }
    }

    // Update round status to READY
    await connection.query('UPDATE rounds SET assignment_status = ? WHERE id = ?', ['READY', roundId]);

    await connection.commit();
    return listGroups(roundId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function bulkMoveTeams(roundId, teamIds, targetGroupId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rounds] = await connection.query('SELECT id, status, is_locked, assignment_status FROM rounds WHERE id = ? FOR UPDATE', [roundId]);
    if (!rounds[0]) throw new Error('Round not found');
    if (rounds[0].is_locked || rounds[0].assignment_status === 'LOCKED') {
      const error = new Error('Group assignment is locked');
      error.code = 'ROUND_LOCKED';
      throw error;
    }
    if (rounds[0].status === 'COMPLETED') {
      const error = new Error('Completed rounds are read-only');
      error.code = 'ROUND_COMPLETED';
      throw error;
    }

    const [targetGroup] = await connection.query('SELECT id, round_id, group_size FROM `groups` WHERE id = ? AND round_id = ? FOR UPDATE', [targetGroupId, roundId]);
    if (!targetGroup[0]) {
      const error = new Error('Target group does not belong to this round');
      error.code = 'INVALID_TARGET_GROUP';
      throw error;
    }

    // Check all teamIds belong to current round
    const [assignedTeams] = await connection.query(
      `SELECT gt.team_id, gt.group_id 
       FROM group_teams gt 
       JOIN \`groups\` g ON g.id = gt.group_id 
       WHERE g.round_id = ? AND gt.team_id IN (?) FOR UPDATE`,
      [roundId, teamIds]
    );

    if (assignedTeams.length !== teamIds.length) {
      const error = new Error('One or more selected teams are not assigned in this round');
      error.code = 'TEAM_NOT_ASSIGNED';
      throw error;
    }

    // Delete existing assignments for selected teams in this round
    await connection.query(
      `DELETE gt FROM group_teams gt 
       JOIN \`groups\` g ON g.id = gt.group_id 
       WHERE g.round_id = ? AND gt.team_id IN (?)`,
      [roundId, teamIds]
    );

    // Insert into target group
    const insertValues = teamIds.map((tid) => [targetGroupId, tid]);
    await connection.query('INSERT INTO group_teams (group_id, team_id) VALUES ?', [insertValues]);

    await connection.commit();
    return listGroups(roundId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function lockRoundAssignment(roundId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rounds] = await connection.query('SELECT id, tournament_id, round_number, status, is_locked, assignment_status FROM rounds WHERE id = ? FOR UPDATE', [roundId]);
    if (!rounds[0]) throw new Error('Round not found');
    if (rounds[0].is_locked || rounds[0].assignment_status === 'LOCKED') {
      const error = new Error('Group assignment is already locked');
      error.code = 'ALREADY_LOCKED';
      throw error;
    }

    // Verify all eligible teams are assigned
    const round = rounds[0];
    let eligibleRows;
    if (Number(round.round_number) === 1) {
      const [rows] = await connection.query(
        `SELECT DISTINCT team_id AS id FROM registrations WHERE tournament_id = ? AND status = 'VERIFIED'`,
        [round.tournament_id]
      );
      eligibleRows = rows;
    } else {
      const [rows] = await connection.query(
        `SELECT DISTINCT q.team_id AS id FROM qualifications q 
         JOIN rounds prev ON prev.id = q.round_id 
         WHERE prev.tournament_id = ? AND prev.round_number = ?`,
        [round.tournament_id, Number(round.round_number) - 1]
      );
      eligibleRows = rows;
    }

    const [assignedRows] = await connection.query(
      `SELECT gt.team_id FROM group_teams gt JOIN \`groups\` g ON g.id = gt.group_id WHERE g.round_id = ?`,
      [roundId]
    );

    const eligibleIds = new Set(eligibleRows.map((r) => Number(r.id)));
    const assignedIds = assignedRows.map((r) => Number(r.team_id));
    const assignedSet = new Set(assignedIds);

    if (assignedIds.length !== assignedSet.size) {
      const error = new Error('Duplicate team assignments detected');
      error.code = 'DUPLICATE_ASSIGNMENT';
      throw error;
    }

    for (const id of eligibleIds) {
      if (!assignedSet.has(id)) {
        const error = new Error('All eligible teams must be assigned before locking');
        error.code = 'UNASSIGNED_TEAMS';
        throw error;
      }
    }

    for (const id of assignedSet) {
      if (!eligibleIds.has(id)) {
        const error = new Error('One or more assigned teams are not eligible for this round');
        error.code = 'INELIGIBLE_TEAMS';
        throw error;
      }
    }

    await connection.query('UPDATE rounds SET is_locked = TRUE, assignment_status = ? WHERE id = ?', ['LOCKED', roundId]);
    await connection.commit();
    return findRound(roundId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getRoundAffectedPlayers(roundId) {
  const [rows] = await pool.query(
    `SELECT tm.user_id, t.id AS team_id, t.name AS team_name, g.id AS group_id, g.name AS group_name, r.id AS round_id, r.round_number, r.tournament_id
     FROM group_teams gt
     JOIN \`groups\` g ON g.id = gt.group_id
     JOIN rounds r ON r.id = g.round_id
     JOIN teams t ON t.id = gt.team_id
     JOIN team_members tm ON tm.team_id = t.id
     WHERE r.id = ?`,
    [roundId]
  );
  return rows;
}

export async function listMatches(groupId) {
  const [rows] = await pool.query(`SELECT ${matchFields} FROM matches WHERE group_id = ? ORDER BY match_number`, [groupId]);
  return rows;
}

export async function findMatch(matchId) {
  const [rows] = await pool.query(`SELECT ${matchFields} FROM matches WHERE id = ?`, [matchId]);
  return rows[0] || null;
}

export async function createMatch(groupId, input) {
  const [result] = await pool.query(
    'INSERT INTO matches (group_id, match_number, name, status, room_id, room_password, scheduled_at, check_in_at, lobby_open_at, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      groupId,
      input.matchNumber,
      input.name.trim(),
      input.status || 'SCHEDULED',
      input.roomId || null,
      input.roomPassword || null,
      input.scheduledAt || null,
      input.checkInAt || null,
      input.lobbyOpenAt || null,
      input.instructions || null,
    ]
  );
  return findMatch(result.insertId);
}

export async function updateMatch(matchId, input) {
  const allowed = {
    name: 'name',
    matchNumber: 'match_number',
    status: 'status',
    roomId: 'room_id',
    roomPassword: 'room_password',
    scheduledAt: 'scheduled_at',
    checkInAt: 'check_in_at',
    lobbyOpenAt: 'lobby_open_at',
    instructions: 'instructions',
  };
  const columns = [];
  const values = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (input[key] !== undefined) {
      columns.push(`${column} = ?`);
      values.push(key === 'name' && typeof input[key] === 'string' ? input[key].trim() : input[key]);
    }
  }
  if (columns.length) {
    await pool.query(
      `UPDATE matches SET ${columns.join(', ')}, started_at = CASE WHEN ? = 'LIVE' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END, completed_at = CASE WHEN ? = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?`,
      [...values, input.status || '', input.status || '', matchId]
    );
  }
  return findMatch(matchId);
}

export async function countMatchResults(matchId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM match_results WHERE match_id = ?', [matchId]);
  return Number(rows[0]?.count || 0);
}

export async function deleteMatch(matchId) {
  await pool.query('DELETE FROM matches WHERE id = ?', [matchId]);
}

export async function countGroupResults(groupId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS count FROM matches m JOIN match_results mr ON mr.match_id = m.id WHERE m.group_id = ?',
    [groupId]
  );
  return Number(rows[0]?.count || 0);
}

export async function countGroupQualifications(groupId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM qualifications WHERE source_group_id = ?', [groupId]);
  return Number(rows[0]?.count || 0);
}

export async function countRoundResults(roundId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count 
     FROM match_results mr 
     JOIN matches m ON m.id = mr.match_id 
     JOIN \`groups\` g ON g.id = m.group_id 
     WHERE g.round_id = ?`,
    [roundId]
  );
  return Number(rows[0]?.count || 0);
}

export async function countRoundQualifications(roundId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM qualifications WHERE round_id = ?', [roundId]);
  return Number(rows[0]?.count || 0);
}

export async function deleteGroup(groupId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Delete group_teams assignments (preserves teams and registrations)
    await connection.query('DELETE FROM group_teams WHERE group_id = ?', [groupId]);
    // Delete chat messages for group
    await connection.query('DELETE FROM chat_messages WHERE group_id = ?', [groupId]);
    // Delete matches (cascades or explicit delete)
    await connection.query('DELETE FROM matches WHERE group_id = ?', [groupId]);
    // Delete group record
    await connection.query('DELETE FROM `groups` WHERE id = ?', [groupId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteRound(roundId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Delete group_teams assignments in this round (preserves underlying teams)
    await connection.query(
      `DELETE gt FROM group_teams gt 
       JOIN \`groups\` g ON g.id = gt.group_id 
       WHERE g.round_id = ?`,
      [roundId]
    );
    // Delete chat messages in this round
    await connection.query(
      `DELETE cm FROM chat_messages cm 
       JOIN \`groups\` g ON g.id = cm.group_id 
       WHERE g.round_id = ?`,
      [roundId]
    );
    // Delete matches in this round
    await connection.query(
      `DELETE m FROM matches m 
       JOIN \`groups\` g ON g.id = m.group_id 
       WHERE g.round_id = ?`,
      [roundId]
    );
    // Delete qualifications in this round
    await connection.query('DELETE FROM qualifications WHERE round_id = ?', [roundId]);
    // Delete groups in this round
    await connection.query('DELETE FROM `groups` WHERE round_id = ?', [roundId]);
    // Delete the round record
    await connection.query('DELETE FROM rounds WHERE id = ?', [roundId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getMatchAffectedPlayers(matchId) {
  const [rows] = await pool.query(
    `SELECT tm.user_id, t.id AS team_id, t.name AS team_name, m.id AS match_id, m.match_number, m.name AS match_name, m.scheduled_at, m.check_in_at, m.lobby_open_at, m.room_id, m.room_password, m.instructions, g.id AS group_id, g.name AS group_name, r.id AS round_id, r.round_number, r.tournament_id, tr.name AS tournament_name
     FROM matches m
     JOIN \`groups\` g ON g.id = m.group_id
     JOIN rounds r ON r.id = g.round_id
     JOIN tournaments tr ON tr.id = r.tournament_id
     JOIN group_teams gt ON gt.group_id = g.id
     JOIN teams t ON t.id = gt.team_id
     JOIN team_members tm ON tm.team_id = t.id
     WHERE m.id = ?`,
    [matchId]
  );
  return rows;
}

export async function getRoundStats(roundId) {
  const [groupRows] = await pool.query(
    `SELECT 
       COUNT(DISTINCT g.id) AS total_groups,
       COUNT(DISTINCT CASE WHEN g.status = 'COMPLETED' THEN g.id END) AS completed_groups,
       COUNT(DISTINCT gt.team_id) AS total_teams
     FROM \`groups\` g
     LEFT JOIN group_teams gt ON gt.group_id = g.id
     WHERE g.round_id = ?`,
    [roundId]
  );

  const [matchRows] = await pool.query(
    `SELECT 
       COUNT(DISTINCT m.id) AS total_matches,
       COUNT(DISTINCT CASE WHEN m.status = 'COMPLETED' THEN m.id END) AS completed_matches,
       COUNT(DISTINCT CASE WHEN m.status = 'LIVE' THEN m.id END) AS live_matches
     FROM \`groups\` g
     JOIN matches m ON m.group_id = g.id
     WHERE g.round_id = ?`,
    [roundId]
  );

  const [qualRows] = await pool.query(
    `SELECT COUNT(DISTINCT team_id) AS qualified_teams FROM qualifications WHERE round_id = ?`,
    [roundId]
  );

  return {
    totalGroups: Number(groupRows[0]?.total_groups || 0),
    completedGroups: Number(groupRows[0]?.completed_groups || 0),
    totalTeams: Number(groupRows[0]?.total_teams || 0),
    totalMatches: Number(matchRows[0]?.total_matches || 0),
    completedMatches: Number(matchRows[0]?.completed_matches || 0),
    liveMatches: Number(matchRows[0]?.live_matches || 0),
    qualifiedTeams: Number(qualRows[0]?.qualified_teams || 0),
  };
}


