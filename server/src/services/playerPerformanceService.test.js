import { describe, expect, it } from 'vitest';
import {
  calculateExperience,
  calculateProfileCompletion,
  calculatePerformanceStats,
  calculateAchievements,
} from './playerPerformanceService.js';
import { isValidRoleForGame, getRolesForGame } from '../utils/gameRoles.js';

describe('Player Performance Service & Logic', () => {
  describe('Game-Aware Roles', () => {
    it('returns proper roles for Free Fire', () => {
      const roles = getRolesForGame('Free Fire');
      expect(roles).toContain('IGL');
      expect(roles).toContain('Assaulter');
      expect(roles).toContain('Sniper');
      expect(isValidRoleForGame('Free Fire', 'IGL')).toBe(true);
      expect(isValidRoleForGame('Free Fire', 'Duelist')).toBe(false);
    });

    it('returns proper roles for Valorant', () => {
      const roles = getRolesForGame('Valorant');
      expect(roles).toContain('Duelist');
      expect(roles).toContain('Controller');
      expect(isValidRoleForGame('Valorant', 'Duelist')).toBe(true);
      expect(isValidRoleForGame('Valorant', 'Rusher')).toBe(false);
    });
  });

  describe('Experience Calculation', () => {
    it('handles empty or invalid dates gracefully', () => {
      expect(calculateExperience(null).text).toBe('Not specified');
      expect(calculateExperience('invalid-date').text).toBe('Not specified');
    });

    it('calculates deterministic experience for past dates', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 2);
      pastDate.setMonth(pastDate.getMonth() - 4);
      const dateStr = pastDate.toISOString().split('T')[0];

      const res = calculateExperience(dateStr);
      expect(res.years).toBe(2);
      expect(res.months).toBe(4);
      expect(res.text).toBe('2 yrs 4 mos');
      expect(res.totalMonths).toBe(28);
    });
  });

  describe('Profile Completion Calculation', () => {
    it('calculates real percentage based on stored data', () => {
      // Incomplete profile
      const incomplete = calculateProfileCompletion({
        profile: { name: 'Player 1' },
        gameProfiles: [],
        teams: [],
        tournamentCount: 0,
        practiceCount: 0,
      });
      expect(incomplete.percentage).toBe(0);
      expect(incomplete.isComplete).toBe(false);

      // Fully complete profile
      const complete = calculateProfileCompletion({
        profile: { name: 'Player 1', bio: 'Pro player', country: 'India' },
        gameProfiles: [{ in_game_name: 'Alpha', game_uid: '12345678', primary_role: 'IGL', started_playing_at: '2022-01-01' }],
        teams: [{ id: 1, name: 'Team Alpha' }],
        tournamentCount: 2,
        practiceCount: 5,
      });
      expect(complete.percentage).toBe(100);
      expect(complete.isComplete).toBe(true);
    });
  });

  describe('Performance Statistics & EVOQ Performance Rating', () => {
    it('handles zero matches gracefully without false rating', () => {
      const stats = calculatePerformanceStats([], [], []);
      expect(stats.official.matchesPlayed).toBe(0);
      expect(stats.practice.matchesPlayed).toBe(0);
      expect(stats.combined.totalMatches).toBe(0);
      expect(stats.rating.score).toBeNull();
      expect(stats.rating.tier).toBe('Insufficient Data');
    });

    it('calculates deterministic rating when minimum matches are met', () => {
      const practiceMatches = [
        { placement: 1, kills: 6, damage: 950, assists: 2, playedAt: new Date() },
        { placement: 2, kills: 4, damage: 700, assists: 1, playedAt: new Date() },
        { placement: 3, kills: 5, damage: 800, assists: 3, playedAt: new Date() },
      ];
      const officialMatches = [
        { placement: 1, kills: 5, points: 15, playedAt: new Date() },
      ];

      const stats = calculatePerformanceStats(officialMatches, practiceMatches, [{ finalRank: 1 }]);
      expect(stats.combined.totalMatches).toBe(4);
      expect(stats.official.matchesPlayed).toBe(1);
      expect(stats.practice.matchesPlayed).toBe(3);
      expect(stats.practice.wins).toBe(1);
      expect(stats.practice.top3Finishes).toBe(3);
      expect(stats.rating.score).toBeGreaterThan(50);
      expect(stats.rating.breakdown.combat).toBeDefined();
      expect(stats.rating.breakdown.placement).toBeDefined();
      expect(stats.rating.breakdown.volume).toBeDefined();
    });
  });

  describe('Achievements Calculation', () => {
    it('awards achievements based strictly on real data', () => {
      const achievements = calculateAchievements(
        [{ tournamentDate: '2026-01-01', finalRank: 1, completedAt: '2026-01-02' }],
        Array(12).fill({ placement: 2, kills: 3 }),
        Array(15).fill({ placement: 1, kills: 4 }),
        [{ game_name: 'Free Fire' }, { game_name: 'BGMI' }],
      );

      const ids = achievements.map((a) => a.id);
      expect(ids).toContain('first_tournament');
      expect(ids).toContain('tournament_champion');
      expect(ids).toContain('podium_finisher');
      expect(ids).toContain('matches_10');
      expect(ids).toContain('practice_10');
      expect(ids).toContain('multigame_athlete');
    });
  });
});
