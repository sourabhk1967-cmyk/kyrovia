const express = require('express');

const requireAuth = require('../middleware/auth');
const { runCode } = require('../services/codeRunner');

const router = express.Router();

router.use(requireAuth);

router.post('/run', async (req, res, next) => {
  try {
    const result = await runCode({
      code: req.body?.code,
      language: req.body?.language,
      stdin: req.body?.stdin,
      timeoutMs: req.body?.timeoutMs
    });

    res.json({
      ...result,
      ranAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
