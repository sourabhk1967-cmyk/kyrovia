const express = require('express');

const requireAuth = require('../middleware/auth');
const {
  createAuthorizationUrl,
  disconnectGoogleFit,
  exchangeAuthorizationCode,
  getGoogleFitStatus,
  syncGoogleFit,
  verifyAuthorizationState
} = require('../services/googleFit');
const { kyroviaIdentityInstruction, sanitizeKyroviaBranding } = require('../services/identity');
const { refineResponse } = require('../services/refiner');
const {
  buildDeterministicPlan,
  buildHealthInsight,
  connectHealthSource,
  importFitnessData,
  migrateHealthProfile,
  readHealthProfile,
  saveHealthPlan,
  updateHealthProfile
} = require('../services/healthProfile');

const router = express.Router();
const DEFAULT_MODEL_ID = 'nova-instant';

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getChatService(req) {
  return req.app.locals.chatgpt || null;
}

function getConfig(req) {
  return req.app.locals.config || {};
}

function redirectToHealthLab(res, returnUrl, status, message = '') {
  const url = new URL(returnUrl || 'http://localhost:5173/');

  url.searchParams.set('health_google_fit', status);
  if (message) {
    url.searchParams.set('health_google_fit_message', String(message).slice(0, 300));
  }

  res.redirect(302, url.toString());
}

async function userKey(req) {
  const accountId = req.user?.firebaseUid || req.user?.username || 'default';

  if (req.user?.firebaseUid && req.user?.username) {
    await migrateHealthProfile(req.user.username, req.user.firebaseUid);
  }

  return accountId;
}

async function markGoogleFitConnection(accountId, patch = {}) {
  const current = await readHealthProfile(accountId);
  const existing = current.connections?.['google-fit'] || {};

  return updateHealthProfile(accountId, {
    connections: {
      'google-fit': {
        ...existing,
        connected: patch.connected ?? true,
        connectedAt: patch.connected === false
          ? ''
          : existing.connectedAt || new Date().toISOString(),
        lastSync: patch.lastSync ?? existing.lastSync ?? '',
        note: patch.note ?? existing.note ?? '',
        source: 'google-fit',
        status: patch.status || existing.status || 'connected'
      }
    }
  });
}

function healthPrompt(profile, insight) {
  return [
    kyroviaIdentityInstruction(),
    'You are Kyrovia Health Balance Lab. Create a wellness routine using only the user-provided health profile.',
    'Safety rules:',
    '- Do not diagnose disease, prescribe medicines, change doses, or replace a clinician.',
    '- If urgent symptoms or dangerous readings are present, advise urgent medical care.',
    '- Suggest doctor specialties, not specific doctors.',
    '- Keep recommendations practical: routine, medicine reminder structure, food intake habits, exercise, yoga, and check-up follow-up.',
    '',
    `Health balance score: ${insight.healthBalance}`,
    `Goals: ${JSON.stringify(profile.goals)}`,
    `Latest metrics: ${JSON.stringify(profile.metrics)}`,
    `Medicines: ${JSON.stringify(profile.medicines)}`,
    `Checkups: ${JSON.stringify(profile.checkups.slice(-8))}`,
    `Preferences: ${JSON.stringify(profile.preferences)}`,
    'Return concise Markdown with headings: Daily routine, Medicine reminders, Food intake, Exercise and yoga, Doctor suggestion, Safety notes.'
  ].join('\n');
}

router.get('/google-fit/callback', async (req, res, next) => {
  const config = getConfig(req);
  let state = null;

  try {
    state = verifyAuthorizationState(req.query?.state, config);

    if (req.query?.error) {
      throw createHttpError(
        400,
        req.query.error_description || 'Google Fit permission was not granted.'
      );
    }

    if (!req.query?.code) {
      throw createHttpError(400, 'Google Fit did not return an authorization code.');
    }

    await exchangeAuthorizationCode({
      accountId: state.accountId,
      code: req.query.code
    }, config);
    await markGoogleFitConnection(state.accountId, {
      connected: true,
      status: 'connected',
      note: 'Google Fit permission granted. Automatic activity sync is enabled.'
    });

    let syncMessage = 'Google Fit connected and automatic sync enabled.';

    try {
      const sync = await syncGoogleFit(state.accountId, config, {
        days: config.googleFit?.syncDays,
        timeZone: state.timeZone
      });

      if (sync.records.length) {
        await importFitnessData(state.accountId, {
          source: 'google-fit',
          records: sync.records
        });
        syncMessage = `Google Fit connected. Synced ${sync.records.length} day${sync.records.length === 1 ? '' : 's'} of activity.`;
      } else {
        await markGoogleFitConnection(state.accountId, {
          lastSync: sync.syncedAt,
          status: 'no_data',
          note: 'Google Fit connected, but no steps or calorie data was returned for the selected period.'
        });
        syncMessage = 'Google Fit connected, but no recent activity data was available.';
      }
    } catch (syncError) {
      await markGoogleFitConnection(state.accountId, {
        status: 'sync_error',
        note: syncError.message
      });
      syncMessage = `Google Fit connected. Initial sync needs attention: ${syncError.message}`;
    }

    redirectToHealthLab(res, state.returnUrl, 'connected', syncMessage);
  } catch (error) {
    if (state?.returnUrl) {
      redirectToHealthLab(res, state.returnUrl, 'error', error.message);
      return;
    }

    next(error);
  }
});

router.use(requireAuth);

router.get('/profile', async (req, res, next) => {
  try {
    const accountId = await userKey(req);
    const profile = await readHealthProfile(accountId);

    res.json({
      profile,
      insight: buildHealthInsight(profile),
      googleFit: await getGoogleFitStatus(accountId, getConfig(req), profile)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const patch = req.body?.profile || req.body || {};
    const profile = await updateHealthProfile(await userKey(req), patch);

    res.json({
      profile,
      insight: buildHealthInsight(profile)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/connect', async (req, res, next) => {
  try {
    const source = String(req.body?.source || '').trim();

    if (!source) {
      throw createHttpError(400, 'Health source is required.');
    }

    const profile = await connectHealthSource(await userKey(req), source, req.body || {});

    res.json({
      profile,
      insight: buildHealthInsight(profile)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/google-fit/status', async (req, res, next) => {
  try {
    const accountId = await userKey(req);
    const profile = await readHealthProfile(accountId);

    res.json({
      googleFit: await getGoogleFitStatus(accountId, getConfig(req), profile)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/google-fit/authorize', async (req, res, next) => {
  try {
    const accountId = await userKey(req);
    const config = getConfig(req);
    const profile = await readHealthProfile(accountId);
    const status = await getGoogleFitStatus(accountId, config, profile);

    if (status.connected) {
      res.json({
        googleFit: status,
        authorizationUrl: ''
      });
      return;
    }

    res.json({
      googleFit: status,
      authorizationUrl: createAuthorizationUrl({
        accountId,
        timeZone: req.body?.timeZone,
        username: req.user?.username || ''
      }, config)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/google-fit/sync', async (req, res, next) => {
  try {
    const accountId = await userKey(req);
    const config = getConfig(req);
    const sync = await syncGoogleFit(accountId, config, {
      days: req.body?.days,
      timeZone: req.body?.timeZone
    });
    let profile;

    if (sync.records.length) {
      profile = await importFitnessData(accountId, {
        source: 'google-fit',
        records: sync.records
      });
    } else {
      profile = await markGoogleFitConnection(accountId, {
        lastSync: sync.syncedAt,
        status: 'no_data',
        note: 'No Google Fit steps, calories, or active minutes were returned for this period.'
      });
    }

    res.json({
      profile,
      insight: buildHealthInsight(profile),
      googleFit: await getGoogleFitStatus(accountId, config, profile),
      sync: {
        days: sync.days,
        recordCount: sync.records.length,
        syncedAt: sync.syncedAt,
        timeZone: sync.timeZone
      }
    });
  } catch (error) {
    if (error.status === 401) {
      const accountId = await userKey(req);
      await markGoogleFitConnection(accountId, {
        connected: false,
        status: 'consent_required',
        note: error.message
      }).catch(() => undefined);
    }

    next(error);
  }
});

router.post('/google-fit/disconnect', async (req, res, next) => {
  try {
    const accountId = await userKey(req);
    const config = getConfig(req);

    await disconnectGoogleFit(accountId, config);
    const profile = await markGoogleFitConnection(accountId, {
      connected: false,
      lastSync: '',
      status: 'consent_required',
      note: 'Google Fit is disconnected from this Kyrovia account.'
    });

    res.json({
      profile,
      insight: buildHealthInsight(profile),
      googleFit: await getGoogleFitStatus(accountId, config, profile)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/import', async (req, res, next) => {
  try {
    const profile = await importFitnessData(await userKey(req), req.body || {});

    res.json({
      profile,
      insight: buildHealthInsight(profile)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/plan', async (req, res, next) => {
  try {
    const accountId = await userKey(req);
    const profile = await readHealthProfile(accountId);
    const insight = buildHealthInsight(profile);
    const service = getChatService(req);
    let aiText = '';
    let aiError = '';

    if (service) {
      try {
        const result = await service.sendMessage(
          healthPrompt(profile, insight),
          [],
          req.body?.model || DEFAULT_MODEL_ID,
          {
            sessionKey: `health:${accountId}`
          }
        );
        aiText = sanitizeKyroviaBranding(refineResponse(result.text || ''));
      } catch (error) {
        aiError = error.message || 'Kyrovia AI health routine generation failed.';
      }
    }

    const plan = buildDeterministicPlan(profile, aiText, aiError);
    const nextProfile = await saveHealthPlan(accountId, plan);

    res.json({
      profile: nextProfile,
      insight: buildHealthInsight(nextProfile),
      plan
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
