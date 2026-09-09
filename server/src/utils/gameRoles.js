export const GAME_DEFINITIONS = {
  'Free Fire': {
    name: 'Free Fire',
    genre: 'Battle Royale',
    roles: ['IGL', 'Assaulter', 'Sniper', 'Rusher', 'Support', 'Flex'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Grandmaster'],
    uidPattern: /^\d{8,12}$/,
    uidPlaceholder: '8-12 digit UID',
  },
  'BGMI': {
    name: 'BGMI',
    genre: 'Battle Royale',
    roles: ['IGL', 'Assaulter', 'Filter/Support', 'Sniper', 'Entry Fragger', 'Scout'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown', 'Ace', 'Ace Master', 'Ace Dominator', 'Conqueror'],
    uidPattern: /^\d{8,12}$/,
    uidPlaceholder: '8-12 digit character ID',
  },
  'PUBG Mobile': {
    name: 'PUBG Mobile',
    genre: 'Battle Royale',
    roles: ['IGL', 'Assaulter', 'Filter/Support', 'Sniper', 'Entry Fragger', 'Scout'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown', 'Ace', 'Ace Master', 'Ace Dominator', 'Conqueror'],
    uidPattern: /^\d{8,12}$/,
    uidPlaceholder: '8-12 digit character ID',
  },
  'Valorant': {
    name: 'Valorant',
    genre: 'Tactical Shooter',
    roles: ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'IGL', 'Flex'],
    ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'],
    uidPattern: /^.{3,24}#[a-zA-Z0-9]{3,6}$/,
    uidPlaceholder: 'Riot ID (e.g. Player#TAG)',
  },
  'Call of Duty: Mobile': {
    name: 'Call of Duty: Mobile',
    genre: 'Shooter',
    roles: ['Slayer', 'Anchor', 'Objective', 'Support', 'Sniper', 'Flex'],
    ranks: ['Rookie', 'Veteran', 'Elite', 'Pro', 'Master', 'Grandmaster', 'Legendary'],
    uidPattern: /^.{6,24}$/,
    uidPlaceholder: 'Player UID',
  },
  'Call of Duty: Warzone': {
    name: 'Call of Duty: Warzone',
    genre: 'Battle Royale',
    roles: ['IGL', 'Fragger', 'Support', 'Sniper', 'Scout', 'Flex'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crimson', 'Iridescent', 'Top 250'],
    uidPattern: /^.{3,30}#[0-9]{4,10}$/,
    uidPlaceholder: 'Activision ID (e.g. Player#1234567)',
  },
  'Apex Legends': {
    name: 'Apex Legends',
    genre: 'Battle Royale',
    roles: ['IGL', 'Fragger', 'Anchor', 'Support', 'Recon'],
    ranks: ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Apex Predator'],
    uidPattern: /^.{3,32}$/,
    uidPlaceholder: 'EA Account / Gamertag',
  },
  'CS:GO / CS2': {
    name: 'CS:GO / CS2',
    genre: 'Tactical Shooter',
    roles: ['Entry Fragger', 'AWPer', 'Rifler', 'Support', 'IGL', 'Lurker'],
    ranks: ['Silver', 'Gold Nova', 'Master Guardian', 'Distinguished Master Guardian', 'Legendary Eagle', 'Supreme', 'Global Elite'],
    uidPattern: /^.{3,32}$/,
    uidPlaceholder: 'Steam ID or Vanity URL',
  },
  'Dota 2': {
    name: 'Dota 2',
    genre: 'MOBA',
    roles: ['Carry (Pos 1)', 'Mid (Pos 2)', 'Offlane (Pos 3)', 'Soft Support (Pos 4)', 'Hard Support (Pos 5)', 'Captain'],
    ranks: ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'],
    uidPattern: /^\d{6,12}$/,
    uidPlaceholder: 'Dota 2 Friend ID',
  },
  'League of Legends': {
    name: 'League of Legends',
    genre: 'MOBA',
    roles: ['Top', 'Jungle', 'Mid', 'ADC / Bot', 'Support', 'Shotcaller'],
    ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'],
    uidPattern: /^.{3,24}#[a-zA-Z0-9]{3,6}$/,
    uidPlaceholder: 'Riot ID (e.g. Summoner#TAG)',
  },
};

export const DEFAULT_FALLBACK_ROLES = [
  'IGL / Captain',
  'Assaulter / Fragger',
  'Support',
  'Sniper / Long Range',
  'Flex / All Rounder',
];

export function getRolesForGame(gameName) {
  if (gameName && GAME_DEFINITIONS[gameName]) {
    return GAME_DEFINITIONS[gameName].roles;
  }
  return DEFAULT_FALLBACK_ROLES;
}

export function getRanksForGame(gameName) {
  if (gameName && GAME_DEFINITIONS[gameName]) {
    return GAME_DEFINITIONS[gameName].ranks;
  }
  return [];
}

export function isValidRoleForGame(gameName, role) {
  if (!role || typeof role !== 'string') return false;
  const allowed = getRolesForGame(gameName);
  return allowed.includes(role.trim());
}
