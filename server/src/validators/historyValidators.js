function positiveId(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
export function validateTournamentId(params) { return positiveId(params.tournamentId) ? {} : { tournamentId: 'tournamentId must be a positive integer' }; }
export function validateHistoryId(params) { return positiveId(params.historyId) ? {} : { historyId: 'historyId must be a positive integer' }; }
