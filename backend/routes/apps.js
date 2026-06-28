const express = require('express');

const requireAuth = require('../middleware/auth');
const { findApp, getAppDetail, getAppsCatalog } = require('../services/appsCatalog');
const { kyroviaIdentityInstruction, sanitizeKyroviaBranding } = require('../services/identity');
const { refineResponse } = require('../services/refiner');

const router = express.Router();
const DEFAULT_MODEL_ID = 'nova-instant';

router.use(requireAuth);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getChatService(req) {
  const service = req.app.locals.chatgpt;

  if (!service) {
    throw createHttpError(503, 'Kyrovia browser service is not available');
  }

  return service;
}

function sanitizePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';

  return prompt.slice(0, 1600);
}

function kyroviaOnly(text = '') {
  return sanitizeKyroviaBranding(refineResponse(text)).replace(/\bOpenAI app\b/gi, 'Kyrovia app');
}

router.get('/', (_req, res) => {
  res.json({
    source: 'Kyrovia Apps',
    brand: 'Kyrovia',
    categories: getAppsCatalog()
  });
});

router.get('/:appId', (req, res, next) => {
  try {
    const app = getAppDetail(req.params.appId);

    if (!app) {
      throw createHttpError(404, 'Kyrovia app was not found.');
    }

    res.json({
      app
    });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const app = findApp(req.body?.appId);

    if (!app) {
      throw createHttpError(404, 'Kyrovia app was not found.');
    }

    const userPrompt = sanitizePrompt(req.body?.prompt);
    const prompt = [
      kyroviaIdentityInstruction(),
      `Use the Kyrovia app "${app.name}" from the ${app.categoryLabel} section.`,
      `App purpose: ${app.description}.`,
      userPrompt
        ? `User request: ${userPrompt}`
        : `Generate a concise Kyrovia response showing how this app can help right now.`,
      'Format the answer in clean Markdown with short bold headings and useful bullets.'
    ].join('\n');

    const service = getChatService(req);
    const result = await service.sendMessage(prompt, [], req.body?.model || DEFAULT_MODEL_ID);

    res.json({
      app,
      message: kyroviaOnly(result.text),
      conversationUrl: result.conversationUrl,
      model: result.model || DEFAULT_MODEL_ID,
      provider: 'kyrovia',
      scrapedAt: result.scrapedAt || new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
