import { errorResponses } from '../errors/AppError.js';
import {
  getProfileByUserId,
  getProfileByEvoqId,
  updateProfileDetails,
  listGameProfiles,
  findGameProfileById,
  findGameProfileByGame,
  createGameProfile,
  updateGameProfile,
  deleteGameProfile,
  listPracticeSessions,
  findPracticeSessionById,
  createPracticeSession,
  updatePracticeSession,
  deletePracticeSession,
  listPracticeMatches,
  createPracticeMatch,
  updatePracticeMatch,
  deletePracticeMatch,
  getOfficialTournamentHistory,
  getOfficialMatchResults,
  searchPublicPlayers,
} from '../repositories/playerProfileRepository.js';
import { listTeams } from '../repositories/playerDashboardRepository.js';
import { getRolesForGame, isValidRoleForGame } from '../utils/gameRoles.js';

/**
 * Calculates human readable experience from started_playing_at date
 */
export function calculateExperience(startedPlayingAt) {
  if (!startedPlayingAt) return { text: 'Not specified', totalMonths: 0, startedPlayingAt: null };

  const start = new Date(startedPlayingAt);
  if (isNaN(start.getTime())) return { text: 'Not specified', totalMonths: 0, startedPlayingAt: null };

  const now = new Date();
  if (start > now) return { text: 'Just started', totalMonths: 0, startedPlayingAt: start.toISOString().split('T')[0] };

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();

  if (now.getDate() < start.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  let text = '';
  if (years > 0 && months > 0) {
    text = `${years} yr${years > 1 ? 's' : ''} ${months} mo${months > 1 ? 's' : ''}`;
  } else if (years > 0) {
    text = `${years} yr${years > 1 ? 's' : ''}`;
  } else if (months > 0) {
    text = `${months} mo${months > 1 ? 's' : ''}`;
  } else {
    text = 'Less than a month';
  }

  return {
    text,
    years,
    months,
    totalMonths,
    startedPlayingAt: start.toISOString().split('T')[0],
  };
}

/**
 * Calculates profile completion percentage and checklist
 */
export function calculateProfileCompletion({ profile, gameProfiles = [], teams = [], tournamentCount = 0, practiceCount = 0 }) {
  const checklist = [
    {
      key: 'basic_info',
      label: 'Display Name & Bio',
      category: 'Required',
      weight: 20,
      completed: Boolean(profile?.name && (profile?.bio || profile?.country)),
    },
    {
      key: 'game_profile',
      label: 'Game Profile (IGN & UID)',
      category: 'Required',
      weight: 25,
      completed: gameProfiles.some((g) => g.in_game_name && g.game_uid),
    },
    {
      key: 'esports_role',
      label: 'Esports Role Defined',
      category: 'Required',
      weight: 15,
      completed: gameProfiles.some((g) => g.primary_role),
    },
    {
      key: 'experience',
      label: 'Gaming Experience / Start Date',
      category: 'Recommended',
      weight: 10,
      completed: gameProfiles.some((g) => g.started_playing_at),
    },
    {
      key: 'team_roster',
      label: 'Join or Create an Esports Team',
      category: 'Recommended',
      weight: 15,
      completed: teams.length > 0,
    },
    {
      key: 'match_activity',
      label: 'Competition or Practice Match Recorded',
      category: 'Optional',
      weight: 15,
      completed: tournamentCount > 0 || practiceCount > 0,
    },
  ];

  const earned = checklist.filter((item) => item.completed).reduce((sum, item) => sum + item.weight, 0);
  const percentage = Math.min(Math.max(earned, 0), 100);

  return {
    percentage,
    checklist,
    isComplete: percentage >= 80,
  };
}

/**
 * Calculates deterministic performance metrics and EVOQ Performance Rating
 */
export function calculatePerformanceStats(officialMatches = [], practiceMatches = [], officialTournaments = []) {
  // Official stats calculation
  const officialCount = officialMatches.length;
  let officialKills = 0;
  let officialPoints = 0;
  let officialTop3 = 0;
  let officialWins = 0;
  let officialPlacementsSum = 0;
  let officialPlacementCount = 0;

  for (const m of officialMatches) {
    officialKills += Number(m.kills || 0);
    officialPoints += Number(m.points || 0);
    if (m.placement != null) {
      officialPlacementsSum += Number(m.placement);
      officialPlacementCount += 1;
      if (m.placement === 1) officialWins += 1;
      if (m.placement <= 3) officialTop3 += 1;
    }
  }

  const officialAvgKills = officialCount > 0 ? Number((officialKills / officialCount).toFixed(2)) : 0;
  const officialAvgPlacement = officialPlacementCount > 0 ? Number((officialPlacementsSum / officialPlacementCount).toFixed(1)) : null;

  // Practice stats calculation
  const practiceCount = practiceMatches.length;
  let practiceKills = 0;
  let practiceDamage = 0;
  let practiceAssists = 0;
  let practiceTop3 = 0;
  let practiceTop5 = 0;
  let practiceTop10 = 0;
  let practiceWins = 0;
  let practicePlacementsSum = 0;
  let practicePlacementCount = 0;
  let bestPracticePlacement = null;

  for (const m of practiceMatches) {
    const k = Number(m.kills || 0);
    const d = Number(m.damage || 0);
    const a = Number(m.assists || 0);
    practiceKills += k;
    practiceDamage += d;
    practiceAssists += a;

    if (m.placement != null) {
      const p = Number(m.placement);
      practicePlacementsSum += p;
      practicePlacementCount += 1;
      if (bestPracticePlacement === null || p < bestPracticePlacement) {
        bestPracticePlacement = p;
      }
      if (p === 1) practiceWins += 1;
      if (p <= 3) practiceTop3 += 1;
      if (p <= 5) practiceTop5 += 1;
      if (p <= 10) practiceTop10 += 1;
    }
  }

  const practiceAvgKills = practiceCount > 0 ? Number((practiceKills / practiceCount).toFixed(2)) : 0;
  const practiceAvgDamage = practiceCount > 0 ? Number((practiceDamage / practiceCount).toFixed(1)) : 0;
  const practiceAvgAssists = practiceCount > 0 ? Number((practiceAssists / practiceCount).toFixed(2)) : 0;
  const practiceAvgPlacement = practicePlacementCount > 0 ? Number((practicePlacementsSum / practicePlacementCount).toFixed(1)) : null;

  // Combined metrics for performance rating
  const totalMatches = officialCount + practiceCount;
  const totalKills = officialKills + practiceKills;
  const combinedAvgKills = totalMatches > 0 ? Number((totalKills / totalMatches).toFixed(2)) : 0;

  // Deterministic EVOQ Performance Rating (0 - 100)
  // Requires minimum sample of at least 3 matches
  let rating = null;
  let ratingBreakdown = null;

  if (totalMatches >= 3) {
    // 1. Combat score (0 - 40 points) based on avg kills & damage
    // baseline: 4 kills/match = 20 pts, 600 damage/match = 20 pts
    const killScore = Math.min(20, (combinedAvgKills / 4) * 20);
    const effectiveDamage = practiceCount > 0 ? practiceAvgDamage : officialAvgKills * 150;
    const damageScore = Math.min(20, (effectiveDamage / 600) * 20);
    const combatScore = Number((killScore + damageScore).toFixed(1));

    // 2. Placement score (0 - 40 points)
    const effectiveAvgPlacement = officialAvgPlacement || practiceAvgPlacement || 10;
    const placementFactor = Math.max(0, (20 - effectiveAvgPlacement) / 19); // 1st -> 1.0, 20th -> 0.0
    const top3Ratio = (officialTop3 + practiceTop3) / totalMatches;
    const placementScore = Number((placementFactor * 25 + Math.min(15, top3Ratio * 15)).toFixed(1));

    // 3. Consistency & Experience volume score (0 - 20 points)
    const volumeScore = Number(Math.min(20, totalMatches >= 15 ? 20 : totalMatches * 1.33).toFixed(1));

    const totalScore = Math.min(100, Math.max(0, Math.round(combatScore + placementScore + volumeScore)));

    let tier = 'Unranked';
    if (totalScore >= 90) tier = 'Elite Tier';
    else if (totalScore >= 75) tier = 'Master Tier';
    else if (totalScore >= 60) tier = 'Diamond Tier';
    else if (totalScore >= 45) tier = 'Gold Tier';
    else tier = 'Challenger Tier';

    rating = {
      score: totalScore,
      tier,
      sampleSize: totalMatches,
      breakdown: {
        combat: combatScore,
        placement: placementScore,
        volume: volumeScore,
      },
      formulaExplanation: 'Deterministic composite based on Combat efficiency (40%), Placement reliability (40%), and Activity volume (20%).',
    };
  } else {
    rating = {
      score: null,
      tier: 'Insufficient Data',
      sampleSize: totalMatches,
      minimumRequired: 3,
      message: 'At least 3 matches (Official or Practice) required to compute EVOQ Performance Rating.',
    };
  }

  // Recent 7 days vs previous period trend (if enough data)
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;
  const fourteenDaysAgo = now - 14 * 86400000;

  const recent7dMatches = [...practiceMatches, ...officialMatches].filter((m) => {
    const t = new Date(m.playedAt || m.played_at || m.created_at).getTime();
    return t >= sevenDaysAgo;
  });

  const prev7dMatches = [...practiceMatches, ...officialMatches].filter((m) => {
    const t = new Date(m.playedAt || m.played_at || m.created_at).getTime();
    return t >= fourteenDaysAgo && t < sevenDaysAgo;
  });

  const recent7dKills = recent7dMatches.reduce((s, m) => s + Number(m.kills || 0), 0);
  const prev7dKills = prev7dMatches.reduce((s, m) => s + Number(m.kills || 0), 0);
  const recent7dAvg = recent7dMatches.length > 0 ? Number((recent7dKills / recent7dMatches.length).toFixed(2)) : 0;
  const prev7dAvg = prev7dMatches.length > 0 ? Number((prev7dKills / prev7dMatches.length).toFixed(2)) : 0;

  let trend = 'Stable';
  if (recent7dMatches.length >= 2 && prev7dMatches.length >= 2) {
    if (recent7dAvg > prev7dAvg * 1.1) trend = 'Improving';
    else if (recent7dAvg < prev7dAvg * 0.9) trend = 'Declining';
  }

  return {
    official: {
      tournamentsPlayed: officialTournaments.length,
      matchesPlayed: officialCount,
      totalKills: officialKills,
      avgKills: officialAvgKills,
      totalPoints: officialPoints,
      avgPlacement: officialAvgPlacement,
      wins: officialWins,
      top3Finishes: officialTop3,
      verified: true,
    },
    practice: {
      matchesPlayed: practiceCount,
      totalKills: practiceKills,
      avgKills: practiceAvgKills,
      totalDamage: practiceDamage,
      avgDamage: practiceAvgDamage,
      avgAssists: practiceAvgAssists,
      avgPlacement: practiceAvgPlacement,
      bestPlacement: bestPracticePlacement,
      wins: practiceWins,
      top3Finishes: practiceTop3,
      top5Finishes: practiceTop5,
      top10Finishes: practiceTop10,
      playerReported: true,
    },
    combined: {
      totalMatches,
      totalKills,
      avgKills: combinedAvgKills,
    },
    rating,
    recentForm: {
      matches7d: recent7dMatches.length,
      avgKills7d: recent7dAvg,
      trend,
    },
  };
}

/**
 * Calculates player achievements based on verified real data
 */
export function calculateAchievements(officialTournaments = [], officialMatches = [], practiceMatches = [], gameProfiles = []) {
  const list = [];

  // 1. First EVOQ Tournament
  if (officialTournaments.length >= 1) {
    list.push({
      id: 'first_tournament',
      title: 'First EVOQ Tournament',
      description: 'Competed in your first official EVOQ esports tournament.',
      category: 'Tournament',
      unlockedAt: officialTournaments[officialTournaments.length - 1].tournamentDate || officialTournaments[0].tournamentDate,
      verified: true,
    });
  }

  // 2. Tournament Champion
  const hasWonTournament = officialTournaments.some((t) => t.finalRank === 1);
  if (hasWonTournament) {
    list.push({
      id: 'tournament_champion',
      title: 'Tournament Champion',
      description: 'Finished 1st place in an official EVOQ tournament.',
      category: 'Championship',
      unlockedAt: officialTournaments.find((t) => t.finalRank === 1)?.completedAt || new Date(),
      verified: true,
    });
  }

  // 3. Top 3 Finisher
  const hasPodium = officialTournaments.some((t) => t.finalRank != null && t.finalRank <= 3);
  if (hasPodium) {
    list.push({
      id: 'podium_finisher',
      title: 'Podium Finisher',
      description: 'Secured a top 3 finish in an official EVOQ tournament.',
      category: 'Tournament',
      unlockedAt: officialTournaments.find((t) => t.finalRank <= 3)?.completedAt || new Date(),
      verified: true,
    });
  }

  // 4. Official Matches Milestones
  if (officialMatches.length >= 10) {
    list.push({
      id: 'matches_10',
      title: 'Contender',
      description: 'Completed 10 or more official tournament matches.',
      category: 'Milestone',
      verified: true,
    });
  }

  if (officialMatches.length >= 50) {
    list.push({
      id: 'matches_50',
      title: 'Esports Veteran',
      description: 'Completed 50 or more official tournament matches.',
      category: 'Milestone',
      verified: true,
    });
  }

  if (officialMatches.length >= 100) {
    list.push({
      id: 'matches_100',
      title: 'Century Master',
      description: 'Completed 100 or more official tournament matches.',
      category: 'Milestone',
      verified: true,
    });
  }

  // 5. Scrim Practice Milestones
  if (practiceMatches.length >= 10) {
    list.push({
      id: 'practice_10',
      title: 'Dedicated Trainee',
      description: 'Logged 10 or more practice and scrim matches.',
      category: 'Practice',
      verified: false,
    });
  }

  if (practiceMatches.length >= 50) {
    list.push({
      id: 'practice_50',
      title: 'Scrim Grinder',
      description: 'Logged 50 or more practice and scrim matches.',
      category: 'Practice',
      verified: false,
    });
  }

  // 6. Multi-game profile
  if (gameProfiles.length >= 2) {
    list.push({
      id: 'multigame_athlete',
      title: 'Multi-Title Athlete',
      description: 'Active competitor across multiple esports titles.',
      category: 'Versatility',
      verified: true,
    });
  }

  return list;
}

// ---------------- Primary Service Facades ---------------- //

export async function getPlayerEsportsProfile(userId) {
  const profile = await getProfileByUserId(userId);
  if (!profile) {
    throw errorResponses.notFound('Player profile not found');
  }

  const [gameProfiles, teams, tournaments, officialMatchesResult, practiceMatchesResult] = await Promise.all([
    listGameProfiles(userId),
    listTeams(userId),
    getOfficialTournamentHistory(userId),
    getOfficialMatchResults(userId, { limit: 100 }),
    listPracticeMatches(userId, { limit: 100 }),
  ]);

  const officialMatches = officialMatchesResult.matches || [];
  const practiceMatches = practiceMatchesResult.matches || [];

  const completion = calculateProfileCompletion({
    profile,
    gameProfiles,
    teams,
    tournamentCount: tournaments.length,
    practiceCount: practiceMatches.length,
  });

  const performance = calculatePerformanceStats(officialMatches, practiceMatches, tournaments);
  const achievements = calculateAchievements(tournaments, officialMatches, practiceMatches, gameProfiles);

  const primaryGame = gameProfiles.find((g) => g.is_primary) || gameProfiles[0] || null;
  const experience = primaryGame ? calculateExperience(primaryGame.started_playing_at) : { text: 'Not specified', totalMonths: 0 };

  return {
    identity: {
      userId: profile.user_id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      uniquePlayerId: profile.unique_player_id,
      mobile: profile.mobile,
      inGameName: profile.in_game_name,
      gameUid: profile.game_uid,
      country: profile.country,
      city: profile.city,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      accountCreatedAt: profile.account_created_at,
    },
    privacy: {
      isPublic: Boolean(profile.is_public),
      showGameUid: Boolean(profile.show_game_uid),
      showTeam: Boolean(profile.show_team),
      showPerformance: Boolean(profile.show_performance),
      showTournaments: Boolean(profile.show_tournaments),
      showPractice: Boolean(profile.show_practice),
      showAchievements: Boolean(profile.show_achievements),
    },
    primaryGame: primaryGame
      ? {
          id: primaryGame.id,
          gameName: primaryGame.game_name,
          inGameName: primaryGame.in_game_name,
          gameUid: primaryGame.game_uid,
          primaryRole: primaryGame.primary_role,
          secondaryRole: primaryGame.secondary_role,
          startedPlayingAt: primaryGame.started_playing_at,
          currentRank: primaryGame.current_rank,
          highestRank: primaryGame.highest_rank,
          region: primaryGame.region,
          experience,
        }
      : null,
    gameProfiles: gameProfiles.map((g) => ({
      id: g.id,
      gameName: g.game_name,
      inGameName: g.in_game_name,
      gameUid: g.game_uid,
      primaryRole: g.primary_role,
      secondaryRole: g.secondary_role,
      startedPlayingAt: g.started_playing_at,
      currentRank: g.current_rank,
      highestRank: g.highest_rank,
      region: g.region,
      isPrimary: Boolean(g.is_primary),
      isPublic: Boolean(g.is_public),
      experience: calculateExperience(g.started_playing_at),
    })),
    completion,
    performance,
    achievements,
    currentTeam: teams[0]
      ? {
          id: teams[0].id,
          name: teams[0].name,
          memberCount: teams[0].member_count,
          ownerName: teams[0].owner_name,
        }
      : null,
  };
}

export async function updatePlayerEsportsProfile(userId, updates) {
  await updateProfileDetails(userId, updates);
  return getPlayerEsportsProfile(userId);
}

// ---------------- Game Profile Services ---------------- //

export async function addGameProfileForPlayer(userId, data) {
  if (!isValidRoleForGame(data.gameName, data.primaryRole)) {
    throw errorResponses.validation({
      primaryRole: `Role "${data.primaryRole}" is not valid for ${data.gameName}. Valid roles: ${getRolesForGame(data.gameName).join(', ')}`,
    });
  }

  const existing = await findGameProfileByGame(userId, data.gameName);
  if (existing) {
    throw errorResponses.conflict(`A game profile for "${data.gameName}" already exists. Please update the existing profile.`);
  }

  const profileId = await createGameProfile(userId, data);
  return findGameProfileById(userId, profileId);
}

export async function editGameProfileForPlayer(userId, gameProfileId, data) {
  const existing = await findGameProfileById(userId, gameProfileId);
  if (!existing) {
    throw errorResponses.notFound('Game profile not found');
  }

  const targetGame = data.gameName || existing.game_name;
  if (data.primaryRole && !isValidRoleForGame(targetGame, data.primaryRole)) {
    throw errorResponses.validation({
      primaryRole: `Role "${data.primaryRole}" is not valid for ${targetGame}. Valid roles: ${getRolesForGame(targetGame).join(', ')}`,
    });
  }

  await updateGameProfile(userId, gameProfileId, data);
  return findGameProfileById(userId, gameProfileId);
}

export async function removeGameProfileForPlayer(userId, gameProfileId) {
  const deleted = await deleteGameProfile(userId, gameProfileId);
  if (!deleted) {
    throw errorResponses.notFound('Game profile not found');
  }
  return { success: true };
}

// ---------------- Public Profile & Discovery ---------------- //

export async function getPublicEsportsProfile(evoqId) {
  const cleanId = String(evoqId || '').trim();
  const profile = await getProfileByEvoqId(cleanId);
  if (!profile || !profile.is_public) {
    throw errorResponses.notFound('Player profile not found or is set to private');
  }

  const userId = profile.user_id;
  const [gameProfiles, teams, tournaments, officialMatchesResult, practiceMatchesResult] = await Promise.all([
    listGameProfiles(userId),
    listTeams(userId),
    getOfficialTournamentHistory(userId),
    getOfficialMatchResults(userId, { limit: 50 }),
    listPracticeMatches(userId, { limit: 50 }),
  ]);

  const publicGameProfiles = gameProfiles.filter((g) => g.is_public);
  const primaryGame = publicGameProfiles.find((g) => g.is_primary) || publicGameProfiles[0] || null;

  const performance = profile.show_performance
    ? calculatePerformanceStats(officialMatchesResult.matches, profile.show_practice ? practiceMatchesResult.matches : [], tournaments)
    : null;

  const achievements = profile.show_achievements
    ? calculateAchievements(tournaments, officialMatchesResult.matches, practiceMatchesResult.matches, publicGameProfiles)
    : [];

  return {
    identity: {
      name: profile.name,
      uniquePlayerId: profile.unique_player_id,
      inGameName: profile.in_game_name,
      gameUid: profile.show_game_uid ? profile.game_uid : null,
      country: profile.country,
      city: profile.city,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      memberSince: profile.account_created_at,
    },
    primaryGame: primaryGame
      ? {
          gameName: primaryGame.game_name,
          inGameName: primaryGame.in_game_name,
          gameUid: profile.show_game_uid ? primaryGame.game_uid : null,
          primaryRole: primaryGame.primary_role,
          secondaryRole: primaryGame.secondary_role,
          currentRank: primaryGame.current_rank,
          highestRank: primaryGame.highest_rank,
          region: primaryGame.region,
          experience: calculateExperience(primaryGame.started_playing_at),
        }
      : null,
    gameProfiles: publicGameProfiles.map((g) => ({
      gameName: g.game_name,
      inGameName: g.in_game_name,
      gameUid: profile.show_game_uid ? g.game_uid : null,
      primaryRole: g.primary_role,
      secondaryRole: g.secondary_role,
      currentRank: g.current_rank,
      highestRank: g.highest_rank,
      region: g.region,
      isPrimary: Boolean(g.is_primary),
      experience: calculateExperience(g.started_playing_at),
    })),
    currentTeam: profile.show_team && teams[0]
      ? {
          name: teams[0].name,
          memberCount: teams[0].member_count,
        }
      : null,
    tournamentHistory: profile.show_tournaments
      ? tournaments.map((t) => ({
          tournamentName: t.tournamentName,
          game: t.game,
          status: t.status,
          teamName: t.teamName,
          finalRank: t.finalRank,
          matchesPlayed: t.matchesPlayed,
          totalKills: t.totalKills,
          totalPoints: t.totalPoints,
          completedAt: t.completedAt,
        }))
      : [],
    performance,
    achievements,
  };
}

export async function searchPlayersByEvoqId(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw errorResponses.validation({ query: 'Search query is required' });
  }

  const results = await searchPublicPlayers(query.trim(), 10);
  return results.map((r) => ({
    name: r.name,
    uniquePlayerId: r.unique_player_id,
    inGameName: r.in_game_name,
    avatarUrl: r.avatar_url,
    country: r.country,
    city: r.city,
    bio: r.bio,
    primaryGame: r.primary_game,
    primaryRole: r.primary_role,
    experience: calculateExperience(r.started_playing_at),
    currentTeam: r.current_team,
  }));
}
