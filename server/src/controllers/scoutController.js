import * as staffService from '../services/staffService.js';

export async function listAssignedTournaments(req, res, next) {
  try {
    const tournaments = await staffService.listScoutTournaments(req.user.id);
    res.json({ tournaments });
  } catch (error) {
    next(error);
  }
}

export async function getScoutTournamentOverview(req, res, next) {
  try {
    const data = await staffService.getScoutTournamentWorkspace(
      req.params.tournamentId,
      req.user.id
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getScoutGroupDetails(req, res, next) {
  try {
    const data = await staffService.getScoutGroupWorkspace(
      req.params.tournamentId,
      req.params.groupId,
      req.user.id
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
}
