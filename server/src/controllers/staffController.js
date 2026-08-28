import * as staffService from '../services/staffService.js';

export async function searchScouts(req, res, next) {
  try {
    const results = await staffService.searchScoutCandidates(
      req.query.query,
      req.query.tournamentId,
      req.user.id
    );
    res.json({ results });
  } catch (error) {
    next(error);
  }
}

export async function listTournamentStaff(req, res, next) {
  try {
    const staff = await staffService.listTournamentStaff(req.params.tournamentId, req.user.id);
    res.json({ staff });
  } catch (error) {
    next(error);
  }
}

export async function assignTournamentStaff(req, res, next) {
  try {
    const staff = await staffService.assignTournamentStaff(
      req.params.tournamentId,
      req.body,
      req.user.id
    );
    res.status(201).json({ staff });
  } catch (error) {
    next(error);
  }
}

export async function updateTournamentStaff(req, res, next) {
  try {
    const staff = await staffService.updateTournamentStaff(
      req.params.tournamentId,
      req.params.staffId,
      req.body,
      req.user.id
    );
    res.json({ staff });
  } catch (error) {
    next(error);
  }
}

export async function revokeTournamentStaff(req, res, next) {
  try {
    const staff = await staffService.revokeTournamentStaff(
      req.params.tournamentId,
      req.params.staffId,
      req.user.id
    );
    res.json({ staff });
  } catch (error) {
    next(error);
  }
}

export async function listAuditLogs(req, res, next) {
  try {
    const logs = await staffService.listAuditLogs(
      req.params.tournamentId,
      req.user.id,
      req.query
    );
    res.json(logs);
  } catch (error) {
    next(error);
  }
}

export async function listMyOrganizationStaff(req, res, next) {
  try {
    const staff = await staffService.listOrganizationStaff(req.user.id);
    res.json({ staff });
  } catch (error) {
    next(error);
  }
}
