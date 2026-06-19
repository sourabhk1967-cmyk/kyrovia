const jwt = require('jsonwebtoken');

const { assertJwtConfig, loadConfig } = require('../config');
const { resolveRequestSessionId } = require('../services/sessionIdentity');

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.trim().split(/\s+/);

  if (!/^Bearer$/i.test(scheme) || !token) {
    return '';
  }

  return token;
}

function requireAuth(req, res, next) {
  const token = readBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }

  try {
    const config = loadConfig().auth;
    assertJwtConfig(config);

    const user = jwt.verify(token, config.jwtSecret, {
      audience: config.jwtAudience,
      issuer: config.jwtIssuer
    });

    if (!user || typeof user.username !== 'string') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = {
      ...user,
      sessionId: resolveRequestSessionId(user, token)
    };
    return next();
  } catch (error) {
    if (error.status && error.status >= 500) {
      return next(error);
    }

    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
