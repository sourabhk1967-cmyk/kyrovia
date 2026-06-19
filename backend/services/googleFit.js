const { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const jwt = require('jsonwebtoken');

const DATA_DIR = path.resolve(process.cwd(), process.env.KYROVIA_DATA_DIR || './data');
const TOKEN_DIR = path.join(DATA_DIR, 'health-oauth', 'google-fit');
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_FIT_AGGREGATE_URL = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';
const GOOGLE_FIT_SCOPE = 'https://www.googleapis.com/auth/fitness.activity.read';
const DAY_MILLIS = 24 * 60 * 60 * 1000;

function createGoogleFitError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function accountStorageId(accountId) {
  return createHash('sha256').update(String(accountId || '')).digest('hex');
}

function tokenPath(accountId) {
  return path.join(TOKEN_DIR, `${accountStorageId(accountId)}.json`);
}

function isConfigured(config = {}) {
  return Boolean(
    config.googleFit?.clientId &&
    config.googleFit?.clientSecret &&
    config.googleFit?.redirectUri &&
    config.googleFit?.tokenEncryptionKey &&
    config.auth?.jwtSecret
  );
}

function configurationMessage(config = {}) {
  const missing = [];

  if (!config.googleFit?.clientId) missing.push('GOOGLE_FIT_CLIENT_ID');
  if (!config.googleFit?.clientSecret) missing.push('GOOGLE_FIT_CLIENT_SECRET');
  if (!config.googleFit?.redirectUri) missing.push('GOOGLE_FIT_REDIRECT_URI');
  if (!config.googleFit?.tokenEncryptionKey) missing.push('GOOGLE_FIT_TOKEN_ENCRYPTION_KEY');
  if (!config.auth?.jwtSecret) missing.push('JWT_SECRET');

  return missing.length
    ? `Google Fit sync needs backend configuration: ${missing.join(', ')}.`
    : '';
}

function assertConfigured(config = {}) {
  if (!isConfigured(config)) {
    throw createGoogleFitError(503, configurationMessage(config));
  }
}

function encryptionKey(config = {}) {
  return createHash('sha256').update(config.googleFit.tokenEncryptionKey).digest();
}

function encryptToken(token, config) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(token), 'utf8'),
    cipher.final()
  ]);

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
}

function decryptToken(payload, config) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(config),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

async function readToken(accountId, config) {
  try {
    const raw = await fs.readFile(tokenPath(accountId), 'utf8');
    return decryptToken(JSON.parse(raw), config);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    if (error instanceof SyntaxError || /authenticate data/i.test(error.message || '')) {
      throw createGoogleFitError(500, 'Stored Google Fit authorization could not be read. Disconnect and reconnect Google Fit.');
    }

    throw error;
  }
}

async function writeToken(accountId, token, config) {
  const filePath = tokenPath(accountId);
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  await fs.mkdir(TOKEN_DIR, { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(encryptToken(token, config))}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  await fs.rename(temporaryPath, filePath);
}

async function deleteToken(accountId) {
  await fs.rm(tokenPath(accountId), { force: true });
}

function normalizedReturnUrl(config = {}) {
  const raw = config.googleFit?.returnUrl || config.server?.publicAppUrl || config.server?.corsOrigins?.[0];

  try {
    const url = new URL(raw || 'http://localhost:5173');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch (_error) {
    return 'http://localhost:5173/';
  }
}

function createAuthorizationUrl({ accountId, timeZone = 'UTC', username = '' }, config) {
  assertConfigured(config);

  const state = jwt.sign(
    {
      purpose: 'google-fit-oauth',
      accountId: String(accountId || '').slice(0, 240),
      returnUrl: normalizedReturnUrl(config),
      timeZone: validTimeZone(timeZone)
    },
    config.auth.jwtSecret,
    {
      audience: 'kyrovia-google-fit',
      expiresIn: '10m',
      issuer: config.auth.jwtIssuer,
      jwtid: randomUUID()
    }
  );
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set('client_id', config.googleFit.clientId);
  url.searchParams.set('redirect_uri', config.googleFit.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_FIT_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  if (username) {
    url.searchParams.set('login_hint', String(username).slice(0, 240));
  }

  return url.toString();
}

function verifyAuthorizationState(state, config) {
  assertConfigured(config);

  const payload = jwt.verify(String(state || ''), config.auth.jwtSecret, {
    audience: 'kyrovia-google-fit',
    issuer: config.auth.jwtIssuer
  });

  if (payload?.purpose !== 'google-fit-oauth' || !payload.accountId) {
    throw createGoogleFitError(400, 'Google Fit authorization state is invalid or expired.');
  }

  return payload;
}

async function parseGoogleError(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  const detail =
    payload.error_description ||
    payload.error?.message ||
    (typeof payload.error === 'string' ? payload.error : '') ||
    fallback;

  return String(detail || fallback).slice(0, 700);
}

async function exchangeAuthorizationCode({ accountId, code }, config, fetchImpl = fetch) {
  assertConfigured(config);
  const existing = await readToken(accountId, config);
  const body = new URLSearchParams({
    client_id: config.googleFit.clientId,
    client_secret: config.googleFit.clientSecret,
    code: String(code || ''),
    grant_type: 'authorization_code',
    redirect_uri: config.googleFit.redirectUri
  });
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw createGoogleFitError(
      response.status === 400 ? 400 : 502,
      await parseGoogleError(response, 'Google did not complete Fit authorization.')
    );
  }

  const payload = await response.json();
  const token = {
    accessToken: payload.access_token || '',
    refreshToken: payload.refresh_token || existing?.refreshToken || '',
    tokenType: payload.token_type || 'Bearer',
    scope: payload.scope || GOOGLE_FIT_SCOPE,
    expiresAt: Date.now() + Math.max(Number(payload.expires_in) || 3600, 60) * 1000,
    updatedAt: new Date().toISOString()
  };

  if (!token.accessToken) {
    throw createGoogleFitError(502, 'Google Fit authorization returned no access token.');
  }

  await writeToken(accountId, token, config);
  return token;
}

async function refreshAccessToken(accountId, config, fetchImpl = fetch, { force = false } = {}) {
  assertConfigured(config);
  const existing = await readToken(accountId, config);

  if (!existing) {
    throw createGoogleFitError(401, 'Google Fit is not connected to this Kyrovia account.');
  }

  if (!force && existing.accessToken && Number(existing.expiresAt) > Date.now() + 60_000) {
    return existing;
  }

  if (!existing.refreshToken) {
    throw createGoogleFitError(401, 'Google Fit authorization expired. Reconnect Google Fit to continue automatic sync.');
  }

  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: config.googleFit.clientId,
      client_secret: config.googleFit.clientSecret,
      refresh_token: existing.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw createGoogleFitError(
      response.status === 400 || response.status === 401 ? 401 : 502,
      await parseGoogleError(response, 'Unable to refresh Google Fit authorization.')
    );
  }

  const payload = await response.json();
  const token = {
    ...existing,
    accessToken: payload.access_token || '',
    refreshToken: payload.refresh_token || existing.refreshToken,
    tokenType: payload.token_type || existing.tokenType || 'Bearer',
    scope: payload.scope || existing.scope || GOOGLE_FIT_SCOPE,
    expiresAt: Date.now() + Math.max(Number(payload.expires_in) || 3600, 60) * 1000,
    updatedAt: new Date().toISOString()
  };

  await writeToken(accountId, token, config);
  return token;
}

function validTimeZone(timeZone) {
  const value = String(timeZone || '').trim();

  if (!value) {
    return 'UTC';
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value;
  } catch (_error) {
    return 'UTC';
  }
}

function dateInTimeZone(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(Number(timestamp)));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function pointValue(point = {}) {
  return (point.value || []).reduce((sum, value) => {
    const number =
      Number.isFinite(Number(value.intVal))
        ? Number(value.intVal)
        : Number.isFinite(Number(value.fpVal))
          ? Number(value.fpVal)
          : 0;

    return sum + number;
  }, 0);
}

function parseAggregateResponse(payload = {}, timeZone = 'UTC') {
  const records = [];

  for (const bucket of Array.isArray(payload.bucket) ? payload.bucket : []) {
    const record = {
      date: dateInTimeZone(bucket.startTimeMillis || Date.now(), timeZone),
      steps: 0,
      calories: 0,
      activeMinutes: 0
    };
    let hasData = false;

    for (const dataset of Array.isArray(bucket.dataset) ? bucket.dataset : []) {
      for (const point of Array.isArray(dataset.point) ? dataset.point : []) {
        const dataTypeName = String(point.dataTypeName || dataset.dataSourceId || '');
        const value = pointValue(point);

        if (dataTypeName.includes('step_count')) {
          record.steps += value;
          hasData = true;
        } else if (dataTypeName.includes('calories.expended')) {
          record.calories += value;
          hasData = true;
        } else if (dataTypeName.includes('active_minutes')) {
          record.activeMinutes += value / 60_000;
          hasData = true;
        }
      }
    }

    if (hasData) {
      records.push({
        ...record,
        steps: Math.max(0, Math.round(record.steps)),
        calories: Math.max(0, Math.round(record.calories)),
        activeMinutes: Math.max(0, Math.round(record.activeMinutes))
      });
    }
  }

  return records;
}

async function requestAggregate(token, requestBody, fetchImpl) {
  return fetchImpl(GOOGLE_FIT_AGGREGATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
}

async function syncGoogleFit(accountId, config, options = {}, fetchImpl = fetch) {
  assertConfigured(config);
  const timeZone = validTimeZone(options.timeZone);
  const days = Math.min(Math.max(Number(options.days) || config.googleFit.syncDays || 30, 1), 90);
  const endTimeMillis = Date.now();
  const startTimeMillis = endTimeMillis - days * DAY_MILLIS;
  const requestBody = {
    startTimeMillis,
    endTimeMillis,
    aggregateBy: [
      { dataTypeName: 'com.google.step_count.delta' },
      { dataTypeName: 'com.google.calories.expended' },
      { dataTypeName: 'com.google.active_minutes' }
    ],
    bucketByTime: {
      period: {
        type: 'day',
        value: 1,
        timeZoneId: timeZone
      }
    }
  };
  let token = await refreshAccessToken(accountId, config, fetchImpl);
  let response = await requestAggregate(token, requestBody, fetchImpl);

  if (response.status === 401) {
    token = await refreshAccessToken(accountId, config, fetchImpl, { force: true });
    response = await requestAggregate(token, requestBody, fetchImpl);
  }

  if (!response.ok) {
    throw createGoogleFitError(
      response.status === 401 ? 401 : 502,
      await parseGoogleError(response, 'Google Fit did not return activity data.')
    );
  }

  const payload = await response.json();

  return {
    records: parseAggregateResponse(payload, timeZone),
    days,
    timeZone,
    syncedAt: new Date().toISOString()
  };
}

async function getGoogleFitStatus(accountId, config, profile = null) {
  const configured = isConfigured(config);
  let hasToken = false;

  if (configured) {
    hasToken = Boolean(await readToken(accountId, config).catch(() => null));
  }

  const connection = profile?.connections?.['google-fit'] || {};

  return {
    automaticSync: true,
    configured,
    connected: Boolean(hasToken && connection.connected !== false),
    deprecated: true,
    lastSync: connection.lastSync || '',
    status: !configured
      ? 'setup_required'
      : hasToken
        ? connection.status || 'connected'
        : 'consent_required',
    message: !configured
      ? configurationMessage(config)
      : hasToken
        ? 'Google Fit is authorized. Kyrovia syncs activity when Health Balance Lab opens.'
        : 'Google permission is required once before Kyrovia can sync steps and calories.',
    migrationMessage: 'Google Fit APIs are being deprecated in 2026. Health Connect is the recommended long-term integration.'
  };
}

async function disconnectGoogleFit(accountId, config, fetchImpl = fetch) {
  const token = isConfigured(config) ? await readToken(accountId, config).catch(() => null) : null;
  const revokeToken = token?.refreshToken || token?.accessToken;

  if (revokeToken) {
    await fetchImpl(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(revokeToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).catch(() => undefined);
  }

  await deleteToken(accountId);
}

module.exports = {
  GOOGLE_FIT_SCOPE,
  createAuthorizationUrl,
  disconnectGoogleFit,
  exchangeAuthorizationCode,
  getGoogleFitStatus,
  isConfigured,
  parseAggregateResponse,
  syncGoogleFit,
  verifyAuthorizationState
};
