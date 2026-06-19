const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test('creates account-bound OAuth state and parses daily Google Fit activity', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kyrovia-google-fit-test-'));
  process.env.KYROVIA_DATA_DIR = tempDir;
  delete require.cache[require.resolve('./googleFit')];

  const {
    createAuthorizationUrl,
    exchangeAuthorizationCode,
    getGoogleFitStatus,
    parseAggregateResponse,
    syncGoogleFit,
    verifyAuthorizationState
  } = require('./googleFit');
  const config = {
    auth: {
      jwtIssuer: 'kyrovia',
      jwtSecret: 'test-jwt-secret-that-is-long-enough'
    },
    googleFit: {
      clientId: 'google-fit-client-id',
      clientSecret: 'google-fit-client-secret',
      redirectUri: 'http://localhost:5050/api/health/google-fit/callback',
      returnUrl: 'http://localhost:5173/',
      syncDays: 30,
      tokenEncryptionKey: 'separate-test-token-encryption-key'
    },
    server: {
      corsOrigins: ['http://localhost:5173'],
      publicAppUrl: ''
    }
  };
  const authorizationUrl = new URL(createAuthorizationUrl({
    accountId: 'firebase-health-account',
    timeZone: 'Asia/Kolkata',
    username: 'health@example.com'
  }, config));
  const state = verifyAuthorizationState(authorizationUrl.searchParams.get('state'), config);

  assert.equal(authorizationUrl.hostname, 'accounts.google.com');
  assert.equal(authorizationUrl.searchParams.get('access_type'), 'offline');
  assert.equal(state.accountId, 'firebase-health-account');
  assert.equal(state.timeZone, 'Asia/Kolkata');

  await exchangeAuthorizationCode({
    accountId: state.accountId,
    code: 'authorization-code'
  }, config, async (url) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    return jsonResponse(200, {
      access_token: 'access-token',
      expires_in: 3600,
      refresh_token: 'refresh-token',
      scope: 'https://www.googleapis.com/auth/fitness.activity.read',
      token_type: 'Bearer'
    });
  });

  const aggregatePayload = {
    bucket: [
      {
        startTimeMillis: Date.parse('2026-06-17T00:00:00+05:30'),
        dataset: [
          {
            point: [
              {
                dataTypeName: 'com.google.step_count.delta',
                value: [{ intVal: 8450 }]
              }
            ]
          },
          {
            point: [
              {
                dataTypeName: 'com.google.calories.expended',
                value: [{ fpVal: 2145.4 }]
              }
            ]
          },
          {
            point: [
              {
                dataTypeName: 'com.google.active_minutes',
                value: [{ intVal: 2520000 }]
              }
            ]
          }
        ]
      }
    ]
  };
  const parsed = parseAggregateResponse(aggregatePayload, 'Asia/Kolkata');

  assert.deepEqual(parsed, [
    {
      date: '2026-06-17',
      steps: 8450,
      calories: 2145,
      activeMinutes: 42
    }
  ]);

  const sync = await syncGoogleFit(state.accountId, config, {
    days: 7,
    timeZone: 'Asia/Kolkata'
  }, async (url, options) => {
    assert.equal(url, 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate');
    assert.equal(options.headers.Authorization, 'Bearer access-token');
    return jsonResponse(200, aggregatePayload);
  });

  assert.equal(sync.records[0].steps, 8450);
  assert.equal(sync.records[0].calories, 2145);

  const status = await getGoogleFitStatus(state.accountId, config, {
    connections: {
      'google-fit': {
        connected: true,
        lastSync: sync.syncedAt,
        status: 'synced'
      }
    }
  });

  assert.equal(status.configured, true);
  assert.equal(status.connected, true);
  assert.equal(status.status, 'synced');
});
