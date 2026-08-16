import { asyncHandler } from '../utils/asyncHandler.js';
import { createMyTeam, deleteMyTeam, getMyTeam, listMyTeams } from '../services/teamService.js';

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
