import { errorResponses } from '../errors/AppError.js';

export function validateRequest({ body, params, query } = {}) {
  return (req, _res, next) => {
    const details = {};

    for (const [name, validator] of Object.entries({ body, params, query })) {
      if (typeof validator !== 'function') {
        continue;
      }

      const result = validator(req[name]);
      if (result && typeof result === 'object' && Object.keys(result).length > 0) {
        details[name] = result;
      }
    }

    if (Object.keys(details).length > 0) {
      return next(errorResponses.validation(details));
    }

    return next();
  };
}
