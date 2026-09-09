export const GAME_DEFINITIONS = {
  'Free Fire': {
    name: 'Free Fire',
    genre: 'Battle Royale',
    roles: ['IGL', 'Assaulter', 'Sniper', 'Rusher', 'Support', 'Flex'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Grandmaster'],
    uidPlaceholder: 'e.g. 123456789',
    badgeColor: '#e74c3c',
  },
  'BGMI': {
    name: 'BGMI',
    genre: 'Battle Royale',
    roles: ['IGL', 'Assaulter', 'Filter/Support', 'Sniper', 'Entry Fragger', 'Scout'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown', 'Ace', 'Ace Master', 'Ace Dominator', 'Conqueror'],
    uidPlaceholder: 'e.g. 5123456789',
    badgeColor: '#f39c12',
  },
  'PUBG Mobile': {
    name: 'PUBG Mobile',
    genre: 'Battle Royale',
    roles: ['IGL', 'Assaulter', 'Filter/Support', 'Sniper', 'Entry Fragger', 'Scout'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown', 'Ace', 'Ace Master', 'Ace Dominator', 'Conqueror'],
    uidPlaceholder: 'e.g. 5123456789',
    badgeColor: '#e67e22',
  },
  'Valorant': {
    name: 'Valorant',
    genre: 'Tactical Shooter',
    roles: ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'IGL', 'Flex'],
    ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'],
    uidPlaceholder: 'e.g. Player#TAG',
    badgeColor: '#ff4655',
  },
  'Call of Duty: Mobile': {
    name: 'Call of Duty: Mobile',
    genre: 'Shooter',
    roles: ['Slayer', 'Anchor', 'Objective', 'Support', 'Sniper', 'Flex'],
    ranks: ['Rookie', 'Veteran', 'Elite', 'Pro', 'Master', 'Grandmaster', 'Legendary'],
    uidPlaceholder: 'e.g. 6749123456789',
    badgeColor: '#27ae60',
  },
  'Call of Duty: Warzone': {
    name: 'Call of Duty: Warzone',
    genre: 'Battle Royale',
    roles: ['IGL', 'Fragger', 'Support', 'Sniper', 'Scout', 'Flex'],
    ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crimson', 'Iridescent', 'Top 250'],
    uidPlaceholder: 'e.g. Player#1234567',
    badgeColor: '#2ecc71',
  },
  'Apex Legends': {
    name: 'Apex Legends',
    genre: 'Battle Royale',
    roles: ['IGL', 'Fragger', 'Anchor', 'Support', 'Recon'],
    ranks: ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Apex Predator'],
    uidPlaceholder: 'e.g. ApexTag',
    badgeColor: '#c0392b',
  },
  'CS:GO / CS2': {
    name: 'CS:GO / CS2',
    genre: 'Tactical Shooter',
    roles: ['Entry Fragger', 'AWPer', 'Rifler', 'Support', 'IGL', 'Lurker'],
    ranks: ['Silver', 'Gold Nova', 'Master Guardian', 'Distinguished Master Guardian', 'Legendary Eagle', 'Supreme', 'Global Elite'],
    uidPlaceholder: 'e.g. SteamID64 or Custom URL',
    badgeColor: '#2980b9',
  },
  'Dota 2': {
    name: 'Dota 2',
    genre: 'MOBA',
    roles: ['Carry (Pos 1)', 'Mid (Pos 2)', 'Offlane (Pos 3)', 'Soft Support (Pos 4)', 'Hard Support (Pos 5)', 'Captain'],
    ranks: ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'],
    uidPlaceholder: 'e.g. 12345678',
    badgeColor: '#8e44ad',
  },
  'League of Legends': {
    name: 'League of Legends',
    genre: 'MOBA',
    roles: ['Top', 'Jungle', 'Mid', 'ADC / Bot', 'Support', 'Shotcaller'],
    ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'],
    uidPlaceholder: 'e.g. Summoner#TAG',
    badgeColor: '#16a085',
  },
};

export const SUPPORTED_GAMES = Object.keys(GAME_DEFINITIONS);

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
