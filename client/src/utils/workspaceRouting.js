/**
 * Resolves the primary workspace destination for an authenticated user identity.
 * 
 * Rules:
 * 1. Unauthenticated -> /login
 * 2. Primary role ORGANIZER -> /organizer
 * 3. Active Scout capabilities (isScout, scoutCount > 0, or non-empty scoutAssignments) -> /scout
 * 4. Regular Player -> /player/dashboard
 */
export function resolveInitialWorkspaceRoute(identity) {
  if (!identity) return '/login';
  if (identity.role === 'ORGANIZER') return '/organizer';
  if (
    identity.isScout ||
    Number(identity.scoutCount) > 0 ||
    (Array.isArray(identity.scoutAssignments) && identity.scoutAssignments.length > 0)
  ) {
    return '/scout';
  }
  return '/player/dashboard';
}

/**
 * Checks whether an identity has active scout capabilities.
 */
export function hasActiveScoutRole(identity) {
  if (!identity) return false;
  return Boolean(
    identity.isScout ||
    Number(identity.scoutCount) > 0 ||
    (Array.isArray(identity.scoutAssignments) && identity.scoutAssignments.length > 0)
  );
}
