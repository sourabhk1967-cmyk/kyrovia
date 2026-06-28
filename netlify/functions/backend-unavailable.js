exports.handler = async (event) => {
  const path = event.path || '/api';
  const isDeploymentStatus = /\/api\/deployment\/?$/i.test(path);
  const payload = {
    ok: isDeploymentStatus,
    service: 'kyrovia',
    public: true,
    runtime: 'netlify-static-frontend',
    apiBasePath: '/api',
    noOpenAiApiKeyRequired: true,
    backendRequiresPersistentBrowser: true,
    netlifyFrontendReady: true,
    netlifyBackendMode: 'external-persistent-express-required',
    browser: {
      ready: false
    },
    message:
      'Kyrovia is public on Netlify. Set VITE_API_URL to your persistent Express backend URL so Playwright chat, uploads, search, WhatsApp, and health features can run.',
    checkedAt: new Date().toISOString()
  };

  return {
    statusCode: isDeploymentStatus ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
};
