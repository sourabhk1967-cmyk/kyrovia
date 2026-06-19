const express = require('express');
const jwt = require('jsonwebtoken');

const { assertJwtConfig, loadConfig } = require('../config');
const requireAuth = require('../middleware/auth');
const { verifyFirebaseIdToken } = require('../services/firebaseAdmin');
const { createLoginSessionId } = require('../services/sessionIdentity');
const { googleAccountNameFromClaims } = require('../services/userContext');

const router = express.Router();

function normalizeFirebasePayload(body = {}) {
  return {
    idToken: typeof body.idToken === 'string' ? body.idToken.trim() : ''
  };
}

function createAuthError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function signSessionToken(username, config, claims = {}) {
  return jwt.sign(
    {
      sub: username,
      username,
      ...claims
    },
    config.jwtSecret,
    {
      audience: config.jwtAudience,
      expiresIn: config.jwtExpiresIn,
      issuer: config.jwtIssuer
    }
  );
}

function buildUser(username, profile = {}) {
  return {
    username,
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.name ? { name: profile.name } : {}),
    ...(profile.photoURL ? { photoURL: profile.photoURL } : {}),
    ...(profile.authProvider ? { authProvider: profile.authProvider } : {}),
    ...(profile.firebaseUid ? { firebaseUid: profile.firebaseUid } : {}),
    ...(profile.sessionId ? { sessionId: profile.sessionId } : {})
  };
}

function requireFirebaseToken(idToken) {
  if (!idToken) {
    throw createAuthError(400, 'Firebase ID token is required');
  }
}

async function verifyFirebaseTokenForLogin(idToken, firebaseConfig) {
  try {
    return await verifyFirebaseIdToken(idToken, firebaseConfig);
  } catch (error) {
    if (error.status) {
      throw error;
    }

    if (typeof error.code === 'string' && error.code.startsWith('auth/')) {
      throw createAuthError(401, 'Invalid Firebase sign-in token');
    }

    throw error;
  }
}

router.post('/firebase', async (req, res, next) => {
  try {
    const { idToken } = normalizeFirebasePayload(req.body);
    const config = loadConfig();
    assertJwtConfig(config.auth);
    requireFirebaseToken(idToken);

    const decodedToken = await verifyFirebaseTokenForLogin(idToken, config.firebase);
    const signInProvider = decodedToken.firebase?.sign_in_provider;

    if (signInProvider !== 'google.com' || decodedToken.email_verified !== true) {
      throw createAuthError(401, 'Please sign in with a verified Google account.');
    }

    const username = decodedToken.email || decodedToken.name || decodedToken.uid;
    const accountName = googleAccountNameFromClaims(decodedToken);
    const sessionId = createLoginSessionId();
    const user = buildUser(username, {
      email: decodedToken.email,
      name: accountName,
      photoURL: decodedToken.picture,
      authProvider: 'firebase-google',
      firebaseUid: decodedToken.uid,
      sessionId
    });
    const token = signSessionToken(user.username, config.auth, {
      email: user.email,
      name: user.name,
      photoURL: user.photoURL,
      authProvider: user.authProvider,
      firebaseUid: decodedToken.uid,
      sessionId
    });

    return res.json({
      token,
      user
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: buildUser(req.user.username, {
      email: req.user.email,
      name: req.user.name,
      photoURL: req.user.photoURL,
      authProvider: req.user.authProvider || 'local',
      firebaseUid: req.user.firebaseUid,
      sessionId: req.user.sessionId
    })
  });
});

module.exports = router;
