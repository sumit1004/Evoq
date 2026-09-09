import { pool } from '../config/database.js';

/**
 * Finds an existing 1-to-1 direct conversation between two users (optionally scoped to an organization)
 * or creates a new conversation atomically.
 */
export async function findOrCreateDirectConversation(user1Id, user2Id, organizationId = null, connection = pool) {
  const u1 = Number(user1Id);
  const u2 = Number(user2Id);

  if (u1 === u2) {
    throw new Error('Cannot create a direct conversation with yourself');
  }

  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    // Check if a conversation with exactly these two participants already exists
    const [existingRows] = await conn.query(
      `SELECT c.id, c.type, c.organization_id, c.created_at, c.updated_at
       FROM direct_conversations c
       JOIN direct_conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
       JOIN direct_conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
       WHERE (c.organization_id <=> ?)
       LIMIT 1`,
      [u1, u2, organizationId ? Number(organizationId) : null],
    );

    if (existingRows.length > 0) {
      if (isDedicated) await conn.commit();
      return { conversation: existingRows[0], isNew: false };
    }

    // Create new conversation
    const convType = organizationId ? 'ORGANIZATION' : 'DIRECT';
    const [createResult] = await conn.query(
      'INSERT INTO direct_conversations (type, organization_id) VALUES (?, ?)',
      [convType, organizationId ? Number(organizationId) : null],
    );
    const conversationId = createResult.insertId;

    // Add both participants
    await conn.query(
      `INSERT INTO direct_conversation_participants (conversation_id, user_id, last_read_at)
       VALUES (?, ?, NOW()), (?, ?, NULL)`,
      [conversationId, u1, conversationId, u2],
    );

    const [newConv] = await conn.query(
      'SELECT id, type, organization_id, created_at, updated_at FROM direct_conversations WHERE id = ?',
      [conversationId],
    );

    if (isDedicated) await conn.commit();
    return { conversation: newConv[0], isNew: true };
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

/**
 * Checks if a user is an authorized participant in a conversation.
 */
export async function isConversationParticipant(conversationId, userId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT 1 FROM direct_conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    [Number(conversationId), Number(userId)],
  );
  return rows.length > 0;
}

/**
 * Gets conversation metadata and ensures user is a participant.
 */
export async function getConversationById(conversationId, userId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT 
       c.id,
       c.type,
       c.organization_id,
       c.created_at,
       c.updated_at,
       o.name AS organization_name,
       o.logo_url AS organization_logo_url,
       p.last_read_at
     FROM direct_conversations c
     JOIN direct_conversation_participants p ON p.conversation_id = c.id AND p.user_id = ?
     LEFT JOIN organizations o ON o.id = c.organization_id
     WHERE c.id = ?
     LIMIT 1`,
    [Number(userId), Number(conversationId)],
  );

  if (!rows[0]) return null;

  // Fetch other participant(s) details
  const [otherParticipants] = await connection.query(
    `SELECT 
       u.id AS user_id,
       u.name,
       u.role,
       pp.unique_player_id,
       pp.avatar_url,
       pp.in_game_name
     FROM direct_conversation_participants p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE p.conversation_id = ? AND p.user_id <> ?`,
    [Number(conversationId), Number(userId)],
  );

  return {
    ...rows[0],
    otherParticipant: otherParticipants[0] || null,
  };
}

/**
 * Lists all conversations for a user with unread counts and latest message.
 */
export async function listUserConversations(userId, connection = pool) {
  const uid = Number(userId);

  const [rows] = await connection.query(
    `SELECT 
       c.id,
       c.type,
       c.organization_id,
       c.updated_at,
       o.name AS organization_name,
       o.logo_url AS organization_logo_url,
       my_p.last_read_at,
       other_u.id AS other_user_id,
       other_u.name AS other_user_name,
       other_u.role AS other_user_role,
       other_pp.unique_player_id AS other_unique_player_id,
       other_pp.avatar_url AS other_avatar_url,
       other_pp.in_game_name AS other_in_game_name,
       (SELECT dm.message 
        FROM direct_messages dm 
        WHERE dm.conversation_id = c.id 
        ORDER BY dm.created_at DESC, dm.id DESC 
        LIMIT 1) AS last_message,
       (SELECT dm.created_at 
        FROM direct_messages dm 
        WHERE dm.conversation_id = c.id 
        ORDER BY dm.created_at DESC, dm.id DESC 
        LIMIT 1) AS last_message_at,
       (SELECT dm.sender_id 
        FROM direct_messages dm 
        WHERE dm.conversation_id = c.id 
        ORDER BY dm.created_at DESC, dm.id DESC 
        LIMIT 1) AS last_message_sender_id,
       (SELECT COUNT(*) 
        FROM direct_messages dm 
        WHERE dm.conversation_id = c.id 
          AND dm.sender_id <> ?
          AND (my_p.last_read_at IS NULL OR dm.created_at > my_p.last_read_at)) AS unread_count
     FROM direct_conversations c
     JOIN direct_conversation_participants my_p ON my_p.conversation_id = c.id AND my_p.user_id = ?
     JOIN direct_conversation_participants other_p ON other_p.conversation_id = c.id AND other_p.user_id <> ?
     JOIN users other_u ON other_u.id = other_p.user_id
     LEFT JOIN player_profiles other_pp ON other_pp.user_id = other_u.id
     LEFT JOIN organizations o ON o.id = c.organization_id
     ORDER BY c.updated_at DESC, c.id DESC`,
    [uid, uid, uid],
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    organizationId: r.organization_id,
    organizationName: r.organization_name,
    organizationLogoUrl: r.organization_logo_url,
    updatedAt: r.updated_at,
    lastReadAt: r.last_read_at,
    lastMessage: r.last_message,
    lastMessageAt: r.last_message_at,
    lastMessageSenderId: r.last_message_sender_id,
    unreadCount: Number(r.unread_count || 0),
    participant: {
      userId: r.other_user_id,
      name: r.other_user_name,
      role: r.other_user_role,
      uniquePlayerId: r.other_unique_player_id,
      avatarUrl: r.other_avatar_url,
      inGameName: r.other_in_game_name,
    },
  }));
}

/**
 * Returns paginated messages for a conversation (chronological order).
 */
export async function listMessages(conversationId, { limit = 40, beforeId = null, offset = 0 } = {}, connection = pool) {
  const safeLimit = Math.min(Math.max(Number(limit || 40), 1), 100);
  const conditions = ['m.conversation_id = ?'];
  const params = [Number(conversationId)];

  if (beforeId) {
    conditions.push('m.id < ?');
    params.push(Number(beforeId));
  }

  const [rows] = await connection.query(
    `SELECT 
       m.id,
       m.conversation_id,
       m.sender_id,
       m.message,
       m.created_at,
       m.read_at,
       u.name AS sender_name,
       pp.avatar_url AS sender_avatar_url
     FROM direct_messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, Number(offset || 0)],
  );

  // Return in chronological order (oldest to newest)
  const messages = rows.reverse().map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatarUrl: r.sender_avatar_url,
    message: r.message,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));

  const [countResult] = await connection.query(
    'SELECT COUNT(*) AS total FROM direct_messages WHERE conversation_id = ?',
    [Number(conversationId)],
  );

  return {
    messages,
    total: Number(countResult[0]?.total || 0),
  };
}

/**
 * Creates a direct message in a conversation and updates the conversation updated_at timestamp.
 */
export async function createDirectMessage(conversationId, senderId, messageText, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    const [msgResult] = await conn.query(
      'INSERT INTO direct_messages (conversation_id, sender_id, message) VALUES (?, ?, ?)',
      [Number(conversationId), Number(senderId), messageText.trim()],
    );
    const messageId = msgResult.insertId;

    // Update conversation timestamp
    await conn.query(
      'UPDATE direct_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Number(conversationId)],
    );

    // Update sender's last_read_at timestamp
    await conn.query(
      'UPDATE direct_conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
      [Number(conversationId), Number(senderId)],
    );

    const [createdRows] = await conn.query(
      `SELECT 
         m.id,
         m.conversation_id,
         m.sender_id,
         m.message,
         m.created_at,
         m.read_at,
         u.name AS sender_name,
         pp.avatar_url AS sender_avatar_url
       FROM direct_messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN player_profiles pp ON pp.user_id = u.id
       WHERE m.id = ?`,
      [messageId],
    );

    if (isDedicated) await conn.commit();

    const row = createdRows[0];
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderAvatarUrl: row.sender_avatar_url,
      message: row.message,
      createdAt: row.created_at,
      readAt: row.read_at,
    };
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

/**
 * Marks conversation messages as read for a given user.
 */
export async function markConversationAsRead(conversationId, userId, connection = pool) {
  const conn = connection === pool ? await pool.getConnection() : connection;
  const isDedicated = connection === pool;

  try {
    if (isDedicated) await conn.beginTransaction();

    await conn.query(
      'UPDATE direct_conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
      [Number(conversationId), Number(userId)],
    );

    await conn.query(
      'UPDATE direct_messages SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL',
      [Number(conversationId), Number(userId)],
    );

    if (isDedicated) await conn.commit();
    return true;
  } catch (error) {
    if (isDedicated) await conn.rollback();
    throw error;
  } finally {
    if (isDedicated) conn.release();
  }
}

/**
 * Returns other participant user IDs in a conversation.
 */
export async function getConversationRecipients(conversationId, senderId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT user_id FROM direct_conversation_participants WHERE conversation_id = ? AND user_id <> ?',
    [Number(conversationId), Number(senderId)],
  );
  return rows.map((r) => Number(r.user_id));
}
