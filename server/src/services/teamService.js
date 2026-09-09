import {
  createTeam,
  deleteTeam,
  findTeamForUser,
  getTeamOwner,
  listTeamsForUser,
  resolvePlayerIds,
  updateTeamLogo,
} from '../repositories/teamRepository.js';
import { errorResponses } from '../errors/AppError.js';
import { deleteMediaObject, replaceMediaObject } from './mediaService.js';

function normalizePlayerIds(ids) {
  return ids.map((id) => id.trim().toUpperCase());
}

function groupTeamRows(rows) {
  const teams = new Map();
  for (const row of rows) {
    if (!teams.has(row.id)) {
      teams.set(row.id, {
        id: row.id,
        name: row.name,
        logoUrl: row.logo_url || null,
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        members: [],
      });
    }
    const team = teams.get(row.id);
    if (!team.members.some((member) => member.id === row.member_id)) {
      team.members.push({
        id: row.member_id,
        name: row.member_name,
        email: row.member_email,
        uniquePlayerId: row.unique_player_id,
        role: row.member_role || 'MEMBER',
        mobile: row.mobile,
        inGameName: row.in_game_name,
        gameUid: row.game_uid,
      });
    }
  }
  return [...teams.values()];
}

export async function listMyTeams(userId) {
  return groupTeamRows(await listTeamsForUser(userId));
}

export async function getMyTeam(teamId, userId) {
  const rows = await findTeamForUser(teamId, userId);
  if (rows.length === 0) throw errorResponses.notFound('Team not found');
  return groupTeamRows(rows)[0];
}

export async function createMyTeam({ name, memberPlayerIds, logoUrl = null }, ownerId) {
  const playerIds = normalizePlayerIds(memberPlayerIds);
  const players = await resolvePlayerIds(playerIds);
  if (players.length !== playerIds.length) {
    const found = new Set(players.map((player) => player.unique_player_id));
    const missing = playerIds.filter((id) => !found.has(id));
    throw errorResponses.validation({ memberPlayerIds: `Unknown player IDs: ${missing.join(', ')}` });
  }

  const memberIds = players.map((player) => player.id);
  if (memberIds.includes(ownerId)) {
    throw errorResponses.validation({ memberPlayerIds: 'The team owner is added automatically and must not be listed' });
  }

  try {
    const teamId = await createTeam({ name: name.trim(), ownerId, memberIds, logoUrl });
    return getMyTeam(teamId, ownerId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw errorResponses.conflict('The team membership already exists');
    throw error;
  }
}

export async function uploadTeamLogoService(teamId, file, userId) {
  const team = await getTeamOwner(teamId);
  if (!team) throw errorResponses.notFound('Team not found');
  if (Number(team.owner_id) !== Number(userId)) throw errorResponses.forbidden('Only the team owner can update the team logo');

  const media = await replaceMediaObject({
    oldKeyOrUrl: team.logo_url,
    newFile: file,
    category: 'teams',
    entityId: teamId,
    type: 'logo',
  });

  await updateTeamLogo(teamId, media.url);
  return getMyTeam(teamId, userId);
}

export async function removeTeamLogoService(teamId, userId) {
  const team = await getTeamOwner(teamId);
  if (!team) throw errorResponses.notFound('Team not found');
  if (Number(team.owner_id) !== Number(userId)) throw errorResponses.forbidden('Only the team owner can remove the team logo');

  if (team.logo_url) {
    await deleteMediaObject(team.logo_url).catch(() => {});
    await updateTeamLogo(teamId, null);
  }

  return getMyTeam(teamId, userId);
}

export async function deleteMyTeam(teamId, userId) {
  const team = await getTeamOwner(teamId);
  if (!team) throw errorResponses.notFound('Team not found');
  if (Number(team.owner_id) !== Number(userId)) throw errorResponses.forbidden();

  try {
    await deleteTeam(teamId);
    if (team.logo_url) {
      await deleteMediaObject(team.logo_url).catch(() => {});
    }
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      throw errorResponses.conflict('This team cannot be deleted while it has tournament registrations');
    }
    throw error;
  }
}

