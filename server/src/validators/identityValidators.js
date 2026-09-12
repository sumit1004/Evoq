const allowedSignupRoles = new Set(['PLAYER', 'ORGANIZER']);

export function validateSignup(body = {}) {
  const errors = {};
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) {
    errors.name = 'Name must be between 2 and 120 characters';
  }
  if (typeof body.email !== 'string' || !/^\S+@\S+\.\S+$/.test(body.email.trim())) {
    errors.email = 'A valid email is required';
  }
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    errors.password = 'Password must be between 8 and 128 characters';
  }
  if (body.role !== undefined && !allowedSignupRoles.has(body.role)) {
    errors.role = 'Role must be PLAYER or ORGANIZER';
  }
  return errors;
}

export function validateLogin(body = {}) {
  const errors = {};
  if (typeof body.email !== 'string' || body.email.trim().length === 0) {
    errors.email = 'Email is required';
  }
  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.password = 'Password is required';
  }
  return errors;
}

export function validateProfilePatch(body = {}) {
  const errors = {};
  const allowed = ['name', 'mobile', 'inGameName', 'gameUid'];
  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some((key) => !allowed.includes(key))) {
    errors.fields = 'Only name, mobile, inGameName, and gameUid may be updated';
  }
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120)) {
    errors.name = 'Name must be between 2 and 120 characters';
  }
  return errors;
}
