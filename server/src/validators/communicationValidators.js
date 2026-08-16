function positiveId(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
export function validateTournamentId(params) { return positiveId(params.tournamentId) ? {} : { tournamentId: 'tournamentId must be a positive integer' }; }
export function validateGroupId(params) { return positiveId(params.groupId) ? {} : { groupId: 'groupId must be a positive integer' }; }
export function validateAnnouncementId(params) { return positiveId(params.announcementId) ? {} : { announcementId: 'announcementId must be a positive integer' }; }
export function validateNotificationId(params) { return positiveId(params.notificationId) ? {} : { notificationId: 'notificationId must be a positive integer' }; }
export function validateMessage(body) { return body.message?.trim() ? {} : { message: 'message is required' }; }
