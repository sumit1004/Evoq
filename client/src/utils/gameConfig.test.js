import { describe, expect, it } from 'vitest';
import { SUPPORTED_GAMES, getRolesForGame, getRanksForGame } from './gameConfig.js';

describe('client gameConfig', () => {
  it('supports standard esports titles', () => {
    expect(SUPPORTED_GAMES).toContain('Free Fire');
    expect(SUPPORTED_GAMES).toContain('BGMI');
    expect(SUPPORTED_GAMES).toContain('Valorant');
    expect(SUPPORTED_GAMES).toContain('Call of Duty: Mobile');
  });

  it('returns game-aware roles', () => {
    const ffRoles = getRolesForGame('Free Fire');
    expect(ffRoles).toContain('IGL');
    expect(ffRoles).toContain('Sniper');

    const valRoles = getRolesForGame('Valorant');
    expect(valRoles).toContain('Duelist');
    expect(valRoles).toContain('Sentinel');
  });

  it('returns game-aware ranks', () => {
    const ffRanks = getRanksForGame('Free Fire');
    expect(ffRanks).toContain('Heroic');
    expect(ffRanks).toContain('Grandmaster');

    const valRanks = getRanksForGame('Valorant');
    expect(valRanks).toContain('Radiant');
  });
});
