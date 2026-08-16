import { asyncHandler } from '../utils/asyncHandler.js';
import * as service from '../services/archiveService.js';
export const completeTournament = asyncHandler(async (req, res) => res.status(201).json({ archive: await service.completeTournament(Number(req.params.tournamentId), req.user.id) }));
export const listHistory = asyncHandler(async (_req, res) => res.json({ history: await service.listHistory() }));
export const getHistory = asyncHandler(async (req, res) => res.json({ archive: await service.getHistoryById(Number(req.params.historyId)) }));
export const deleteHistory = asyncHandler(async (req, res) => { await service.deleteHistory(Number(req.params.historyId), req.user); res.status(204).send(); });
