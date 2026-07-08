const path = require('path');

function isRenderRuntime() {
  return Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID);
}

function configurePlaywrightBrowserPath() {
  if (isRenderRuntime() && (!process.env.PLAYWRIGHT_BROWSERS_PATH || process.env.PLAYWRIGHT_BROWSERS_PATH === '0')) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(__dirname, '.cache', 'ms-playwright');
  } else if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
  }

  return process.env.PLAYWRIGHT_BROWSERS_PATH;
}

module.exports = {
  configurePlaywrightBrowserPath,
  isRenderRuntime
};
