import { errorResponses } from '../errors/AppError.js';
import * as repository from '../repositories/communicationRepository.js';
import * as staffRepo from '../repositories/staffRepository.js';
import { assertTournamentAuthorization, resolveTournamentStaffContext, PERMISSIONS } from './authorizationService.js';

function announcementDto(row) { return { id: row.id, tournamentId: row.tournament_id, createdBy: row.created_by, creatorName: row.creator_name, message: row.message, createdAt: row.created_at }; }
function notificationDto(row) { return { id: row.id, tournamentId: row.tournament_id, type: row.type, content: row.content, readAt: row.read_at, createdAt: row.created_at }; }
function chatDto(row) { return { id: row.id, groupId: row.group_id, senderId: row.sender_id, senderName: row.sender_name, message: row.message, createdAt: row.created_at }; }

async function assertTournament(tournamentId, userId, write = false) {
  const context = await repository.getTournamentAccess(tournamentId, userId);
  if (!context) throw errorResponses.notFound('Tournament not found');
  if (write) {
    if (context.organizer_id !== userId) {
      try {
        await assertTournamentAuthorization(tournamentId, userId, {
          permission: PERMISSIONS.CREATE_ANNOUNCEMENTS,
          isWrite: true,
        });
      } catch {
        throw errorResponses.forbidden();
      }
    }
    if (context.status === 'COMPLETED') throw errorResponses.conflict('Completed tournaments are read-only');
    return context;
  }
  let allowed = context.organizer_id === userId || Boolean(context.is_participant);
  if (!allowed) {
    try {
      const staff = await resolveTournamentStaffContext(tournamentId, userId);
      allowed = Boolean(staff?.isStaff);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw errorResponses.notFound('Tournament not found');
  return context;
}

async function assertGroup(groupId, userId, write = false) {
  const context = await repository.getGroupAccess(groupId, userId);
  if (!context) throw errorResponses.notFound('Group not found');
  let allowed = Boolean(context.is_organizer || context.is_participant);
  if (!allowed && context.tournament_id) {
    try {
      const staff = await resolveTournamentStaffContext(context.tournament_id, userId);
      if (staff?.isStaff) {
        allowed = Boolean(staff.allGroups || staff.assignedGroupIds?.has(Number(groupId)));
      }
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw errorResponses.notFound('Group not found');
  if (context.tournament_status === 'COMPLETED' && write) throw errorResponses.conflict('Completed tournaments are read-only');
  return context;
}

export async function listAnnouncements(tournamentId, userId) {
  await assertTournament(tournamentId, userId);
  return (await repository.listAnnouncements(tournamentId)).map(announcementDto);
}

export async function createAnnouncement(tournamentId, message, userId) {
  await assertTournament(tournamentId, userId, true);
  if (!message?.trim() || message.trim().length > 2000) throw errorResponses.validation({ message: 'message must be 1 to 2000 characters' });
  const allRecipients = await repository.listTournamentParticipantIds(tournamentId);
  const recipientIds = allRecipients.filter((id) => Number(id) !== Number(userId));
  const announcement = announcementDto(await repository.createAnnouncement(tournamentId, userId, message.trim()));
  const notifications = await repository.createNotifications(recipientIds, tournamentId, 'ANNOUNCEMENT', announcement.message);
  await staffRepo.insertAuditLog({
    tournamentId: Number(tournamentId),
    userId,
    actorId: userId,
    action: 'ANNOUNCEMENT_CREATED',
    entityType: 'ANNOUNCEMENT',
    entityId: announcement.id,
    metadata: { message: announcement.message },
  });
  return { announcement, recipientIds: allRecipients, notifications: notifications || [] };
}

export async function deleteAnnouncement(announcementId, userId) {
  const announcement = await repository.findAnnouncement(announcementId);
  if (!announcement) throw errorResponses.notFound('Announcement not found');
  await assertTournament(announcement.tournament_id, userId, true);
  await repository.deleteAnnouncement(announcementId);
  return { id: announcementId, tournamentId: announcement.tournament_id };
}

export async function listNotifications(userId) {
  return (await repository.listNotifications(userId)).map(notificationDto);
}

export async function markNotificationRead(id, userId) {
  await repository.markNotificationRead(id, userId);
}

export async function markAllNotificationsRead(userId) {
  await repository.markAllNotificationsRead(userId);
}

export async function listChat(groupId, userId) {
  await assertGroup(groupId, userId);
  return (await repository.listChatMessages(groupId)).map(chatDto);
}

export async function sendChat(groupId, message, userId) {
  await assertGroup(groupId, userId, true);
  if (!message?.trim() || message.trim().length > 1000) throw errorResponses.validation({ message: 'message must be 1 to 1000 characters' });
  return chatDto(await repository.createChatMessage(groupId, userId, message.trim()));
}

export async function canJoinTournament(tournamentId, userId) {
  const id = Number(tournamentId);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const context = await repository.getTournamentAccess(id, userId);
  if (context && (context.organizer_id === userId || Boolean(context.is_participant))) {
    return true;
  }
  const staff = await resolveTournamentStaffContext(id, userId);
  return Boolean(staff?.isStaff);
}

export async function canJoinGroup(groupId, userId) {
  const id = Number(groupId);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const context = await repository.getGroupAccess(id, userId);
  if (!context) return false;
  if (context.is_organizer || context.is_participant) return true;
  const staff = await resolveTournamentStaffContext(context.tournament_id, userId);
  if (staff?.isStaff) {
    return Boolean(staff.allGroups || staff.assignedGroupIds?.has(Number(id)));
  }
  return false;
}

