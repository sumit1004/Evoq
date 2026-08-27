import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/scoringRepository.js', () => ({
  findScoringConfig: vi.fn(),
  listPositionPoints: vi.fn(),
  saveScoringConfig: vi.fn(),
  getTournamentContext: vi.fn(),
}));

import * as scoringRepo from '../repositories/scoringRepository.js';
import {
  calculateMatchTeamScore,
  DEFAULT_POSITION_POINTS,
  getTournamentScoringConfig,
  updateTournamentScoringConfig,
} from './scoringService.js';

describe('scoringService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTournamentScoringConfig', () => {
    it('returns default scoring configuration when none exists in DB', async () => {
      scoringRepo.getTournamentContext.mockResolvedValue({ id: 1, organizer_id: 10, status: 'LIVE' });
      scoringRepo.findScoringConfig.mockResolvedValue(null);
      scoringRepo.listPositionPoints.mockResolvedValue([]);

      const config = await getTournamentScoringConfig(1);
      expect(config).toMatchObject({
        tournamentId: 1,
        scoringMode: 'KILLS_AND_POSITION',
        killPointsPerKill: 1,
        positionPoints: DEFAULT_POSITION_POINTS,
      });
    });

    it('returns saved configuration from database', async () => {
      scoringRepo.getTournamentContext.mockResolvedValue({ id: 1, organizer_id: 10, status: 'LIVE' });
      scoringRepo.findScoringConfig.mockResolvedValue({
        tournament_id: 1,
        scoring_mode: 'TOTAL_SCORE',
        kill_points_per_kill: 2,
        created_at: '2026-08-26',
        updated_at: '2026-08-26',
      });
      scoringRepo.listPositionPoints.mockResolvedValue([
        { position: 1, points: 15 },
        { position: 2, points: 10 },
      ]);

      const config = await getTournamentScoringConfig(1);
      expect(config.scoringMode).toBe('TOTAL_SCORE');
      expect(config.killPointsPerKill).toBe(2);
      expect(config.positionPoints).toEqual([
        { position: 1, points: 15 },
        { position: 2, points: 10 },
      ]);
    });
  });

  describe('updateTournamentScoringConfig', () => {
    it('rejects update if caller is not the tournament organizer', async () => {
      scoringRepo.getTournamentContext.mockResolvedValue({ id: 1, organizer_id: 99, status: 'LIVE' });
      await expect(
        updateTournamentScoringConfig(1, { scoringMode: 'KILLS_AND_POSITION' }, 10)
      ).rejects.toMatchObject({ status: 404 });
    });

    it('rejects update if tournament is COMPLETED', async () => {
      scoringRepo.getTournamentContext.mockResolvedValue({ id: 1, organizer_id: 10, status: 'COMPLETED' });
      await expect(
        updateTournamentScoringConfig(1, { scoringMode: 'KILLS_AND_POSITION' }, 10)
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rejects duplicate position configurations', async () => {
      scoringRepo.getTournamentContext.mockResolvedValue({ id: 1, organizer_id: 10, status: 'LIVE' });
      await expect(
        updateTournamentScoringConfig(
          1,
          {
            scoringMode: 'KILLS_AND_POSITION',
            positionPoints: [
              { position: 1, points: 10 },
              { position: 1, points: 12 },
            ],
          },
          10
        )
      ).rejects.toMatchObject({ status: 400 });
    });

    it('validates and saves valid scoring config', async () => {
      scoringRepo.getTournamentContext.mockResolvedValue({ id: 1, organizer_id: 10, status: 'LIVE' });
      scoringRepo.saveScoringConfig.mockResolvedValue();
      scoringRepo.findScoringConfig.mockResolvedValue({
        tournament_id: 1,
        scoring_mode: 'KILLS_AND_POSITION',
        kill_points_per_kill: 2,
      });
      scoringRepo.listPositionPoints.mockResolvedValue([
        { position: 1, points: 15 },
        { position: 2, points: 10 },
      ]);

      const result = await updateTournamentScoringConfig(
        1,
        {
          scoringMode: 'KILLS_AND_POSITION',
          killPointsPerKill: 2,
          positionPoints: [
            { position: 1, points: 15 },
            { position: 2, points: 10 },
          ],
        },
        10
      );

      expect(scoringRepo.saveScoringConfig).toHaveBeenCalledWith(1, {
        scoringMode: 'KILLS_AND_POSITION',
        killPointsPerKill: 2,
        positionPoints: [
          { position: 1, points: 15 },
          { position: 2, points: 10 },
        ],
      });
      expect(result.killPointsPerKill).toBe(2);
    });
  });

  describe('calculateMatchTeamScore', () => {
    it('calculates score correctly in KILLS_AND_POSITION mode', () => {
      const config = {
        scoringMode: 'KILLS_AND_POSITION',
        killPointsPerKill: 1,
        positionPoints: [
          { position: 1, points: 12 },
          { position: 2, points: 9 },
        ],
      };

      const result = calculateMatchTeamScore(config, { kills: 10, placement: 1 });
      expect(result).toEqual({
        kills: 10,
        placement: 1,
        killPoints: 10,
        positionPoints: 12,
        totalPoints: 22,
      });
    });

    it('multiplies kills by killPointsPerKill', () => {
      const config = {
        scoringMode: 'KILLS_AND_POSITION',
        killPointsPerKill: 2,
        positionPoints: [
          { position: 1, points: 12 },
          { position: 2, points: 9 },
        ],
      };

      const result = calculateMatchTeamScore(config, { kills: 8, placement: 2 });
      expect(result).toEqual({
        kills: 8,
        placement: 2,
        killPoints: 16,
        positionPoints: 9,
        totalPoints: 25,
      });
    });

    it('rejects unconfigured position in KILLS_AND_POSITION mode', () => {
      const config = {
        scoringMode: 'KILLS_AND_POSITION',
        killPointsPerKill: 1,
        positionPoints: [
          { position: 1, points: 12 },
          { position: 2, points: 9 },
        ],
      };

      expect(() => calculateMatchTeamScore(config, { kills: 5, placement: 13 })).toThrow();
    });

    it('calculates score in TOTAL_SCORE mode', () => {
      const config = {
        scoringMode: 'TOTAL_SCORE',
        killPointsPerKill: 1,
        positionPoints: [],
      };

      const result = calculateMatchTeamScore(config, { points: 125 });
      expect(result).toEqual({
        kills: 0,
        placement: null,
        killPoints: 0,
        positionPoints: 0,
        totalPoints: 125,
      });
    });

    it('rejects negative score in TOTAL_SCORE mode', () => {
      const config = {
        scoringMode: 'TOTAL_SCORE',
        killPointsPerKill: 1,
        positionPoints: [],
      };

      expect(() => calculateMatchTeamScore(config, { points: -5 })).toThrow();
    });
  });
});
