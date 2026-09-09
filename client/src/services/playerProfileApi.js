import { apiClient } from './apiClient.js';

// --- Esports Profile ---
export async function fetchMyEsportsProfile() {
  const { data } = await apiClient.get('/players/profile');
  return data.profile;
}

export async function updateMyEsportsProfile(updates) {
  const { data } = await apiClient.put('/players/profile', updates);
  return data.profile;
}

// --- Game Profiles ---
export async function fetchMyGameProfiles() {
  const { data } = await apiClient.get('/players/games');
  return data.games;
}

export async function createGameProfile(gameData) {
  const { data } = await apiClient.post('/players/games', gameData);
  return data.game;
}

export async function updateGameProfile(gameId, updates) {
  const { data } = await apiClient.put(`/players/games/${gameId}`, updates);
  return data.game;
}

export async function deleteGameProfile(gameId) {
  const { data } = await apiClient.delete(`/players/games/${gameId}`);
  return data;
}

// --- Practice Sessions ---
export async function fetchPracticeSessions(params = {}) {
  const { data } = await apiClient.get('/players/practice/sessions', { params });
  return data;
}

export async function fetchPracticeSession(sessionId) {
  const { data } = await apiClient.get(`/players/practice/sessions/${sessionId}`);
  return data.session;
}

export async function createPracticeSession(sessionData) {
  const { data } = await apiClient.post('/players/practice/sessions', sessionData);
  return data.session;
}

export async function updatePracticeSession(sessionId, updates) {
  const { data } = await apiClient.put(`/players/practice/sessions/${sessionId}`, updates);
  return data.session;
}

export async function deletePracticeSession(sessionId) {
  const { data } = await apiClient.delete(`/players/practice/sessions/${sessionId}`);
  return data;
}

// --- Practice Matches ---
export async function fetchPracticeMatches(params = {}) {
  const { data } = await apiClient.get('/players/practice/matches', { params });
  return data;
}

export async function createPracticeMatch(sessionId, matchData) {
  const { data } = await apiClient.post(`/players/practice/sessions/${sessionId}/matches`, matchData);
  return data;
}

export async function updatePracticeMatch(matchId, matchData) {
  const { data } = await apiClient.put(`/players/practice/matches/${matchId}`, matchData);
  return data;
}

export async function deletePracticeMatch(matchId) {
  const { data } = await apiClient.delete(`/players/practice/matches/${matchId}`);
  return data;
}

// --- History & Unified Matches ---
export async function fetchPlayerTournamentHistory() {
  const { data } = await apiClient.get('/players/tournaments/history');
  return data.tournaments;
}

export async function fetchPlayerMatchHistory(params = {}) {
  const { data } = await apiClient.get('/players/matches', { params });
  return data;
}

// --- Public Search & Discovery ---
export async function searchPlayers(query) {
  const { data } = await apiClient.get('/players/search', { params: { query } });
  return data.players;
}

export async function fetchPublicPlayerProfile(evoqId) {
  const { data } = await apiClient.get(`/players/${evoqId}/public`);
  return data.profile;
}
