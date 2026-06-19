const express = require('express');

const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function getWhatsAppService(req) {
  const manager = req.app.locals.whatsappManager;

  if (!manager) {
    const error = new Error('WhatsApp service is not available');
    error.status = 503;
    throw error;
  }

  return manager.getService(req.user);
}

router.get('/status', (req, res, next) => {
  try {
    res.json({
      whatsapp: getWhatsAppService(req).getStatus()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/connect', async (req, res, next) => {
  try {
    const status = await getWhatsAppService(req).connect({
      restart: Boolean(req.body?.restart)
    });

    res.json({
      whatsapp: status
    });
  } catch (error) {
    next(error);
  }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    const status = await getWhatsAppService(req).disconnect({
      logout: Boolean(req.body?.logout)
    });

    res.json({
      whatsapp: status
    });
  } catch (error) {
    next(error);
  }
});

router.post('/send', async (req, res, next) => {
  try {
    const result = await getWhatsAppService(req).sendText({
      to: req.body?.to,
      text: req.body?.text
    });

    res.json({
      ok: true,
      message: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
