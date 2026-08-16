import { errorResponses } from '../errors/AppError.js';

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(errorResponses.authenticationRequired());
    }

    if (!roles.includes(req.user.role)) {
      return next(errorResponses.forbidden());
    }

    return next();
  };
}

export function requireOwnership(loadResource, { allowRoles = [] } = {}) {
  return async (req, _res, next) => {
    if (!req.user) {
      return next(errorResponses.authenticationRequired());
    }

    if (allowRoles.includes(req.user.role)) {
      return next();
    }

    try {
      const resource = await loadResource(req);
      if (!resource || Number(resource.ownerId ?? resource.owner_id) !== req.user.id) {
        return next(errorResponses.forbidden());
      }

      req.resource = resource;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
