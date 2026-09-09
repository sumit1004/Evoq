import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createMyTeam,
  deleteMyTeam,
  getMyTeam,
  listMyTeams,
  removeTeamLogoService,
  uploadTeamLogoService,
} from '../services/teamService.js';
import { errorResponses } from '../errors/AppError.js';

export const listTeams = asyncHandler(async (req, res) => {
  res.status(200).json({ teams: await listMyTeams(req.user.id) });
});

export const createTeamController = asyncHandler(async (req, res) => {
  res.status(201).json({ team: await createMyTeam(req.body, req.user.id) });
});

export const getTeam = asyncHandler(async (req, res) => {
  res.status(200).json({ team: await getMyTeam(Number(req.params.teamId), req.user.id) });
});

export const deleteTeamController = asyncHandler(async (req, res) => {
  await deleteMyTeam(Number(req.params.teamId), req.user.id);
  res.status(204).send();
});

export const uploadTeamLogoController = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw errorResponses.validation({ logo: 'A logo image file is required' });
  }
  const team = await uploadTeamLogoService(Number(req.params.teamId), req.file, req.user.id);
  res.status(200).json({ team, message: 'Team logo updated successfully' });
});

export const deleteTeamLogoController = asyncHandler(async (req, res) => {
  const team = await removeTeamLogoService(Number(req.params.teamId), req.user.id);
  res.status(200).json({ team, message: 'Team logo removed successfully' });
});

