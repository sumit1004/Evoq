import { pool } from '../config/database.js';

export async function getProfileByUserId(userId, connection = pool) {
  let [rows] = await connection.query(
    `SELECT 
       u.id AS user_id,
       u.name,
       u.email,
       u.role,
       u.created_at AS account_created_at,
       pp.unique_player_id,
       pp.mobile,
       pp.in_game_name,
       pp.game_uid,
       pp.country,
       pp.city,
       pp.bio,
       pp.avatar_url,
       COALESCE(pp.is_public, 1) AS is_public,
       COALESCE(pp.show_game_uid, 0) AS show_game_uid,
       COALESCE(pp.show_team, 1) AS show_team,
       COALESCE(pp.show_performance, 1) AS show_performance,
       COALESCE(pp.show_tournaments, 1) AS show_tournaments,
       COALESCE(pp.show_practice, 1) AS show_practice,
       COALESCE(pp.show_achievements, 1) AS show_achievements,
       pp.created_at AS profile_created_at,
       pp.updated_at AS profile_updated_at
     FROM users u
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [userId],
  );

  if (!rows[0]) return null;

  if (!rows[0].unique_player_id) {
    const generatedId = `EVOQ-P-${String(userId).padStart(4, '0')}`;
    await connection.query(
      `INSERT INTO player_profiles (user_id, unique_player_id, is_public, show_game_uid, show_team, show_performance, show_tournaments, show_practice, show_achievements)
       VALUES (?, ?, 1, 0, 1, 1, 1, 1, 1)
       ON DUPLICATE KEY UPDATE unique_player_id = COALESCE(unique_player_id, VALUES(unique_player_id))`,
      [userId, generatedId],
    );
    rows[0].unique_player_id = generatedId;
  }

  return rows[0];
}

export async function getProfileByEvoqId(evoqId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT 
       u.id AS user_id,
       u.name,
       u.created_at AS account_created_at,
       pp.unique_player_id,
       pp.in_game_name,
       pp.game_uid,
       pp.country,
       pp.city,
       pp.bio,
       pp.avatar_url,
       pp.is_public,
       pp.show_game_uid,
       pp.show_team,
       pp.show_performance,
       pp.show_tournaments,
       pp.show_practice,
       pp.show_achievements,
       pp.created_at AS profile_created_at
     FROM player_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.unique_player_id = ? LIMIT 1`,
    [evoqId],
  );
  return rows[0] || null;
}

export async function updateProfileDetails(userId, updates, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    // Ensure base profile row exists
    const generatedId = `EVOQ-P-${String(userId).padStart(4, '0')}`;
    await conn.query(
      `INSERT INTO player_profiles (user_id, unique_player_id, is_public, show_game_uid, show_team, show_performance, show_tournaments, show_practice, show_achievements)
       VALUES (?, ?, 1, 0, 1, 1, 1, 1, 1)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId, generatedId],
    );

    if (updates.name !== undefined && updates.name !== null) {
      await conn.query('UPDATE users SET name = ? WHERE id = ?', [updates.name.trim(), userId]);
    }

    const fields = [];
    const params = [];

    const fieldMap = {
      mobile: updates.mobile,
      country: updates.country,
      city: updates.city,
      bio: updates.bio,
      avatarUrl: updates.avatarUrl,
      isPublic: updates.isPublic,
      showGameUid: updates.showGameUid,
      showTeam: updates.showTeam,
      showPerformance: updates.showPerformance,
      showTournaments: updates.showTournaments,
      showPractice: updates.showPractice,
      showAchievements: updates.showAchievements,
    };

    const sqlColMap = {
      mobile: 'mobile',
      country: 'country',
      city: 'city',
      bio: 'bio',
      avatarUrl: 'avatar_url',
      isPublic: 'is_public',
      showGameUid: 'show_game_uid',
      showTeam: 'show_team',
      showPerformance: 'show_performance',
      showTournaments: 'show_tournaments',
      showPractice: 'show_practice',
      showAchievements: 'show_achievements',
    };

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(`${sqlColMap[key]} = ?`);
        params.push(val);
      }
    }

    if (fields.length > 0) {
      params.push(userId);
      await conn.query(
        `UPDATE player_profiles SET ${fields.join(', ')} WHERE user_id = ?`,
        params,
      );
    }

    if (isDedicated) await conn.commit();
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

// ---------------- Game Profiles ---------------- //

export async function listGameProfiles(userId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT 
       id,
       user_id,
       game_name,
       in_game_name,
       game_uid,
       primary_role,
       secondary_role,
       started_playing_at,
       current_rank,
       highest_rank,
       region,
       is_primary,
       is_public,
       created_at,
       updated_at
     FROM player_game_profiles
     WHERE user_id = ?
     ORDER BY is_primary DESC, created_at ASC`,
    [userId],
  );
  return rows;
}

export async function findGameProfileById(userId, gameProfileId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT * FROM player_game_profiles WHERE id = ? AND user_id = ? LIMIT 1`,
    [gameProfileId, userId],
  );
  return rows[0] || null;
}

export async function findGameProfileByGame(userId, gameName, connection = pool) {
  const [rows] = await connection.query(
    `SELECT * FROM player_game_profiles WHERE user_id = ? AND game_name = ? LIMIT 1`,
    [userId, gameName],
  );
  return rows[0] || null;
}

export async function createGameProfile(userId, data, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    const [existing] = await conn.query('SELECT COUNT(*) AS count FROM player_game_profiles WHERE user_id = ?', [userId]);
    const isFirst = Number(existing[0].count) === 0;
    const isPrimary = isFirst || Boolean(data.isPrimary);

    if (isPrimary) {
      await conn.query('UPDATE player_game_profiles SET is_primary = FALSE WHERE user_id = ?', [userId]);
    }

    const [result] = await conn.query(
      `INSERT INTO player_game_profiles 
       (user_id, game_name, in_game_name, game_uid, primary_role, secondary_role, started_playing_at, current_rank, highest_rank, region, is_primary, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.gameName.trim(),
        data.inGameName.trim(),
        data.gameUid.trim(),
        data.primaryRole.trim(),
        data.secondaryRole ? data.secondaryRole.trim() : null,
        data.startedPlayingAt || null,
        data.currentRank ? data.currentRank.trim() : null,
        data.highestRank ? data.highestRank.trim() : null,
        data.region ? data.region.trim() : null,
        isPrimary,
        data.isPublic !== undefined ? Boolean(data.isPublic) : true,
      ],
    );

    // Sync primary game info to player_profiles for backward compatibility
    if (isPrimary) {
      await conn.query(
        'UPDATE player_profiles SET in_game_name = ?, game_uid = ? WHERE user_id = ?',
        [data.inGameName.trim(), data.gameUid.trim(), userId],
      );
    }

    if (isDedicated) await conn.commit();
    return result.insertId;
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

export async function updateGameProfile(userId, gameProfileId, data, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    if (data.isPrimary) {
      await conn.query('UPDATE player_game_profiles SET is_primary = FALSE WHERE user_id = ?', [userId]);
    }

    const fields = [];
    const params = [];

    if (data.gameName !== undefined) {
      fields.push('game_name = ?');
      params.push(data.gameName.trim());
    }
    if (data.inGameName !== undefined) {
      fields.push('in_game_name = ?');
      params.push(data.inGameName.trim());
    }
    if (data.gameUid !== undefined) {
      fields.push('game_uid = ?');
      params.push(data.gameUid.trim());
    }
    if (data.primaryRole !== undefined) {
      fields.push('primary_role = ?');
      params.push(data.primaryRole.trim());
    }
    if (data.secondaryRole !== undefined) {
      fields.push('secondary_role = ?');
      params.push(data.secondaryRole ? data.secondaryRole.trim() : null);
    }
    if (data.startedPlayingAt !== undefined) {
      fields.push('started_playing_at = ?');
      params.push(data.startedPlayingAt || null);
    }
    if (data.currentRank !== undefined) {
      fields.push('current_rank = ?');
      params.push(data.currentRank ? data.currentRank.trim() : null);
    }
    if (data.highestRank !== undefined) {
      fields.push('highest_rank = ?');
      params.push(data.highestRank ? data.highestRank.trim() : null);
    }
    if (data.region !== undefined) {
      fields.push('region = ?');
      params.push(data.region ? data.region.trim() : null);
    }
    if (data.isPrimary !== undefined) {
      fields.push('is_primary = ?');
      params.push(Boolean(data.isPrimary));
    }
    if (data.isPublic !== undefined) {
      fields.push('is_public = ?');
      params.push(Boolean(data.isPublic));
    }

    if (fields.length > 0) {
      params.push(gameProfileId, userId);
      await conn.query(
        `UPDATE player_game_profiles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        params,
      );
    }

    // If updated profile is primary, sync to player_profiles
    if (data.isPrimary || data.inGameName || data.gameUid) {
      const [curr] = await conn.query('SELECT in_game_name, game_uid, is_primary FROM player_game_profiles WHERE id = ?', [gameProfileId]);
      if (curr[0] && curr[0].is_primary) {
        await conn.query(
          'UPDATE player_profiles SET in_game_name = ?, game_uid = ? WHERE user_id = ?',
          [curr[0].in_game_name, curr[0].game_uid, userId],
        );
      }
    }

    if (isDedicated) await conn.commit();
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

export async function deleteGameProfile(userId, gameProfileId, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    const [target] = await conn.query(
      'SELECT is_primary FROM player_game_profiles WHERE id = ? AND user_id = ?',
      [gameProfileId, userId],
    );

    if (!target[0]) {
      if (isDedicated) await conn.rollback();
      return false;
    }

    await conn.query('DELETE FROM player_game_profiles WHERE id = ? AND user_id = ?', [gameProfileId, userId]);

    // If we deleted the primary game, promote another if available
    if (target[0].is_primary) {
      const [remaining] = await conn.query(
        'SELECT id, in_game_name, game_uid FROM player_game_profiles WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
        [userId],
      );
      if (remaining[0]) {
        await conn.query('UPDATE player_game_profiles SET is_primary = TRUE WHERE id = ?', [remaining[0].id]);
        await conn.query(
          'UPDATE player_profiles SET in_game_name = ?, game_uid = ? WHERE user_id = ?',
          [remaining[0].in_game_name, remaining[0].game_uid, userId],
        );
      } else {
        await conn.query(
          'UPDATE player_profiles SET in_game_name = NULL, game_uid = NULL WHERE user_id = ?',
          [userId],
        );
      }
    }

    if (isDedicated) await conn.commit();
    return true;
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

// ---------------- Practice / Scrims ---------------- //

export async function listPracticeSessions(userId, filters = {}, connection = pool) {
  const conditions = ['s.user_id = ?'];
  const params = [userId];

  if (filters.game) {
    conditions.push('s.game_name = ?');
    params.push(filters.game);
  }

  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  const offset = Math.max(Number(filters.offset || 0), 0);

  const [rows] = await connection.query(
    `SELECT 
       s.id,
       s.user_id,
       s.session_date,
       s.game_name,
       s.title,
       s.team_name,
       s.notes,
       s.created_at,
       s.updated_at,
       COUNT(m.id) AS match_count,
       COALESCE(SUM(m.kills), 0) AS total_kills,
       COALESCE(SUM(m.damage), 0) AS total_damage,
       MIN(m.placement) AS best_placement
     FROM player_practice_sessions s
     LEFT JOIN player_practice_matches m ON m.session_id = s.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY s.id, s.user_id, s.session_date, s.game_name, s.title, s.team_name, s.notes, s.created_at, s.updated_at
     ORDER BY s.session_date DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [totalRows] = await connection.query(
    `SELECT COUNT(*) AS total FROM player_practice_sessions s WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return {
    sessions: rows.map((r) => ({
      ...r,
      match_count: Number(r.match_count || 0),
      total_kills: Number(r.total_kills || 0),
      total_damage: Number(r.total_damage || 0),
      best_placement: r.best_placement != null ? Number(r.best_placement) : null,
    })),
    total: Number(totalRows[0]?.total || 0),
  };
}

export async function findPracticeSessionById(userId, sessionId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT * FROM player_practice_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
    [sessionId, userId],
  );
  if (!rows[0]) return null;

  const [matches] = await connection.query(
    `SELECT 
       m.*,
       (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', w.id, 'weaponName', w.weapon_name, 'kills', w.kills, 'damage', w.damage))
        FROM player_practice_weapons w WHERE w.practice_match_id = m.id) AS weapons_json
     FROM player_practice_matches m
     WHERE m.session_id = ? AND m.user_id = ?
     ORDER BY m.match_number ASC, m.id ASC`,
    [sessionId, userId],
  );

  return {
    ...rows[0],
    matches: matches.map((m) => ({
      ...m,
      weapons: m.weapons_json ? (typeof m.weapons_json === 'string' ? JSON.parse(m.weapons_json) : m.weapons_json) : [],
    })),
  };
}

export async function createPracticeSession(userId, data, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO player_practice_sessions 
       (user_id, session_date, game_name, title, team_name, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.sessionDate,
        data.gameName.trim(),
        data.title.trim(),
        data.teamName ? data.teamName.trim() : null,
        data.notes ? data.notes.trim() : null,
      ],
    );
    const sessionId = result.insertId;

    if (Array.isArray(data.matches) && data.matches.length > 0) {
      for (let i = 0; i < data.matches.length; i++) {
        const match = data.matches[i];
        const [mResult] = await conn.query(
          `INSERT INTO player_practice_matches
           (session_id, user_id, match_number, played_at, game_name, placement, kills, assists, damage, score, survival_time_seconds, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId,
            userId,
            match.matchNumber || i + 1,
            match.playedAt || new Date(),
            data.gameName.trim(),
            match.placement != null ? Number(match.placement) : null,
            Number(match.kills || 0),
            Number(match.assists || 0),
            Number(match.damage || 0),
            Number(match.score || 0),
            match.survivalTimeSeconds != null ? Number(match.survivalTimeSeconds) : null,
            match.notes ? match.notes.trim() : null,
          ],
        );
        const matchId = mResult.insertId;

        if (Array.isArray(match.weapons) && match.weapons.length > 0) {
          for (const w of match.weapons) {
            if (w.weaponName) {
              await conn.query(
                `INSERT INTO player_practice_weapons (practice_match_id, weapon_name, kills, damage) VALUES (?, ?, ?, ?)`,
                [matchId, w.weaponName.trim(), Number(w.kills || 0), Number(w.damage || 0)],
              );
            }
          }
        }
      }
    }

    if (isDedicated) await conn.commit();
    return sessionId;
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

export async function updatePracticeSession(userId, sessionId, data, connection = pool) {
  const fields = [];
  const params = [];

  if (data.sessionDate !== undefined) {
    fields.push('session_date = ?');
    params.push(data.sessionDate);
  }
  if (data.gameName !== undefined) {
    fields.push('game_name = ?');
    params.push(data.gameName.trim());
  }
  if (data.title !== undefined) {
    fields.push('title = ?');
    params.push(data.title.trim());
  }
  if (data.teamName !== undefined) {
    fields.push('team_name = ?');
    params.push(data.teamName ? data.teamName.trim() : null);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    params.push(data.notes ? data.notes.trim() : null);
  }

  if (!fields.length) return false;

  params.push(sessionId, userId);
  const [result] = await connection.query(
    `UPDATE player_practice_sessions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    params,
  );
  return result.affectedRows > 0;
}

export async function deletePracticeSession(userId, sessionId, connection = pool) {
  const [result] = await connection.query(
    'DELETE FROM player_practice_sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId],
  );
  return result.affectedRows > 0;
}

// ---------------- Practice Matches ---------------- //

export async function listPracticeMatches(userId, filters = {}, connection = pool) {
  const conditions = ['m.user_id = ?'];
  const params = [userId];

  if (filters.sessionId) {
    conditions.push('m.session_id = ?');
    params.push(filters.sessionId);
  }
  if (filters.game) {
    conditions.push('m.game_name = ?');
    params.push(filters.game);
  }
  if (filters.startDate) {
    conditions.push('m.played_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('m.played_at <= ?');
    params.push(filters.endDate);
  }

  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const offset = Math.max(Number(filters.offset || 0), 0);

  const [rows] = await connection.query(
    `SELECT 
       m.id,
       m.session_id,
       m.user_id,
       m.match_number,
       m.played_at,
       m.game_name,
       m.placement,
       m.kills,
       m.assists,
       m.damage,
       m.score,
       m.survival_time_seconds,
       m.notes,
       s.title AS session_title,
       s.team_name,
       m.created_at
     FROM player_practice_matches m
     JOIN player_practice_sessions s ON s.id = m.session_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.played_at DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [totalRows] = await connection.query(
    `SELECT COUNT(*) AS total 
     FROM player_practice_matches m
     JOIN player_practice_sessions s ON s.id = m.session_id
     WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return {
    matches: rows,
    total: Number(totalRows[0]?.total || 0),
  };
}

export async function createPracticeMatch(userId, data, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    // Verify session belongs to user
    const [session] = await conn.query('SELECT game_name FROM player_practice_sessions WHERE id = ? AND user_id = ?', [data.sessionId, userId]);
    if (!session[0]) {
      throw new Error('Practice session not found or unauthorized');
    }

    const gameName = data.gameName || session[0].game_name;

    const [result] = await conn.query(
      `INSERT INTO player_practice_matches
       (session_id, user_id, match_number, played_at, game_name, placement, kills, assists, damage, score, survival_time_seconds, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.sessionId,
        userId,
        data.matchNumber || 1,
        data.playedAt || new Date(),
        gameName,
        data.placement != null ? Number(data.placement) : null,
        Number(data.kills || 0),
        Number(data.assists || 0),
        Number(data.damage || 0),
        Number(data.score || 0),
        data.survivalTimeSeconds != null ? Number(data.survivalTimeSeconds) : null,
        data.notes ? data.notes.trim() : null,
      ],
    );
    const matchId = result.insertId;

    if (Array.isArray(data.weapons) && data.weapons.length > 0) {
      for (const w of data.weapons) {
        if (w.weaponName) {
          await conn.query(
            `INSERT INTO player_practice_weapons (practice_match_id, weapon_name, kills, damage) VALUES (?, ?, ?, ?)`,
            [matchId, w.weaponName.trim(), Number(w.kills || 0), Number(w.damage || 0)],
          );
        }
      }
    }

    if (isDedicated) await conn.commit();
    return matchId;
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

export async function updatePracticeMatch(userId, matchId, data, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM player_practice_matches WHERE id = ? AND user_id = ?', [matchId, userId]);
    if (!existing[0]) {
      if (isDedicated) await conn.rollback();
      return false;
    }

    const fields = [];
    const params = [];

    if (data.matchNumber !== undefined) {
      fields.push('match_number = ?');
      params.push(Number(data.matchNumber));
    }
    if (data.playedAt !== undefined) {
      fields.push('played_at = ?');
      params.push(data.playedAt);
    }
    if (data.gameName !== undefined) {
      fields.push('game_name = ?');
      params.push(data.gameName.trim());
    }
    if (data.placement !== undefined) {
      fields.push('placement = ?');
      params.push(data.placement != null ? Number(data.placement) : null);
    }
    if (data.kills !== undefined) {
      fields.push('kills = ?');
      params.push(Number(data.kills));
    }
    if (data.assists !== undefined) {
      fields.push('assists = ?');
      params.push(Number(data.assists));
    }
    if (data.damage !== undefined) {
      fields.push('damage = ?');
      params.push(Number(data.damage));
    }
    if (data.score !== undefined) {
      fields.push('score = ?');
      params.push(Number(data.score));
    }
    if (data.survivalTimeSeconds !== undefined) {
      fields.push('survival_time_seconds = ?');
      params.push(data.survivalTimeSeconds != null ? Number(data.survivalTimeSeconds) : null);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      params.push(data.notes ? data.notes.trim() : null);
    }

    if (fields.length > 0) {
      params.push(matchId, userId);
      await conn.query(
        `UPDATE player_practice_matches SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        params,
      );
    }

    if (Array.isArray(data.weapons)) {
      await conn.query('DELETE FROM player_practice_weapons WHERE practice_match_id = ?', [matchId]);
      for (const w of data.weapons) {
        if (w.weaponName) {
          await conn.query(
            `INSERT INTO player_practice_weapons (practice_match_id, weapon_name, kills, damage) VALUES (?, ?, ?, ?)`,
            [matchId, w.weaponName.trim(), Number(w.kills || 0), Number(w.damage || 0)],
          );
        }
      }
    }

    if (isDedicated) await conn.commit();
    return true;
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

export async function deletePracticeMatch(userId, matchId, connection = pool) {
  const [result] = await connection.query(
    'DELETE FROM player_practice_matches WHERE id = ? AND user_id = ?',
    [matchId, userId],
  );
  return result.affectedRows > 0;
}

// ---------------- Official Tournament & Match Performance ---------------- //

export async function getOfficialTournamentHistory(userId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT DISTINCT
       t.id AS tournament_id,
       t.name AS tournament_name,
       t.game AS tournament_game,
       t.status AS tournament_status,
       t.tournament_date,
       t.completed_at,
       t.created_at,
       teams.id AS team_id,
       teams.name AS team_name,
       r.status AS registration_status,
       r.created_at AS registered_at,
       ta.final_leaderboard_json,
       ta.winners_json,
       (SELECT MIN(mr.placement) 
        FROM match_results mr 
        JOIN matches m ON m.id = mr.match_id 
        JOIN \`groups\` gg ON gg.id = m.group_id 
        JOIN rounds rd ON rd.id = gg.round_id 
        WHERE rd.tournament_id = t.id AND mr.team_id = teams.id) AS best_placement,
       (SELECT SUM(mr.kills) 
        FROM match_results mr 
        JOIN matches m ON m.id = mr.match_id 
        JOIN \`groups\` gg ON gg.id = m.group_id 
        JOIN rounds rd ON rd.id = gg.round_id 
        WHERE rd.tournament_id = t.id AND mr.team_id = teams.id) AS total_kills,
       (SELECT SUM(mr.points) 
        FROM match_results mr 
        JOIN matches m ON m.id = mr.match_id 
        JOIN \`groups\` gg ON gg.id = m.group_id 
        JOIN rounds rd ON rd.id = gg.round_id 
        WHERE rd.tournament_id = t.id AND mr.team_id = teams.id) AS total_points,
       (SELECT COUNT(DISTINCT m.id) 
        FROM match_results mr 
        JOIN matches m ON m.id = mr.match_id 
        JOIN \`groups\` gg ON gg.id = m.group_id 
        JOIN rounds rd ON rd.id = gg.round_id 
        WHERE rd.tournament_id = t.id AND mr.team_id = teams.id) AS matches_played
     FROM tournaments t
     JOIN registrations r ON r.tournament_id = t.id AND r.status = 'VERIFIED'
     JOIN teams ON teams.id = r.team_id
     JOIN team_members tm ON tm.team_id = teams.id AND tm.user_id = ?
     LEFT JOIN tournament_archives ta ON ta.tournament_id = t.id
     ORDER BY t.completed_at DESC, t.tournament_date DESC, t.created_at DESC`,
    [userId],
  );

  return rows.map((row) => {
    let archiveRank = null;
    if (row.final_leaderboard_json) {
      try {
        const board = typeof row.final_leaderboard_json === 'string'
          ? JSON.parse(row.final_leaderboard_json)
          : row.final_leaderboard_json;
        if (Array.isArray(board)) {
          const entry = board.find((e) => Number(e.teamId) === Number(row.team_id));
          if (entry) archiveRank = entry.rank;
        }
      } catch {
        archiveRank = null;
      }
    }

    return {
      tournamentId: row.tournament_id,
      tournamentName: row.tournament_name,
      game: row.tournament_game || 'Free Fire',
      status: row.tournament_status,
      tournamentDate: row.tournament_date,
      completedAt: row.completed_at,
      teamId: row.team_id,
      teamName: row.team_name,
      finalRank: archiveRank || row.best_placement || null,
      matchesPlayed: Number(row.matches_played || 0),
      totalKills: Number(row.total_kills || 0),
      totalPoints: Number(row.total_points || 0),
    };
  });
}

export async function getOfficialMatchResults(userId, filters = {}, connection = pool) {
  const conditions = [
    'r.status = "VERIFIED"',
    'tm.user_id = ?',
  ];
  const params = [userId];

  if (filters.game) {
    conditions.push('t.game = ?');
    params.push(filters.game);
  }
  if (filters.startDate) {
    conditions.push('mr.created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('mr.created_at <= ?');
    params.push(filters.endDate);
  }

  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const offset = Math.max(Number(filters.offset || 0), 0);

  const [rows] = await connection.query(
    `SELECT 
       mr.id,
       mr.match_id,
       mr.team_id,
       mr.points,
       mr.kills,
       mr.placement,
       mr.result_text,
       mr.created_at,
       m.name AS match_name,
       m.match_number,
       gg.id AS group_id,
       gg.name AS group_name,
       rd.id AS round_id,
       rd.name AS round_name,
       t.id AS tournament_id,
       t.name AS tournament_name,
       t.game AS game_name,
       teams.name AS team_name
     FROM match_results mr
     JOIN matches m ON m.id = mr.match_id
     JOIN \`groups\` gg ON gg.id = m.group_id
     JOIN rounds rd ON rd.id = gg.round_id
     JOIN tournaments t ON t.id = rd.tournament_id
     JOIN teams ON teams.id = mr.team_id
     JOIN team_members tm ON tm.team_id = teams.id
     JOIN registrations r ON r.team_id = teams.id AND r.tournament_id = t.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY mr.created_at DESC, mr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [totalRows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM match_results mr
     JOIN matches m ON m.id = mr.match_id
     JOIN \`groups\` gg ON gg.id = m.group_id
     JOIN rounds rd ON rd.id = gg.round_id
     JOIN tournaments t ON t.id = rd.tournament_id
     JOIN teams ON teams.id = mr.team_id
     JOIN team_members tm ON tm.team_id = teams.id
     JOIN registrations r ON r.team_id = teams.id AND r.tournament_id = t.id
     WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return {
    matches: rows.map((r) => ({
      id: r.id,
      matchId: r.match_id,
      teamId: r.team_id,
      teamName: r.team_name,
      gameName: r.game_name || 'Free Fire',
      tournamentId: r.tournament_id,
      tournamentName: r.tournament_name,
      roundName: r.round_name,
      groupName: r.group_name,
      matchName: r.match_name,
      matchNumber: r.match_number,
      placement: r.placement != null ? Number(r.placement) : null,
      kills: Number(r.kills || 0),
      points: Number(r.points || 0),
      playedAt: r.created_at,
      source: 'OFFICIAL_VERIFIED',
    })),
    total: Number(totalRows[0]?.total || 0),
  };
}

// ---------------- Discovery & Search ---------------- //

export async function searchPublicPlayers(query, limit = 10, connection = pool) {
  const safeLimit = Math.min(Math.max(Number(limit), 1), 25);
  const clean = query.trim();

  // Exact EVOQ ID lookup takes priority
  const [exactRows] = await connection.query(
    `SELECT 
       u.id AS user_id,
       u.name,
       pp.unique_player_id,
       pp.in_game_name,
       pp.avatar_url,
       pp.country,
       pp.city,
       pp.bio,
       (SELECT pgp.game_name FROM player_game_profiles pgp WHERE pgp.user_id = u.id AND pgp.is_primary = TRUE LIMIT 1) AS primary_game,
       (SELECT pgp.primary_role FROM player_game_profiles pgp WHERE pgp.user_id = u.id AND pgp.is_primary = TRUE LIMIT 1) AS primary_role,
       (SELECT pgp.started_playing_at FROM player_game_profiles pgp WHERE pgp.user_id = u.id AND pgp.is_primary = TRUE LIMIT 1) AS started_playing_at,
       (SELECT t.name FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = u.id ORDER BY t.updated_at DESC LIMIT 1) AS current_team
     FROM player_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.unique_player_id = ? AND pp.is_public = TRUE
     LIMIT 1`,
    [clean],
  );

  if (exactRows.length > 0) {
    return exactRows;
  }

  // Partial search by EVOQ ID, name, or IGN
  const term = `%${clean}%`;
  const [rows] = await connection.query(
    `SELECT 
       u.id AS user_id,
       u.name,
       pp.unique_player_id,
       pp.in_game_name,
       pp.avatar_url,
       pp.country,
       pp.city,
       pp.bio,
       (SELECT pgp.game_name FROM player_game_profiles pgp WHERE pgp.user_id = u.id AND pgp.is_primary = TRUE LIMIT 1) AS primary_game,
       (SELECT pgp.primary_role FROM player_game_profiles pgp WHERE pgp.user_id = u.id AND pgp.is_primary = TRUE LIMIT 1) AS primary_role,
       (SELECT pgp.started_playing_at FROM player_game_profiles pgp WHERE pgp.user_id = u.id AND pgp.is_primary = TRUE LIMIT 1) AS started_playing_at,
       (SELECT t.name FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = u.id ORDER BY t.updated_at DESC LIMIT 1) AS current_team
     FROM player_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.is_public = TRUE
       AND (pp.unique_player_id LIKE ? OR u.name LIKE ? OR pp.in_game_name LIKE ?)
     ORDER BY pp.unique_player_id = ? DESC, u.name ASC
     LIMIT ?`,
    [term, term, term, clean, safeLimit],
  );

  return rows;
}
