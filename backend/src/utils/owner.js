const { AppError } = require('./errors');
const { validId } = require('./ids');

function assertOwner(req, paramUserId) {
  if (!req.user?.id) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  if (paramUserId === undefined || paramUserId === null || paramUserId === '') {
    throw new AppError('Missing user id', 400, 'BAD_REQUEST');
  }

  if (!validId(paramUserId)) {
    throw new AppError('Invalid user id', 400, 'BAD_REQUEST');
  }
  if (String(req.user.id) !== String(paramUserId)) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
}

// Express middleware factory: checks req.params[key] against req.user.id
function requireOwner(paramKey = 'userId') {
  return (req, _res, next) => {
    try {
      assertOwner(req, req.params[paramKey]);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { assertOwner, requireOwner };
