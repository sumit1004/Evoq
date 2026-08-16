import { pool } from '../config/database.js';

export async function getTournamentAccess(tournamentId, userId) { const [rows] = await pool.query('SELECT t.id, t.organizer_id, t.status, EXISTS (SELECT 1 FROM group_teams gt JOIN `groups` g ON g.id = gt.group_id JOIN rounds r ON r.id = g.round_id JOIN team_members tm ON tm.team_id = gt.team_id WHERE r.tournament_id = t.id AND tm.user_id = ?) AS is_participant FROM tournaments t WHERE t.id = ?', [userId, tournamentId]); return rows[0] || null; }
export async function getGroupAccess(groupId, userId) { const [rows] = await pool.query('SELECT g.id, r.tournament_id, t.organizer_id, t.status AS tournament_status, (t.organizer_id = ?) AS is_organizer, EXISTS (SELECT 1 FROM group_teams gt JOIN team_members tm ON tm.team_id = gt.team_id WHERE gt.group_id = g.id AND tm.user_id = ?) AS is_participant FROM `groups` g JOIN rounds r ON r.id = g.round_id JOIN tournaments t ON t.id = r.tournament_id WHERE g.id = ?', [userId, userId, groupId]); return rows[0] || null; }
export async function listAnnouncements(tournamentId) { const [rows] = await pool.query('SELECT a.id, a.tournament_id, a.created_by, u.name AS creator_name, a.message, a.created_at FROM announcements a JOIN users u ON u.id = a.created_by WHERE a.tournament_id = ? ORDER BY a.created_at DESC, a.id DESC', [tournamentId]); return rows; }
export async function createAnnouncement(tournamentId, userId, message) { const [result] = await pool.query('INSERT INTO announcements (tournament_id, created_by, message) VALUES (?, ?, ?)', [tournamentId, userId, message]); const [rows] = await pool.query('SELECT a.id, a.tournament_id, a.created_by, u.name AS creator_name, a.message, a.created_at FROM announcements a JOIN users u ON u.id = a.created_by WHERE a.id = ?', [result.insertId]); return rows[0]; }
export async function listTournamentParticipantIds(tournamentId) { const [rows] = await pool.query('SELECT DISTINCT tm.user_id FROM group_teams gt JOIN `groups` g ON g.id = gt.group_id JOIN rounds r ON r.id = g.round_id JOIN team_members tm ON tm.team_id = gt.team_id WHERE r.tournament_id = ?', [tournamentId]); return rows.map((row) => row.user_id); }
export async function createNotifications(userIds, tournamentId, type, content) {
  if (!userIds.length) return [];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const created = [];
    for (const userId of userIds) {
      const [result] = await connection.query('INSERT INTO notifications (user_id, tournament_id, type, content) VALUES (?, ?, ?, ?)', [userId, tournamentId, type, content]);
      created.push({ id: result.insertId, userId, tournamentId, type, content, readAt: null, createdAt: new Date().toISOString() });
    }
    await connection.commit();
    return created;
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
export async function deleteAnnouncement(announcementId) { await pool.query('DELETE FROM announcements WHERE id = ?', [announcementId]); }
export async function findAnnouncement(announcementId) { const [rows] = await pool.query('SELECT id, tournament_id, created_by, message, created_at FROM announcements WHERE id = ?', [announcementId]); return rows[0] || null; }
export async function listNotifications(userId) { const [rows] = await pool.query('SELECT id, user_id, tournament_id, type, content, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC', [userId]); return rows; }
export async function markNotificationRead(notificationId, userId) { await pool.query('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [notificationId, userId]); }
export async function markAllNotificationsRead(userId) { await pool.query('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL', [userId]); }
export async function listChatMessages(groupId) { const [rows] = await pool.query('SELECT c.id, c.group_id, c.sender_id, u.name AS sender_name, c.message, c.created_at FROM chat_messages c JOIN users u ON u.id = c.sender_id WHERE c.group_id = ? ORDER BY c.created_at ASC, c.id ASC', [groupId]); return rows; }
export async function createChatMessage(groupId, userId, message) { const [result] = await pool.query('INSERT INTO chat_messages (group_id, sender_id, message) VALUES (?, ?, ?)', [groupId, userId, message]); const [rows] = await pool.query('SELECT c.id, c.group_id, c.sender_id, u.name AS sender_name, c.message, c.created_at FROM chat_messages c JOIN users u ON u.id = c.sender_id WHERE c.id = ?', [result.insertId]); return rows[0]; }
