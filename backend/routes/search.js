const express = require('express');

const requireAuth = require('../middleware/auth');
const { searchGoogle } = require('../services/googleSearch');

const router = express.Router();

router.use(requireAuth);

router.post('/google', async (req, res, next) => {
  try {
    const result = await searchGoogle(req.body?.query, req.app.locals.config.googleSearch, {
      page: req.body?.page,
      type: req.body?.type,
      sort: req.body?.sort
    });

    res.json({
      ...result,
      images: [],
      files: [],
      conversationUrl: result.searchUrl,
      model: 'google-web'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
